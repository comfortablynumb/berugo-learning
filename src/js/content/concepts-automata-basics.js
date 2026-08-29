/** Concepts for languages, DFAs, NFAs and regexes (M24.1-M24.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'languages-and-the-hierarchy': [
      {
        term: 'A language is a set of strings, and nothing more',
        plain: 'Alphabet, concatenation, star; a language is any set of the strings you can build.',
        formal: 'over an alphabet Σ, a language is any subset of Σ* — the set of all finite strings',
        readAs: 'Given an alphabet, the set of all finite strings over it is written sigma-star, ' +
          'and a language is any collection of those strings you care to name.',
        detail: 'The definition is deliberately empty of content, because the interesting ' +
          'question is never what a language IS but which machine is strong enough to decide ' +
          'membership. That reframing is what the whole milestone rests on: "can a regex do ' +
          'this" becomes "is this set of strings recognisable by a machine with a fixed number ' +
          'of states", and that has an answer.',
        example: 'The demo tabulates eight languages and runs a real recogniser for each, from ' +
          'a 2-state automaton up to one that does not exist.'
      },
      {
        term: 'The hierarchy is about memory, not difficulty',
        plain: 'Each level up adds one new kind of memory, and nothing else.',
        formal: 'finite automaton: bounded state; pushdown: a stack; linear-bounded: a tape as long as the input; Turing machine: an unbounded tape',
        detail: 'A finite automaton remembers a bounded amount however long the input runs, so ' +
          'it can count modulo k and cannot count to n. A stack lifts exactly that restriction ' +
          'and gives matched pairs, which is why parsers rather than tokenisers handle nesting. ' +
          'A tape bounded by the input gives two counts at once. None of the steps is about how ' +
          'complicated the language looks; every one is about how much has to be carried forward.',
        example: 'The demo’s catalogue names what each language must remember, and the column ' +
          'reads as the hierarchy assembling itself.'
      },
      {
        term: '`aⁿbⁿ` and `a*b*` are on opposite sides of the line',
        plain: 'Both are a run of a then a run of b; only one needs to remember how long.',
        formal: 'a*b* is regular; {aⁿbⁿ : n ≥ 0} is not, because n is unbounded',
        readAs: 'The set of strings that are some number of a followed by some number of b is ' +
          'regular, and the set where the two numbers must be EQUAL is not, because no fixed ' +
          'number of states can hold an unbounded count.',
        detail: 'This pair is the whole boundary in two examples that differ by one word. The ' +
          'test to apply is always the same: does the property require remembering an unbounded ' +
          'count? Matching brackets does, equal run lengths do, and a suffix check or a ' +
          'divisibility test does not. Applying that test in a design review turns a taste ' +
          'argument into a fact about which tool the job needs.',
        example: 'The demo accepts 4 of 127 strings for aⁿbⁿ and offers no finite automaton for ' +
          'it, while a*b*-shaped languages get one and agree on every string.'
      },
      {
        term: 'Closure properties differ by level, and that is practical',
        plain: 'Regular languages are closed under intersection and complement; context-free ones are not.',
        formal: 'regular languages are closed under ∪, ∩, complement, concatenation and star; context-free under ∪, concatenation and star only',
        readAs: 'Combining two regular languages with union, intersection, complement, ' +
          'concatenation or star gives another regular language, while context-free languages ' +
          'survive only union, concatenation and star.',
        detail: 'This is not a footnote — it is exactly what separates the questions you can ' +
          'answer from the ones you cannot. Because regular languages are closed under ' +
          'intersection and complement, "does pattern A match anything B does not" reduces to an ' +
          'emptiness check and is decidable. Context-free languages are not closed under ' +
          'intersection, and the same question about two grammars is undecidable. A rule set ' +
          'expressed as patterns can be compared exactly; one expressed as a grammar cannot.',
        example: 'The demo’s hierarchy table lists the closure operations per level, and section ' +
          '24.6 turns the regular row into a containment checker.'
      },
      {
        term: 'Undecidable is a fifth category, not "very hard"',
        plain: 'No machine decides whether a program halts on its own source, at any budget.',
        formal: 'the halting problem is not recursively enumerable in its complement; no decider exists',
        detail: 'It is worth keeping separate from the four machine levels because the failure is ' +
          'of a different kind. A context-sensitive language needs a bigger machine; an ' +
          'undecidable problem needs a machine that cannot exist, and proving that is M26\'s ' +
          'work. The demo has no recogniser to offer for the last row of its catalogue, and that ' +
          'absence is the honest representation rather than a gap.',
        example: 'The demo tests 0 strings for the halting row, because there is nothing to run.'
      },
      {
        term: 'Regular is where almost all your tools live',
        plain: 'Every regex without backreferences, every lexer, every protocol state machine.',
        formal: 'the regular languages are exactly those recognised by finite automata, and exactly those denoted by regular expressions',
        detail: 'That equivalence — Kleene\'s theorem — is why the theory is practical rather ' +
          'than ornamental: the objects you already use daily under other names are the same ' +
          'objects, so everything provable about one transfers to the other. A regex can be ' +
          'minimised, two of them can be compared for equivalence, and a tokeniser can be ' +
          'generated from a rule list, all because they are automata underneath.',
        example: 'The demo checks its regular rows by running a finite automaton beside the ' +
          'definition and comparing on all 127 strings up to length 6.'
      },
      {
        term: 'The classification is checked, not asserted',
        plain: 'A finite automaton runs beside the definition and they are compared string by string.',
        formal: 'agreement over every string up to a length bound is evidence; a single disagreement refutes the classification',
        detail: 'A language described as regular by somebody\'s intuition is a claim, and the ' +
          'cheap way to test it is to build the automaton and run both. That is the same ' +
          'discipline as the batch tester in the next section and as the published test vectors ' +
          'in the cryptography milestone: agreement with an independent definition is what makes ' +
          'a result rather than an impression.',
        example: 'The "ends in abb" row is checked with a 4-state minimal automaton over all 127 ' +
          'strings, with 0 disagreements.'
      },
      {
        term: 'The boundary decides which tool the job needs',
        plain: '"Can a regex do this" has an answer, and it saves the argument.',
        formal: 'if membership requires an unbounded counter, no regular expression suffices, whatever its syntax suggests',
        detail: 'Patterns that appear to match balanced parentheses are using backreferences or ' +
          'recursive extensions, which leave the class entirely — so the answer is not "it is ' +
          'hard" but "the thing you are describing is not a regular expression". Recognising ' +
          'that points at the right replacement: a parser, an explicit counter, or a restructured ' +
          'input format that needs neither.',
        example: 'The demo’s catalogue puts balanced-nesting languages one level up and names the ' +
          'stack as the reason.'
      }
    ],

    'deterministic-finite-automata': [
      {
        term: 'A DFA is five things',
        plain: 'States, alphabet, transition function, start state, accepting set.',
        formal: 'M = (Q, Σ, δ, q₀, F) with δ: Q × Σ → Q',
        readAs: 'A machine is a set of states, an alphabet, a transition function taking a state ' +
          'and a symbol to a state, a start state, and a set of accepting states.',
        detail: 'The transition function is total in the textbook definition and partial in most ' +
          'implementations, and the difference is exactly one trap state. It matters more than ' +
          'it looks: complement flips the accepting set, so a partial machine complemented ' +
          'without adding the trap accepts every string that used to fall off the end. Section ' +
          '24.6 pays for that in its first construction.',
        example: 'The demo prints the whole five-tuple as a table, with the meaning of each state ' +
          'in the last column.'
      },
      {
        term: 'A state is what still matters, not what happened',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the whole prefix read so far"] --> B["almost all of it is<br/>irrelevant to the future"]',
            '    B --> C["keep only what changes<br/>what happens next"]',
            '    C --> D["that residue is the state"]',
            '    D --> E["designing a DFA is deciding<br/>what may safely be forgotten"]'
          ].join('\n'),
          caption: 'The hard part is never drawing the machine. It is naming the smallest thing you must remember, and being certain nothing else can matter.'
        },
        plain: 'Designing a DFA is naming exactly what has to be remembered.',
        formal: 'two prefixes are the same state when no continuation distinguishes them',
        detail: 'That is Myhill–Nerode stated informally, and it is the test for whether a state ' +
          'set is right. For divisibility the answer is a remainder, for a suffix check it is how ' +
          'much of the target the tail already matches, for parity it is one bit. Once the ' +
          'quantity is named the transitions follow mechanically, and a state whose meaning ' +
          'cannot be stated in a sentence is either redundant or a bug.',
        example: 'The demo builds its divisibility machines from the formula r → (2r + b) mod k ' +
          'rather than drawing them, because the arithmetic IS the transition function.'
      },
      {
        term: 'Divisibility by k needs exactly k states',
        plain: 'The remainder is everything a longer prefix contributes.',
        formal: 'reading a binary numeral left to right, r → (2r + b) mod k',
        readAs: 'Each new bit doubles the value so far and adds itself, so the remainder modulo ' +
          'k transforms by doubling and adding the bit, then reducing.',
        detail: 'Two numerals with the same remainder are interchangeable for every possible ' +
          'continuation, which is precisely the condition for being the same state — so the ' +
          'machine has one state per remainder and no more. The numbers get arbitrarily large ' +
          'and the machine does not, which is the clearest example of the collapse a state ' +
          'represents.',
        example: 'The demo runs divisibility by 3 with 3 states and by 7 with 7, both agreeing ' +
          'with real arithmetic on all 511 binary strings up to length 8.'
      },
      {
        term: 'Flags multiply and that is the design budget',
        plain: 'Three independent booleans is eight states.',
        formal: 'independent components combine as a product, so the state count is the product of the component counts',
        detail: 'A state machine assembled from flags becomes unreadable long before it becomes ' +
          'wrong, and the useful move is usually to find the single quantity that subsumes them. ' +
          'This is the same arithmetic behind the product construction in section 24.6 and behind ' +
          'orthogonal regions in statecharts, which exist precisely so that independent ' +
          'components can be drawn side by side instead of multiplied out.',
        example: 'The demo’s pattern table gives the state count per design pattern, with 2^flags ' +
          'as the entry for independent booleans.'
      },
      {
        term: 'A trap state is where rejection becomes permanent',
        plain: 'The machine has decided no continuation can help.',
        formal: 'a total transition function needs a sink state from which no accepting state is reachable',
        detail: 'Leaving it implicit makes the implementation smaller and every operation that ' +
          'depends on totality wrong. Complement is the obvious one; the subtler one is state ' +
          'counting, because a minimal TOTAL machine has one more state than a minimal trimmed ' +
          'one and comparing the two makes correct algorithms look like they disagree. Deciding ' +
          'which convention you are using, once, is the fix.',
        example: 'The demo’s "never three a in a row" machine has 4 states: three counting states ' +
          'and the trap.'
      },
      {
        term: 'The batch tester is the check that matters',
        plain: 'A machine checked against its own trace always passes.',
        formal: 'agreement with an independent definition over every string up to a bound',
        detail: 'A hand-drawn DFA that is subtly wrong accepts a plausible-looking set of strings ' +
          'and behaves consistently with itself forever. Running it against arithmetic, a suffix ' +
          'test or a count — something that was not derived from the machine — is what turns ' +
          '"this looks right" into a result. It is the same argument as checking a cipher against ' +
          'a published vector rather than against your own implementation.',
        example: 'Every machine in the demo reports agreement over all 511 strings up to length ' +
          '8, broken down by length.'
      },
      {
        term: 'The minimal machine is unique, so "am I done" is decidable',
        plain: 'A computer can tell you whether your state set is right.',
        formal: 'the number of Myhill–Nerode classes is both the lower and the upper bound on states',
        detail: 'That is a rare property. Most design questions — is this abstraction right, is ' +
          'this interface too wide — have no algorithmic answer, and this one does: compute the ' +
          'equivalence classes of the language and compare the count. Fewer states than classes ' +
          'is impossible, more is redundancy, and equal means finished.',
        example: 'The demo reports "already minimal" per machine, comparing the state count with ' +
          'a brute-force class count.'
      },
      {
        term: 'This is the same discipline as designing component state',
        plain: '"What must this remember" is the question behind a reducer or a protocol endpoint.',
        formal: 'a state machine with a state per history is unenumerable and therefore untestable',
        detail: 'When a component\'s state grows a field per thing that has happened rather than ' +
          'per thing that still matters, the set of reachable configurations stops being ' +
          'enumerable and nobody can test it. The divisibility machines are the antidote in ' +
          'miniature: a numeral of any length collapses to a remainder because two prefixes with ' +
          'the same remainder are interchangeable, and finding that collapse is the whole design ' +
          'exercise.',
        example: 'The demo’s pattern table maps each shape to where it turns up: protocol phases, ' +
          'rate limiting, feature toggles, request lifecycles.'
      }
    ],

    'nondeterminism-and-subsets': [
      {
        term: 'An NFA does not guess; it is in a SET of states',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["currently in states {1, 4, 7}"] --> B["read the next symbol"]',
            '    B --> C["advance every one of them"]',
            '    C --> D["union the results:<br/>now in {2, 5}"]',
            '    D --> E["nothing was chosen,<br/>so nothing is ever backtracked"]'
          ].join('\n'),
          caption: 'Nondeterminism is a description, not an implementation. The machine is not lucky — it tracks every possibility at once, which is exactly what the subset construction writes down.'
        },
        plain: 'Running it means advancing the set, and nothing is ever backtracked.',
        formal: 'δ: Q × Σ → 2^Q, and a word is accepted when the reachable set meets F',
        readAs: 'The transition function takes a state and a symbol to a SET of states, and a ' +
          'word is accepted when the set reachable after reading it contains an accepting state.',
        detail: 'The "guessing" language in textbooks is a description of the acceptance ' +
          'condition, not of any implementation. A simulator carries every possibility forward ' +
          'at once, which costs O(states) per character and no backtracking at all — and that is ' +
          'exactly the linear-time matching that section 24.9 contrasts with catastrophic ' +
          'backtracking.',
        example: 'The demo prints the active set per input symbol, and it is up to 3 states wide ' +
          'on the default pattern.'
      },
      {
        term: 'ε-transitions change state without reading',
        plain: 'They make Thompson’s construction compositional, and every step costs a closure.',
        formal: 'the ε-closure of a set is everything reachable from it by ε-edges alone',
        readAs: 'The epsilon-closure of a set of states is that set together with everything ' +
          'you can reach from it by following transitions that consume no input.',
        detail: 'Every fragment of Thompson\'s construction has one entry and one exit, so any ' +
          'fragment drops into any hole — and that is only possible because ε-edges can glue ' +
          'them without consuming input. The cost is that "where am I" means "the ε-closure of ' +
          'where I am", computed before and after every move, and that anything reasoning about ' +
          'PATHS rather than about the language has to remove them first.',
        example: 'The demo reports the state count before and after ε-removal, and the ReDoS ' +
          'analyser in 24.9 works on an ε-free machine for exactly this reason.'
      },
      {
        term: 'Nondeterminism buys conciseness, never power',
        plain: 'NFAs and DFAs recognise exactly the same languages.',
        formal: 'the subset construction converts any NFA to a DFA accepting the same language',
        detail: 'The proof is constructive, which is the useful part: run it and you have the ' +
          'machine. What changes is size — an NFA can be exponentially smaller than any ' +
          'equivalent DFA — so the choice between them is a space-versus-time decision rather ' +
          'than an expressiveness one. Every regex engine makes that decision somewhere.',
        example: 'The demo checks the NFA and its determinisation over all 1 023 strings up to ' +
          'length 9 and they agree.'
      },
      {
        term: 'A DFA state is a reachable SET of NFA states',
        plain: 'The DFA remembers every guess the NFA could still be making.',
        formal: 'the subset construction builds one state per reachable element of 2^Q, so at most 2ⁿ',
        readAs: 'Each deterministic state corresponds to a set of nondeterministic states, and ' +
          'there are at most two-to-the-n such sets.',
        detail: 'A subset state is accepting exactly when it CONTAINS an accepting NFA state — ' +
          'one surviving possibility is enough, which is what nondeterministic acceptance means. ' +
          'Naming each DFA state after its subset makes the determinisation stop being ' +
          'mysterious: the machine can track every open guess with one state because there are ' +
          'only finitely many sets of guesses.',
        example: 'The demo labels each DFA state with its members and marks which contain an ' +
          'accepting NFA state.'
      },
      {
        term: 'The exponential family is real, and the bound is exact',
        plain: '`(a|b)*a(a|b)^n` needs 2^(n+1) states.',
        formal: 'the minimal DFA must remember which of the last n + 1 positions held an a, so it has 2^(n+1) states',
        readAs: 'The machine has to remember, for each of the last n plus one positions, whether ' +
          'the symbol there was an a — and there are two-to-the-n-plus-one such records.',
        detail: 'The NFA needs only n + 2 states because it can commit to a guess about where the ' +
          'marked `a` is and let the wrong guesses die. The DFA cannot guess, so it carries every ' +
          'possibility, and the count of possibilities is a subset. This is the canonical ' +
          'demonstration that the exponential in the subset construction is not an artefact of a ' +
          'lazy implementation.',
        example: 'The demo measures 256 minimal states at n = 7 against 18 positions, matching ' +
          'the predicted 2^8 exactly.'
      },
      {
        term: 'The subset construction lands one state above the bound',
        plain: 'Two of the subsets it builds denote the same language, and it cannot tell.',
        formal: 'determinisation is exact about the exponent and needs minimisation for the constant',
        detail: 'The construction builds a state per reachable subset, and reachable subsets are ' +
          'not the same thing as distinguishable languages — so it over-produces. Minimisation ' +
          'removes exactly the surplus. Reporting both numbers is the honest form of "the subset ' +
          'construction is 2^n", and the gap is a reminder that determinising and minimising are ' +
          'two passes rather than one.',
        example: 'The demo shows 257 subset states against 256 minimal ones at n = 7, and the ' +
          'same off-by-one at every smaller n.'
      },
      {
        term: 'Real engines determinise lazily',
        plain: 'Build DFA states on demand as input arrives, and cache them.',
        formal: 'a bounded cache of reachable subsets gives amortised O(1) per character with bounded memory',
        detail: 'A pattern of twenty characters can have a million-state DFA, and any single ' +
          'input visits a handful of them, so materialising the whole machine is waste. RE2 and ' +
          'Go\'s regexp build states on demand and flush the cache when it grows too large, ' +
          'which gets the constant-time step of a DFA with the bounded memory of a simulation. ' +
          'That shape — precompute would be enormous, any run touches a fraction — also produces ' +
          'JIT compilation and incremental index builds.',
        example: 'The demo counts how many of the construction’s transitions produced a state ' +
          'nobody had seen before, which is the fraction a lazy engine would pay for.'
      },
      {
        term: 'Or they do not determinise at all',
        plain: 'Simulating the state set is linear in the input, whatever the pattern.',
        formal: 'O(|Q|) work per character and O(|Q|) memory, with no dependence on ambiguity',
        detail: 'This is Thompson\'s 1968 algorithm and it is immune both to the state explosion ' +
          'and to catastrophic backtracking, because it never explores a path twice and never ' +
          'builds a state it does not need. grep, RE2, Go and Rust all offer it; the language ' +
          'runtimes that do not are the ones with ReDoS incidents, and the reason they cannot is ' +
          'backreferences rather than an implementation choice.',
        example: 'Section 24.9 measures the same match both ways: 100 simulation steps against ' +
          '425 979 backtracking steps.'
      }
    ],

    'regular-expressions-and-constructions': [
      {
        term: 'Kleene’s theorem, in both directions',
        plain: 'Regular expressions and finite automata describe exactly the same languages.',
        formal: 'every regular expression has an equivalent automaton, and every automaton has an equivalent expression',
        detail: 'Both halves are constructive, which is what makes the section runnable rather ' +
          'than a proof to read: Thompson, Glushkov and derivatives all take an expression to a ' +
          'machine, and state elimination takes a machine back to an expression. Having both ' +
          'directions is what lets a tool minimise a pattern by round-tripping it through its ' +
          'automaton.',
        example: 'The demo round-trips every pattern through the minimal machine and checks the ' +
          'result accepts the same language.'
      },
      {
        term: 'Thompson’s construction is compositional and wasteful',
        plain: 'Two fresh states per operator, glued with ε, nothing shared.',
        formal: 'at most 2m states for a pattern with m symbols, and every fragment has one entry and one exit',
        detail: 'The single-entry, single-exit shape is what makes the construction trivially ' +
          'correct — any fragment can be dropped into any hole — and it is also why it is the ' +
          'largest of the three. Nothing is ever merged, so a star costs two states beyond its ' +
          'body and an alternation costs two beyond both branches. For a matcher that will be ' +
          'determinised anyway, the waste does not survive; for anything reasoning about the ' +
          'machine directly, it matters.',
        example: 'The demo measures 14 Thompson states against 6 Glushkov states for the same ' +
          'pattern — a factor of 2.33.'
      },
      {
        term: 'Glushkov gives one state per literal and no ε-edges',
        plain: 'Number the literals, compute first, last and follow, read the machine off.',
        formal: 'states are the literal positions plus a start; edges follow the follow-sets',
        detail: 'The position automaton is smaller than Thompson\'s and, more importantly, it is ' +
          'POSITION-FAITHFUL: two distinct runs on a word correspond to two genuinely different ' +
          'ways of assigning input characters to pattern positions. That is what makes it the ' +
          'right machine for ambiguity analysis, where Thompson\'s ε-edges make one run look ' +
          'like several and every pattern appear vulnerable.',
        example: 'Section 24.9 runs its overlap detector on the Glushkov machine and gets 9 of 9 ' +
          'verdicts right.'
      },
      {
        term: 'A derivative is the pattern that must still match',
        plain: 'The state IS a regular expression, so you can read what it is waiting for.',
        formal: 'the derivative of R by a is the language {w : aw ∈ L(R)}, and it is computable syntactically',
        readAs: 'The derivative of a pattern with respect to a symbol denotes exactly the strings ' +
          'that would complete a match once that symbol has been read.',
        detail: 'Building the DFA is then a worklist over derivatives with no graph, no ' +
          'ε-transitions and no subset construction, and the result is already deterministic and ' +
          'usually close to minimal. The readability is the underrated part: a subset state named ' +
          '`{n1,n4,n7}` tells you nothing, and a derivative named `(a|b)*abb` tells you what the ' +
          'machine is still expecting. That is why verified matchers are built this way.',
        example: 'The demo lists the derivatives as DFA states, and each row is a readable ' +
          'pattern with its acceptance condition beside it.'
      },
      {
        term: 'Derivatives terminate only because of the similarity rules',
        plain: 'Without them the derivative set grows forever.',
        formal: 'associativity, commutativity and idempotence of alternation, plus the identities for ∅ and ε',
        readAs: 'Treating alternation as unordered and duplicate-free, and simplifying anything ' +
          'concatenated with the empty language or the empty string, is the minimum that keeps ' +
          'the set of derivatives finite.',
        detail: 'The derivatives of `a*` are `a*`, then `ε·a*`, then `ε·(ε·a*)` and onwards — all ' +
          'denoting the same language and none equal as trees, so a worklist keyed on the tree ' +
          'never empties. Brzozowski\'s rules identify them. It is the rare case where the ' +
          'termination argument is the whole difficulty and the construction itself is three ' +
          'lines.',
        example: 'The demo’s derivative construction closes on 4 states for the default pattern ' +
          'and reports whether it was truncated.'
      },
      {
        term: 'State elimination goes back, and the order changes the answer',
        plain: 'Every elimination order is correct and they produce different expressions.',
        formal: 'removing a state reroutes each incoming label through its own loop to each outgoing label',
        detail: 'The asymmetry with minimisation is worth holding onto: the minimal AUTOMATON is ' +
          'unique and the minimal regular EXPRESSION is not, and there is no canonical form to ' +
          'aim at. Tools that do this pick an elimination order heuristically — fewest incoming ' +
          'times outgoing edges first — and still produce expressions nobody wants to read, which ' +
          'is why round-tripping a pattern is a checking technique rather than a formatting one.',
        example: 'The demo runs two elimination orders on the same machine and gets expressions ' +
          'of 40 and 44 characters.'
      },
      {
        term: 'The constructions are checked against each other',
        plain: 'Three machines, one language, compared string by string.',
        formal: 'exhaustive agreement over every string up to a length bound, in every pair',
        detail: 'A construction that is subtly wrong produces a plausible machine that behaves ' +
          'consistently with itself, so the only detector is another construction that was ' +
          'written differently. Running Thompson, Glushkov and the derivative DFA against each ' +
          'other over hundreds of strings is cheap and catches the class of bug that unit tests ' +
          'on hand-picked examples do not.',
        example: 'The demo reports agreement over 511 strings for each of the two comparisons.'
      },
      {
        term: 'Backreferences leave the class entirely',
        plain: 'They can require matching `ww`, which no finite automaton does.',
        formal: 'matching a regular expression with backreferences is NP-hard',
        detail: 'The syntax hides it completely: a backreference sits in the same string, is ' +
          'passed to the same function, and looks like a regular expression. But it can require ' +
          'the engine to remember an unbounded captured string, so no linear-time simulation ' +
          'exists and every engine supporting it must backtrack. That single feature is why ' +
          'JavaScript, Python and PCRE cannot offer RE2\'s linear-time guarantee — a consequence ' +
          'of the language class rather than an implementation choice.',
        example: 'The demo’s extension table separates the regular operators from the three that ' +
          'are not, with what each one costs.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
