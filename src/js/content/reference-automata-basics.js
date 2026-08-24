/** Reference entries for languages, DFAs, NFAs and regexes (M24.1-M24.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'languages-and-the-hierarchy': {
      summary: 'Eight languages with a real recogniser each, run over every string up to a ' +
        'length bound, and a finite automaton checked string by string wherever one exists.',
      intuition: 'The hierarchy is about how much memory a recogniser must carry, not about how ' +
        'complicated the language looks.',
      formulation: {
        equations: [
          {
            label: 'The four levels and their machines',
            expr: 'regular ⊂ context-free ⊂ context-sensitive ⊂ recursively enumerable',
            readAs: 'Every regular language is context-free, every context-free language is ' +
              'context-sensitive, and every context-sensitive language is recursively ' +
              'enumerable — each containment strict.',
            terms: [
              { sym: 'regular', meaning: 'finite automaton — bounded memory whatever the input length' },
              { sym: 'context-free', meaning: 'pushdown automaton — one stack, so one unbounded count' },
              { sym: 'context-sensitive', meaning: 'linear-bounded automaton — a tape as long as the input' },
              { sym: 'recursively enumerable', meaning: 'Turing machine — an unbounded tape, and undecidability beyond it' }
            ]
          },
          {
            label: 'The catalogue, checked over 127 strings up to length 6',
            expr: 'language · class · accepted · a finite automaton agrees',
            terms: [
              { sym: 'even number of a', meaning: 'regular · 64 accepted · yes, 2 states' },
              { sym: 'ends in abb', meaning: 'regular · 15 accepted · yes, 4 states' },
              { sym: 'aⁿbⁿ', meaning: 'context-free · 4 accepted · no automaton exists' },
              { sym: 'aⁿbⁿcⁿ', meaning: 'context-sensitive · 3 accepted over 1 093 strings · no' }
            ]
          },
          {
            label: 'Closure, by level',
            expr: 'which operations keep you inside the class',
            terms: [
              { sym: 'regular', meaning: '∪, ∩, complement, ∖, concatenation, star, reversal — all of them' },
              { sym: 'context-free', meaning: '∪, concatenation, star only — NOT ∩ or complement' },
              { sym: 'why it matters', meaning: 'containment is decidable for regular languages and undecidable for grammars' },
              { sym: 'the practical case', meaning: 'firewall rules as patterns can be compared exactly; as grammars they cannot' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A classification is checked by running a machine beside the definition',
          why: 'A language somebody calls regular is a claim until an automaton agrees with it string by string.',
          breaks: 'The demo runs the "ends in abb" automaton over all 127 strings and reports 0 disagreements; a single disagreement would refute the row.'
        },
        {
          name: 'The test for the boundary is always "is the count unbounded"',
          why: 'A finite state set holds a bounded amount, so any property needing an unbounded counter is out of reach.',
          breaks: 'a*b* is regular and aⁿbⁿ is not, and the descriptions differ by one word.'
        },
        {
          name: 'Undecidable is kept separate from the four machine levels',
          why: 'A context-sensitive language needs a bigger machine; an undecidable problem needs one that cannot exist.',
          breaks: 'The demo has no recogniser for the halting row and tests 0 strings, which is the honest representation.'
        }
      ],
      complexity: [
        { operation: 'membership, regular', average: 'O(n) with a DFA, one symbol at a time', worst: 'the same — no dependence on the pattern' },
        { operation: 'membership, context-free', average: 'O(n) for deterministic grammars', worst: 'O(n³) in general, by CYK or Earley' },
        { operation: 'membership, context-sensitive', average: 'exponential in general', worst: 'PSPACE-complete' },
        { operation: 'membership, recursively enumerable', average: 'may not terminate on a rejection', worst: 'undecidable in general' },
        { operation: 'equivalence, regular', average: 'minimise both and compare', worst: 'PSPACE-complete from NFAs, polynomial from DFAs' },
        { operation: 'equivalence, context-free', average: 'undecidable', worst: 'undecidable — there is no algorithm' }
      ],
      failureModes: [
        {
          symptom: 'A regex for balanced brackets works on the examples and fails in production.',
          cause: 'Nesting needs an unbounded count, which no regular expression has.',
          fix: 'A parser, an explicit counter, or an input format that does not nest.'
        },
        {
          symptom: 'A pattern with a backreference is treated as a regular expression.',
          cause: 'Backreferences leave the class; matching becomes NP-hard.',
          fix: 'Capture and compare in code, where the comparison is one line and linear.'
        },
        {
          symptom: 'Two grammars are compared for equivalence and the tool never finishes.',
          cause: 'Context-free equivalence is undecidable, not merely expensive.',
          fix: 'Compare the languages at the regular level if you can, or test rather than prove.'
        },
        {
          symptom: 'A "this is regular" claim turns out to be wrong after the code ships.',
          cause: 'The classification was intuition rather than a check.',
          fix: 'Build the automaton and run both over every string up to a bound; a disagreement is the refutation.'
        }
      ],
      inTheWild: [
        'Regex engines, lexer generators and protocol state machines — the entire regular level.',
        'JSON, XML and expression grammars, which need the stack and therefore a parser.',
        'Type checkers, whose agreement constraints are frequently context-sensitive in shape.',
        'Static analysis tools, which hit undecidability and answer with approximations instead.'
      ],
      sources: [
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'the standard treatment of the hierarchy with the proofs' },
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'the reference for constructions and closure properties' },
        { title: 'Chomsky — Three models for the description of language (1956)', note: 'where the hierarchy comes from' },
        { title: 'Kozen — Automata and Computability', note: 'a lecture-per-topic treatment that is unusually readable' }
      ]
    },

    'deterministic-finite-automata': {
      summary: 'Five machines run against an independent definition over every string up to ' +
        'length 8, with the divisibility machines built from arithmetic rather than drawn, and ' +
        'a minimality check against a brute-force class count.',
      intuition: 'A state is what still matters about the past, not what happened — and finding ' +
        'that quantity is the whole design exercise.',
      formulation: {
        equations: [
          {
            label: 'The five-tuple',
            expr: 'M = (Q, Σ, δ, q₀, F), δ: Q × Σ → Q',
            readAs: 'A machine is a finite set of states, an alphabet, a transition function from ' +
              'a state and a symbol to a state, a start state and a set of accepting states.',
            terms: [
              { sym: 'total δ', meaning: 'every (state, symbol) pair has a destination; needs a trap' },
              { sym: 'partial δ', meaning: 'smaller to write, and complement then accepts the wrong half' },
              { sym: 'acceptance', meaning: 'the state after the whole input is in F' },
              { sym: 'cost', meaning: 'one step per symbol, no backtracking, no dependence on the language' }
            ]
          },
          {
            label: 'Divisibility by k, derived rather than drawn',
            expr: 'r → (2r + b) mod k',
            readAs: 'Reading a binary numeral left to right doubles the value and adds the new ' +
              'bit, so the remainder transforms by doubling, adding the bit and reducing.',
            terms: [
              { sym: 'states', meaning: 'exactly k, one per remainder' },
              { sym: 'accepting', meaning: 'r0, and the empty numeral reads as zero' },
              { sym: 'checked', meaning: '511 of 511 strings agree with real arithmetic at k = 3 and k = 7' },
              { sym: 'minimal', meaning: 'k states against k Myhill–Nerode classes' }
            ]
          },
          {
            label: 'Design patterns and their state budgets',
            expr: 'what the state is · how many are needed',
            terms: [
              { sym: 'counting modulo k', meaning: 'the remainder · exactly k' },
              { sym: 'tracking a suffix', meaning: 'how much of the target the tail matches · |target| + 1' },
              { sym: 'independent flags', meaning: 'one bit each · 2^flags, which is why flags multiply' },
              { sym: 'bounded run length', meaning: 'the run so far, capped · the cap plus one, plus a trap' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every machine is checked against an independent definition',
          why: 'A hand-drawn DFA that is subtly wrong is consistent with its own trace forever.',
          breaks: 'The demo compares each machine with arithmetic, a suffix test or a count over all 511 strings up to length 8.'
        },
        {
          name: 'A state whose meaning cannot be stated in a sentence is redundant or wrong',
          why: 'The state set is the design, and the design is a claim about what must be remembered.',
          breaks: 'The demo prints the meaning of every state beside its transitions, which is how a state machine somebody else wrote gets reviewed.'
        },
        {
          name: 'Totality is decided once and used consistently',
          why: 'Complement flips the accepting set, and a minimal total machine has one more state than a minimal trimmed one.',
          breaks: 'Mixing the conventions makes three correct minimisation algorithms appear to disagree.'
        }
      ],
      complexity: [
        { operation: 'recognition', average: 'O(n) — one table lookup per symbol', worst: 'the same, whatever the pattern' },
        { operation: 'construction from a description', average: 'as many states as the quantity to remember has values', worst: 'unbounded, if the quantity is unbounded — then it is not a DFA' },
        { operation: 'divisibility by k', average: 'k states, transitions from arithmetic', worst: 'k states — the numbers grow and the machine does not' },
        { operation: 'suffix of length m', average: 'm + 1 states', worst: 'the same; this is Knuth–Morris–Pratt’s automaton' },
        { operation: 'f independent flags', average: '2^f states', worst: '2^f — which is why orthogonal regions exist' },
        { operation: 'batch verification', average: 'O(|Σ|^bound) strings, one run each', worst: 'exponential in the bound, which is why the bound is 8' }
      ],
      failureModes: [
        {
          symptom: 'A state machine has states nobody can name.',
          cause: 'It grew a state per thing that happened rather than per thing that still matters.',
          fix: 'Find the quantity that subsumes them. If the states cannot be enumerated they cannot be tested.'
        },
        {
          symptom: 'Complementing a machine accepts far too much.',
          cause: 'The transition function was partial and the trap state was implicit.',
          fix: 'Complete before complementing — determinise, add the trap, then flip.'
        },
        {
          symptom: 'A hand-drawn machine passes every test somebody wrote.',
          cause: 'The tests were derived from the machine.',
          fix: 'Check against an independent definition over every string up to a bound.'
        },
        {
          symptom: 'Three booleans became eight states and the diagram is unreadable.',
          cause: 'Independent components were multiplied out instead of drawn side by side.',
          fix: 'Orthogonal regions in a statechart, or a single quantity that replaces the flags.'
        }
      ],
      inTheWild: [
        'TCP connection state, which is a finite automaton with about a dozen states.',
        'Knuth–Morris–Pratt, whose failure function is exactly the suffix-tracking automaton.',
        'React reducers and workflow engines, where "what must this remember" is the same question.',
        'Rate limiters keyed on consecutive failures, which is bounded run length with a trap.'
      ],
      sources: [
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'the five-tuple, design patterns and the standard exercises' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'the clearest statement of what a state represents' },
        { title: 'Harel — Statecharts: a visual formalism for complex systems (1987)', note: 'hierarchy and orthogonal regions, and why flat machines stop scaling' },
        { title: 'Knuth, Morris and Pratt — Fast pattern matching in strings (1977)', note: 'the suffix automaton as a practical algorithm' }
      ]
    },

    'nondeterminism-and-subsets': {
      summary: 'The active state set advancing per character, the subset construction building ' +
        'the DFA one state at a time, and the exponential family measured against 2^(n+1) at ' +
        'every n from 1 to 7.',
      intuition: 'An NFA does not guess; it is in a set of states, and determinising means giving ' +
        'each reachable set a name.',
      formulation: {
        equations: [
          {
            label: 'The subset construction',
            expr: 'the DFA state for a set S on symbol a is ε-closure(⋃ δ(q, a) for q in S)',
            readAs: 'From a set of nondeterministic states, follow the symbol from every member, ' +
              'take the union, and close it under epsilon transitions — that set is one ' +
              'deterministic state.',
            terms: [
              { sym: 'accepting', meaning: 'the subset CONTAINS an accepting state — one survivor is enough' },
              { sym: 'bound', meaning: 'at most 2ⁿ states, one per reachable subset' },
              { sym: 'checked', meaning: 'NFA and DFA agree over all 1 023 strings up to length 9' },
              { sym: 'the leftover', meaning: 'reachable subsets over-count distinguishable languages, so minimisation follows' }
            ]
          },
          {
            label: 'The exponential family (a|b)*a(a|b)^n',
            expr: 'n · positions · subset construction · minimal DFA · 2^(n+1)',
            terms: [
              { sym: 'n = 1', meaning: '6 · 5 · 4 · 4' },
              { sym: 'n = 4', meaning: '12 · 33 · 32 · 32' },
              { sym: 'n = 7', meaning: '18 · 257 · 256 · 256' },
              { sym: 'the pattern', meaning: 'positions grow by 2 per n; the DFA doubles; minimisation removes exactly one state each time' }
            ]
          },
          {
            label: 'What real engines do',
            expr: 'strategy · per character · memory',
            terms: [
              { sym: 'backtracking', meaning: 'exponential worst case · a stack — every ReDoS incident' },
              { sym: 'NFA simulation', meaning: 'O(states) · one state set — grep, RE2, Go, Rust' },
              { sym: 'full determinisation', meaning: 'O(1) · up to 2ⁿ states — lexer generators' },
              { sym: 'lazy determinisation', meaning: 'O(1) amortised · a bounded, flushable cache — the general default' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A determinisation is checked against its source exhaustively',
          why: 'The construction is the proof of a theorem, and an implementation of it can still be wrong.',
          breaks: 'The demo compares the NFA and the DFA over all 1 023 strings up to length 9.'
        },
        {
          name: 'The state count reported for a construction is separated from the minimal count',
          why: 'The subset construction over-produces by exactly one on this family at every n.',
          breaks: 'Reporting only the subset count makes 2^(n+1) look like 2^(n+1) + 1 and the bound look wrong.'
        },
        {
          name: 'Anything reasoning about paths removes ε-transitions first',
          why: 'A state set collapses two distinct runs into one, and ε-edges make "one step" ambiguous.',
          breaks: 'The ReDoS detector in 24.9 finds nothing at all when run on state sets rather than single states.'
        }
      ],
      complexity: [
        { operation: 'ε-closure', average: 'O(states + ε-edges) per call', worst: 'called twice per input symbol' },
        { operation: 'NFA simulation', average: 'O(|Q|) per character', worst: 'the same — immune to ambiguity' },
        { operation: 'subset construction', average: 'one state per reachable subset', worst: '2ⁿ, and the family reaches it' },
        { operation: 'lazy determinisation', average: 'O(1) amortised per character', worst: 'a cache flush, then rebuilding the states the input needs' },
        { operation: 'backtracking match', average: 'linear on most patterns', worst: 'exponential — measured at 425 979 steps in 24.9' },
        { operation: 'minimisation after determinisation', average: 'O(n log n) by Hopcroft', worst: 'removes the surplus the construction could not see' }
      ],
      failureModes: [
        {
          symptom: 'A regex compiles slowly or exhausts memory.',
          cause: 'Full determinisation of a pattern whose DFA is exponential.',
          fix: 'Lazy determinisation with a bounded cache, or simulate the NFA directly.'
        },
        {
          symptom: 'A "linear-time" claim fails on a specific input.',
          cause: 'The engine backtracks; the guarantee only holds for engines that simulate.',
          fix: 'RE2, Go regexp or Rust regex — and no backreferences, which is why they can guarantee it.'
        },
        {
          symptom: 'An ambiguity analysis reports every pattern as vulnerable.',
          cause: 'It is tracking state SETS, so the two runs it needs to compare have already merged.',
          fix: 'Remove ε-transitions, or use the position automaton, and track single states.'
        },
        {
          symptom: 'A determinised machine has more states than the theory predicts.',
          cause: 'Reachable subsets are not the same as distinguishable languages.',
          fix: 'Minimise; the surplus is exactly what refinement removes.'
        }
      ],
      inTheWild: [
        'RE2 and Go’s regexp, which determinise lazily with a flushable cache.',
        'Thompson’s 1968 CTSS implementation, which simulated the NFA directly and is why grep is linear.',
        'Lexer generators, which determinise fully because the pattern set is fixed and small.',
        'Every ReDoS advisory, which is a backtracking engine meeting a pattern this section predicts.'
      ],
      sources: [
        { title: 'Rabin and Scott — Finite automata and their decision problems (1959)', note: 'the subset construction, and the equivalence of NFAs and DFAs' },
        { title: 'Thompson — Regular expression search algorithm (1968)', note: 'the construction and the simulation, in three pages' },
        { title: 'Cox — Regular expression matching can be simple and fast (2007)', note: 'why backtracking engines are slow and what RE2 does instead' },
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'the exponential family and the proof that the bound is tight' }
      ]
    },

    'regular-expressions-and-constructions': {
      summary: 'Thompson, Glushkov and Brzozowski built in parallel on one pattern with their ' +
        'state counts compared and every pair checked exhaustively, then the regex read back off ' +
        'the minimal machine in two elimination orders.',
      intuition: 'Kleene’s theorem is constructive in both directions, and the three forward ' +
        'constructions disagree about size by a factor of three.',
      formulation: {
        equations: [
          {
            label: 'Three constructions on (a|b)*abb',
            expr: 'construction · states · ε-edges · deterministic',
            terms: [
              { sym: 'Thompson', meaning: '14 · yes · no — two states per operator, nothing shared' },
              { sym: 'Glushkov', meaning: '6 · no · no — one state per literal position plus a start' },
              { sym: 'derivatives', meaning: '4 · no · yes — the state IS a regular expression' },
              { sym: 'minimal DFA', meaning: '4 — the derivative construction reached it with no minimisation pass' }
            ]
          },
          {
            label: 'A derivative',
            expr: '∂ₐR = {w : aw ∈ L(R)}, and R accepts ε exactly when the state is accepting',
            readAs: 'The derivative of a pattern by a symbol denotes the strings that would ' +
              'complete a match once that symbol has been read, and a state accepts exactly when ' +
              'its pattern matches the empty string.',
            terms: [
              { sym: 'termination', meaning: 'needs the similarity rules; without them the set is infinite' },
              { sym: 'the rules', meaning: 'associativity, commutativity and idempotence of ∪, plus the ∅ and ε identities' },
              { sym: 'why it matters', meaning: 'a state name tells you what the machine is still waiting for' },
              { sym: 'used by', meaning: 'verified matchers, where the readability is the proof strategy' }
            ]
          },
          {
            label: 'State elimination: the same machine, two orders',
            expr: 'remove a state, reroute each incoming label through its loop to each outgoing label',
            terms: [
              { sym: 'forward order', meaning: '40 characters' },
              { sym: 'reverse order', meaning: '44 characters — 10% longer for the same language' },
              { sym: 'both round-trip', meaning: 'each compiles back to a machine agreeing over 255 strings' },
              { sym: 'the asymmetry', meaning: 'the minimal automaton is unique; the minimal expression is not' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every construction is checked against another one, exhaustively',
          why: 'A construction with a subtle bug produces a machine that is consistent with itself.',
          breaks: 'The demo runs each pair over 511 strings up to length 8 and reports the disagreement count.'
        },
        {
          name: 'The derivative construction only terminates with the similarity rules',
          why: 'Without them the derivatives of a* grow forever as ε·a*, ε·(ε·a*), … all denoting the same language.',
          breaks: 'The worklist never empties, and the demo reports a truncation flag rather than hanging.'
        },
        {
          name: 'A pattern with a backreference is not treated as a regular expression',
          why: 'It can require unbounded memory, so none of the constructions apply.',
          breaks: 'Matching becomes NP-hard, and every guarantee in the section is void.'
        }
      ],
      complexity: [
        { operation: 'Thompson construction', average: 'O(m) states for m symbols, with ε-edges', worst: '2m states — the largest of the three' },
        { operation: 'Glushkov construction', average: 'O(m) states, O(m²) edges', worst: 'the follow-set computation is the quadratic part' },
        { operation: 'derivative construction', average: 'one state per distinct derivative', worst: 'can be exponential; the similarity rules bound it in practice' },
        { operation: 'state elimination', average: 'O(n³) label operations for n states', worst: 'the expression can be exponential in n' },
        { operation: 'matching, simulated', average: 'O(n·|Q|)', worst: 'the same' },
        { operation: 'matching with backreferences', average: 'depends entirely on the input', worst: 'NP-hard — no polynomial algorithm is known' }
      ],
      failureModes: [
        {
          symptom: 'A derivative-based matcher hangs on a pattern.',
          cause: 'The similarity rules are incomplete, so the derivative set never closes.',
          fix: 'Flatten and sort alternations, remove duplicates, apply the ∅ and ε identities.'
        },
        {
          symptom: 'An ambiguity analysis built on Thompson’s NFA flags everything.',
          cause: 'ε-edges make one run appear as several distinct paths.',
          fix: 'Use the position automaton, which is ε-free and position-faithful.'
        },
        {
          symptom: 'A regex read back off a machine is unreadable.',
          cause: 'State elimination produces a correct expression whose size depends on the order.',
          fix: 'Nothing reliable — it is a checking technique, not a formatting one. Pick an order heuristically and expect noise.'
        },
        {
          symptom: 'A pattern using lookahead is slow in every engine.',
          cause: 'The language stays regular, and every mainstream engine implements it by backtracking.',
          fix: 'Restructure the pattern, or split the check into two passes over the input.'
        }
      ],
      inTheWild: [
        'Thompson’s construction inside grep, RE2 and every engine that simulates rather than backtracks.',
        'Glushkov automata inside static analysers that reason about pattern ambiguity.',
        'Brzozowski derivatives inside verified matchers and in the Rust `regex-automata` crate’s DFA builder.',
        'State elimination inside tools that turn a protocol state machine back into a documented pattern.'
      ],
      sources: [
        { title: 'Thompson — Regular expression search algorithm (1968)', note: 'the construction, and the simulation that goes with it' },
        { title: 'Brzozowski — Derivatives of regular expressions (1964)', note: 'the construction and the similarity rules that make it terminate' },
        { title: 'Owens, Reppy and Turon — Regular-expression derivatives reexamined (2009)', note: 'why derivatives are the right basis for a verified matcher' },
        { title: 'Aho, Lam, Sethi and Ullman — Compilers: Principles, Techniques and Tools', note: 'Glushkov positions as the standard lexer-generation route' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
