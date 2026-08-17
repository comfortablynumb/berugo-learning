# M24 — Regular languages and finite automata

> **Track** Automata, languages and compilers · **Depends on** M02, M13 · **Sections** 11 · **Effort** L

**Outcome.** The theory that engineers touch daily without naming it: every regex, tokeniser,
protocol state machine and UI statechart is a finite automaton. The milestone builds a complete
automaton toolkit — construct, convert, minimise, compare — and then shows the same objects running
production tasks.

**Shared machinery introduced.** `machines/automaton.js` — a shared representation for DFA, NFA,
ε-NFA and transducers with execution traces, plus conversions between all of them;
`viz/automaton-view.js` — state-graph rendering with live current-state highlighting and transition
animation, reused by M25, M32, M49 and M54. Mermaid state diagrams render the static structure;
`automaton-view` handles the animated execution.

---

## Sections

### 24.1 Languages and the hierarchy
- **Covers** — alphabets, strings, concatenation and Kleene star, languages as sets, the operations
  that define language classes, the Chomsky hierarchy with a representative problem for each level,
  and how the hierarchy maps onto real tooling (regex, parsers, type checkers, interpreters).
- **Demo** — hierarchy explorer: pick a language description and the tool shows which class it
  belongs to, which machine recognises it and a concrete recogniser running on sample strings.
- **Diagram** — mermaid diagram of the four nested language classes with an example and a machine
  for each.
- **Lab** — classify ten languages by the weakest machine that recognises them; graded with an
  explanation for each, including the near-miss cases (`aⁿbⁿ` versus `a*b*`).
- **Senior insight** — "can a regex do this" has a precise answer, and it is the difference between
  a five-line tokeniser and a parser. Knowing where the boundary sits saves the argument.

### 24.2 Deterministic finite automata
- **Covers** — the five-tuple definition, the transition function, accepting runs, total versus
  partial transition functions and the trap state, DFA design patterns (counting modulo k, tracking
  a suffix, checking divisibility), and the state as "everything you need to remember".
- **Demo** — DFA builder: place states, draw transitions, then run strings with the current state
  highlighted and the trace listed; a batch tester runs a whole string set and marks accept/reject.
- **Diagram** — mermaid state diagram of a DFA accepting binary numbers divisible by three.
- **Lab** — build a DFA that accepts binary strings divisible by 7; tests assert correctness on all
  strings up to length 14 against a numeric oracle.
- **Senior insight** — designing a DFA is the exercise of naming exactly what must be remembered,
  which is the same discipline as designing the state of a component or a protocol endpoint.

### 24.3 Nondeterminism and the subset construction
- **Covers** — NFAs, multiple transitions, ε-transitions, the parallel-run intuition, ε-closure,
  the subset construction, the exponential worst case with the canonical (a|b)*a(a|b)^{n} family,
  lazy/on-the-fly determinisation, and why NFAs are the natural target of regex compilation.
- **Demo** — NFA execution showing the *set* of active states advancing per character, then the
  subset construction building the equivalent DFA state by state, with the state count plotted
  against n for the exponential family.
- **Diagram** — mermaid diagram of an NFA and the DFA state that corresponds to a set of its states.
- **Lab** — implement ε-closure and the subset construction; tests assert language equivalence with
  the source NFA over exhaustive strings up to a length bound.
- **Senior insight** — lazy determinisation is what real regex engines do: build DFA states on
  demand and cache them, which keeps the common case linear without paying the exponential up front.

### 24.4 Regular expressions and their constructions
- **Covers** — regex syntax and formal semantics, the equivalence of regexes and finite automata,
  Thompson's construction, Glushkov/position automata, Brzozowski derivatives as a construction that
  needs no graph at all, Kleene's theorem (automaton → regex) by state elimination, and the
  extensions that make "regex" no longer regular (backreferences, lookaround).
- **Demo** — type a regex and watch all three constructions build in parallel — Thompson NFA,
  Glushkov NFA and the derivative-based DFA — with state counts compared and each machine runnable
  on test strings.
- **Diagram** — mermaid diagram of Thompson's fragments for concatenation, alternation and star.
- **Lab** — implement Brzozowski derivatives with similarity-based simplification; tests assert the
  resulting DFA accepts exactly the same strings as a reference matcher and terminates on all
  fixtures.
- **Senior insight** — backreferences make matching NP-hard and remove every guarantee in this
  section. The moment a pattern uses one, it is no longer a regular expression in any sense that
  the theory covers.

### 24.5 Minimisation and canonical forms
- **Covers** — Myhill–Nerode equivalence classes and the unique minimal DFA, Moore's partition
  refinement, Hopcroft's O(n log n) algorithm, Brzozowski's double-reversal trick, minimisation as
  the basis of equivalence testing, and minimising with unreachable and dead states removed first.
- **Demo** — partition refinement animated: states grouped, split by distinguishing input, until
  stable; the minimal DFA is drawn alongside the original with the state-count reduction reported.
- **Diagram** — mermaid diagram of a partition splitting on a distinguishing transition.
- **Lab** — implement Hopcroft's algorithm; tests assert the result is minimal (verified against a
  brute-force Myhill–Nerode computation) and language-equivalent on exhaustive strings.
- **Senior insight** — the minimal DFA is unique, which is what makes "are these two regexes
  equivalent" a decidable question you can answer in code — and it is how you refactor a monstrous
  pattern with confidence.

### 24.6 Closure properties and the product construction
- **Covers** — closure under union, intersection, complement, difference, concatenation, star,
  reversal and homomorphism; the product construction for intersection and difference; complement
  requiring a total DFA; and using these to decide containment and equivalence.
- **Demo** — pick two automata and an operation and watch the product construction build the result,
  with the accepting-state rule shown per operation; a containment checker reports the shortest
  counter-example string when containment fails.
- **Diagram** — mermaid diagram of the product state (p, q) advancing on one symbol.
- **Lab** — implement automaton intersection and an emptiness check, then use them to decide
  "does regex A match anything regex B does not"; tests assert correct answers and correct
  counter-examples on fixtures.
- **Senior insight** — "does this new firewall rule allow anything the old one did not" is regular-
  language containment, and it is decidable — a rare case where a real policy question has an exact
  algorithmic answer.

### 24.7 Proving a language is not regular
- **Covers** — the pumping lemma with its quantifier structure and the adversary game, common
  misuses, Myhill–Nerode as the stronger and more usable tool, distinguishing-set arguments, and a
  catalogue of the classic non-regular languages and why each one fails.
- **Demo** — the pumping game: the learner picks the decomposition, the tool plays the adversary (or
  the reverse), making the quantifier alternation concrete; a Myhill–Nerode panel builds an infinite
  family of pairwise-distinguishable prefixes.
- **Diagram** — mermaid diagram of the pumping-lemma quantifier alternation as a two-player game.
- **Lab** — prove `{aⁿbⁿ}` non-regular by constructing a distinguishing set programmatically; tests
  assert the produced prefixes are pairwise distinguishable by an explicit witness suffix.
- **Senior insight** — Myhill–Nerode also *builds* the minimal automaton when the language is
  regular, so it is one tool that answers both questions. The pumping lemma only ever says no.

### 24.8 Transducers
- **Covers** — Mealy and Moore machines, finite-state transducers with input/output labels,
  composition of transducers, weighted transducers, applications to text normalisation, tokenising
  with output, morphological analysis, and the FST pipelines used in speech and NLP.
- **Demo** — build a transducer that normalises text (case folding, whitespace collapsing, number
  expansion), then compose it with a second transducer and watch the composed machine process input
  in one pass.
- **Diagram** — mermaid state diagram of a Mealy machine with input/output labels on transitions.
- **Lab** — implement transducer composition; tests assert the composed machine's output equals
  applying the two machines in sequence, for randomised inputs.
- **Senior insight** — composing transducers instead of chaining string passes is how text pipelines
  stay linear-time and lossless; each intermediate string you materialise is a copy and a chance to
  lose position information.

### 24.9 Automata in production
- **Covers** — lexer generation from regular definitions with maximal munch and priority rules,
  protocol state machines (TCP from M49, HTTP parsers), UI statecharts with hierarchy, orthogonal
  regions and history states, table-driven versus code-generated automata, and analysing a regex for
  ReDoS by inspecting its NFA for ambiguity.
- **Demo** — a generated lexer for a small language with the DFA drawn and maximal-munch decisions
  highlighted; a ReDoS analyser flags patterns whose NFA contains the ambiguous-star structure and
  demonstrates the blow-up with a generated attack string.
- **Diagram** — mermaid state diagram of a statechart with a nested region and a history state.
- **Lab** — implement the maximal-munch scanner loop with token priorities; tests assert correct
  tokenisation of tricky inputs (`>>=` versus `>>` `=`, keywords versus identifiers, longest-match
  ties resolved by priority).
- **Senior insight** — the ReDoS analysis is mechanical: a star over an ambiguous sub-expression is
  the structure to search for, and it can be a CI check rather than an incident.

### 24.10 Weighted and probabilistic automata
- **Covers** — adding weights over a semiring, shortest-path decoding as the general operation,
  hidden Markov models as probabilistic automata, the Viterbi algorithm, forward–backward, weighted
  FSTs and their composition, and the applications (sequence labelling, spell correction, decoding).
- **Demo** — an HMM part-of-speech or noisy-channel spelling demo: emissions and transitions shown
  as a trellis with the Viterbi path highlighted and the forward probabilities filled in.
- **Diagram** — mermaid diagram of a trellis with the best path through it marked.
- **Lab** — implement Viterbi decoding with log-domain arithmetic; tests assert the returned path is
  the maximum-probability one against brute-force enumeration on small models, and that log-domain
  arithmetic avoids the underflow the naive version hits.
- **Senior insight** — Viterbi is dynamic programming (M12) on a trellis; recognising that is what
  lets you build a decoder for a new domain without looking up an algorithm.

### 24.11 Automata over infinite words
- **Covers** — why infinite words are the right model for reactive systems, Büchi automata and their
  acceptance condition, safety versus liveness properties, LTL and its automaton translation,
  determinisation difficulties (and why Rabin/Streett/parity conditions exist), and the connection
  to model checking in M32.
- **Demo** — a Büchi automaton for "the request is eventually granted" runs against generated
  infinite traces (lasso-shaped) with the accepting-state visits highlighted; a counter-example
  trace is produced when the property fails.
- **Diagram** — mermaid state diagram of a Büchi automaton with the accepting state marked and a
  lasso trace overlaid.
- **Lab** — implement the lasso-based emptiness check (nested depth-first search) for a Büchi
  automaton; tests assert detection of accepting cycles on fixtures and correct rejection when none
  exists.
- **Senior insight** — safety properties fail on a finite prefix and liveness properties never do,
  which is exactly why liveness bugs survive testing and need model checking or careful reasoning.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/automaton.js` | DFA/NFA/ε-NFA/transducer representation, execution, conversions |
| `src/js/algorithms/regex-compile.js` | Parser, Thompson, Glushkov, Brzozowski derivatives |
| `src/js/algorithms/minimization.js` | Moore, Hopcroft, Brzozowski, equivalence testing |
| `src/js/algorithms/automaton-ops.js` | Product, complement, containment, counter-example extraction |
| `src/js/algorithms/transducer.js` | Mealy/Moore, FST composition, weighted variants |
| `src/js/algorithms/lexer-gen.js` | Regular definitions to a maximal-munch scanner |
| `src/js/algorithms/redos-analysis.js` | NFA ambiguity detection and attack-string generation |
| `src/js/algorithms/hmm.js` | Viterbi, forward–backward in the log domain |
| `src/js/algorithms/buchi.js` | Büchi automata, LTL translation, nested DFS emptiness |
| `src/js/viz/automaton-view.js` | Animated state-graph rendering |

---

## Acceptance criteria

- [ ] Every conversion (regex → NFA → DFA → minimal DFA → regex) is verified by exhaustive string
      testing up to a length bound, in both directions.
- [ ] Hopcroft's output is asserted minimal against a brute-force Myhill–Nerode computation.
- [ ] The exponential subset-construction family produces the predicted state counts, measured.
- [ ] Containment and equivalence checks return a genuine counter-example string whenever they
      report inequality, validated by running both machines on it.
- [ ] The ReDoS analyser flags the known-bad patterns and generates strings that measurably blow up
      a backtracking engine while leaving the NFA simulation linear.
- [ ] Viterbi matches brute-force decoding on all small fixtures, in the log domain.

---

## Sources

- Sipser — *Introduction to the Theory of Computation*
- Hopcroft, Motwani, Ullman — *Introduction to Automata Theory, Languages, and Computation*
- Thompson — *Regular expression search algorithm*
- Brzozowski — *Derivatives of regular expressions*
- Hopcroft — *An n log n algorithm for minimizing states in a finite automaton*
- Owens, Reppy, Turon — *Regular-expression derivatives reexamined*
- Mohri — *Weighted finite-state transducer algorithms: an overview*
- Vardi, Wolper — *An automata-theoretic approach to automatic program verification*
