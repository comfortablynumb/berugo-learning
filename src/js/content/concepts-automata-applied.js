/** Concepts for production automata, weighted machines and Büchi (M24.9-M24.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'automata-in-production': [
      {
        term: 'A lexer is automata in lockstep plus two rules',
        plain: 'Maximal munch takes the longest match; priority breaks ties by declaration order.',
        formal: 'at each position, choose the longest accepting prefix; among equal lengths, the earliest rule',
        detail: 'Everything else about tokenising is bookkeeping. Both rules are places real ' +
          'lexers go wrong, and both are invisible in the output when they are right — a ' +
          'tokeniser that produces the wrong tokens usually fails somewhere else entirely, in ' +
          'the parser, which is why the decisions are worth printing.',
        example: 'The demo tokenises a line and reports every decision, including the shorter ' +
          'matches it passed over.'
      },
      {
        term: 'Maximal munch means scanning past a match that succeeded',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["reading >="] --> B["after > the machine<br/>is in an accepting state"]',
            '    B --> C{"stop here?"}',
            '    C -->|yes| D["you emit > and = —<br/>two wrong tokens"]',
            '    C -->|no| E["keep going while any machine<br/>is still alive"]',
            '    E --> F["remember the last accept,<br/>and back up to it at the end"]'
          ].join('\n'),
          caption: 'The lexer must run past a perfectly good match to find a longer one. Stopping at the first success is the bug that turns >= into two operators.'
        },
        plain: 'Stopping at the first success produces the wrong tokens.',
        formal: 'remember the last accepting length and keep advancing until every rule has died',
        detail: '`>>` matches after two characters and `>>=` after three, so a scanner that ' +
          'returns as soon as a rule accepts emits two tokens where the language has one — and ' +
          'the resulting parse error points nowhere near the problem. The rule is not "try the ' +
          'rules in order until one matches", it is "advance every rule together and remember ' +
          'the furthest acceptance".',
        example: 'The demo shows `shift ">>"` in the passed-over column at the position where ' +
          '`>>=` was taken.'
      },
      {
        term: 'Priority is why `if` is a keyword',
        plain: 'Two rules match the same text at the same length; the earlier one wins.',
        formal: 'ties in length are broken by declaration order, so reordering the rule list changes the language',
        detail: 'Every keyword is also a legal identifier, so the keyword rules and the identifier ' +
          'rule collide on exactly those strings. Generated lexers derive priority from ' +
          'declaration order, which makes the ordering load-bearing and silent — moving the ' +
          'identifier rule up turns `if` into a name and the grammar fails somewhere else. A ' +
          'keyword table checked after tokenising is the usual alternative once the list gets ' +
          'long.',
        example: 'The demo lists which rules match each sample and marks the shadowed ones: three ' +
          'keywords, each also matched by the identifier rule.'
      },
      {
        term: 'A rule matching the empty string loops forever',
        plain: 'A zero-length match consumes nothing and the scanner never advances.',
        formal: 'the scanner must treat a zero-length longest match as an error rather than as a token',
        detail: 'This is the failure mode of a rule list written with `a*` where `a+` was meant, ' +
          'and it is a hang rather than a wrong answer, which makes it worse to diagnose. ' +
          'Rejecting the empty match explicitly turns an infinite loop into an error message ' +
          'naming the position.',
        example: 'The demo’s scanner returns an error position rather than looping when no rule ' +
          'consumes anything.'
      },
      {
        term: 'Statecharts add writability, not power',
        plain: 'Hierarchy, orthogonal regions and history all flatten to an ordinary automaton.',
        formal: 'a statechart denotes a finite automaton; the extensions are notation',
        detail: 'Hierarchy lets a transition on a parent apply to every child, so "cancel returns ' +
          'to idle" is one arrow instead of one per state. Orthogonal regions run two independent ' +
          'machines side by side instead of multiplying into a product, which is what stops ' +
          'three booleans becoming eight states on the page. History resumes a region where it ' +
          'left off. None of it changes what can be expressed, and all of it changes what can be ' +
          'read.',
        example: 'The demo’s diagram is a statechart with a nested region and a history ' +
          'transition, which flattens to a machine with no new capabilities.'
      },
      {
        term: 'Table-driven or code-generated is a real trade',
        plain: 'A transition table is data; a generated switch is faster and checkable.',
        formal: 'tables are inspectable and changeable at runtime; generated code lets the compiler check exhaustiveness',
        detail: 'Lexer generators emit tables because the machine is large and regular and the ' +
          'table compresses well. Hand-written protocol code usually emits a switch, because the ' +
          'machine is small, the compiler can then catch a missing case, and the transitions ' +
          'read as code rather than as indices. Neither is wrong; choosing without noticing there ' +
          'was a choice is.',
        example: 'The demo runs each rule’s DFA separately so the winning rule is observable, ' +
          'which a merged table would hide.'
      },
      {
        term: 'ReDoS is structural, so it can be a CI check',
        plain: 'Two shapes cause it, and both are found by looking at the pattern.',
        formal: 'a repetition over a body that is itself a repetition, or over alternatives with two runs on one word',
        detail: 'That is unusual for a security property: no threat model, no judgement call, no ' +
          'reviewer who already knows the failure — just a graph search over the pattern already ' +
          'in the repository. The two rules find different things and both are needed: `(a*)*` ' +
          'and `a*` have identical position automata, so only the syntax tree separates them, ' +
          'while `(aa|a)*` needs the automaton because its shape looks innocent.',
        example: 'The demo runs the analyser over 9 patterns with known verdicts and gets 9 ' +
          'right, including one that looks dangerous and is not.'
      },
      {
        term: 'And the blow-up is measured against the simulation',
        plain: 'Both matchers return the same answer; only the time differs.',
        formal: 'backtracking is exponential in the repeat count; NFA simulation is linear in the input',
        detail: 'Generating the attack string is part of the analysis: a prefix reaching the ' +
          'ambiguous state, the ambiguous word repeated, and a tail the pattern cannot match. ' +
          'The failing tail is what forces the matcher to try every path before giving up — a ' +
          'string that MATCHES stops at the first success and is harmless, which is why fuzzing ' +
          'with valid inputs finds nothing.',
        example: 'At 16 repeats the demo measures 425 979 backtracking steps against 100 ' +
          'simulation steps, a factor of 4 259.8.'
      }
    ],

    'weighted-and-probabilistic': [
      {
        term: 'Weights turn running a machine into searching it',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["unweighted: does any path accept?"] --> B["a yes or no"]',
            '    C["weighted: combine along a path,<br/>combine between paths"] --> D["a value"]',
            '    D --> E["min and plus: the shortest path"]',
            '    D --> F["plus and times: the total probability"]',
            '    E --> G["same machine, same traversal —<br/>the semiring decides what<br/>you computed"]',
            '    F --> G'
          ].join('\n'),
          caption: 'Two operators are the whole configuration. Viterbi and forward probability are the same code with a different pair plugged in.'
        },
        plain: 'Combine along a path, combine between paths, and the semiring decides what you computed.',
        formal: 'a semiring gives ⊗ along a path and ⊕ between paths; the algorithm never changes',
        readAs: 'One operation combines weights along a single path and another combines the ' +
          'results of different paths, and choosing which pair you use decides whether you get a ' +
          'shortest path, a best decoding, a total probability or an acceptance test.',
        detail: 'The trellis is filled the same way whatever the semiring, which is why one ' +
          'implementation serves all of them. It also reframes the earlier sections: an ordinary ' +
          'automaton is the Boolean case, where "along a path" is conjunction and "between ' +
          'paths" is disjunction — so everything from 24.1 to 24.9 has been a weighted automaton ' +
          'with the weights left out.',
        example: 'The demo tabulates six semirings and what each one computes from the identical ' +
          'algorithm.'
      },
      {
        term: 'A hidden Markov model is an automaton whose states you cannot see',
        plain: 'You observe emissions and want the state sequence that explains them.',
        formal: 'initial, transition and emission distributions; decoding asks for the most probable state path',
        detail: 'That framing is what makes the machinery portable. A part-of-speech tagger, a ' +
          'noisy-channel spell corrector, a gesture recogniser and a network-state estimator are ' +
          'the same object with different vocabulary, so a decoder written once serves all of ' +
          'them — and building one for a new domain becomes a modelling exercise rather than an ' +
          'algorithm to look up.',
        example: 'The demo uses a two-state weather model, small enough that every path can be ' +
          'enumerated as a check.'
      },
      {
        term: 'Viterbi is dynamic programming on a trellis',
        plain: 'One column per observation, one row per state, a back-pointer per cell.',
        formal: 'V(t, s) = max over previous states of V(t−1, s′) + log P(s′ → s) + log P(emit | s)',
        readAs: 'The best score for being in a state at a step is the best score for being in any ' +
          'previous state, plus the log of the transition probability, plus the log of the ' +
          'emission probability.',
        detail: 'It is the same recurrence M12 uses for edit distance and longest common ' +
          'subsequence — best score into a cell plus a pointer, read the answer back along the ' +
          'pointers. What makes it feel like a different subject is the vocabulary. Strip the ' +
          'emissions and priors and it is a grid with a max over predecessors, which means any ' +
          '"hidden choices explaining an observed sequence" problem already has a decoder.',
        example: 'The demo fills 3 columns of 2 cells for a three-observation sequence while the ' +
          'brute force enumerates 8 paths.'
      },
      {
        term: 'The reference must enumerate every path',
        plain: 'A dynamic program with a wrong recurrence returns a plausible path.',
        formal: 'brute force is exponential and correct; it is a test rather than an implementation',
        detail: 'Comparing Viterbi against another dynamic program would confirm a shared ' +
          'assumption. Enumerating all |states|^length paths and scoring each one shares nothing ' +
          'with the recurrence, so it catches an off-by-one in the back-pointers or a swapped ' +
          'emission index — both of which produce output that looks entirely reasonable.',
        example: 'The demo reports whether Viterbi matched the brute force, with the path count ' +
          'beside it.'
      },
      {
        term: 'The log domain is not a micro-optimisation',
        plain: 'A few hundred symbols underflow a double to exactly zero.',
        formal: 'a path multiplies one probability below one per symbol; adding logs never underflows',
        detail: 'Once the plain-probability version reaches zero, every path ties at zero and the ' +
          'decoder returns whichever it visited first — it does not throw, does not warn, and ' +
          'still returns a valid-looking state sequence. That silence is what makes the bug ' +
          'dangerous. The fix is the same recurrence with multiplication replaced by addition ' +
          'and probabilities by their logarithms.',
        example: 'The demo measures the exact length at which it happens: 619 repetitions of one ' +
          'symbol, 522 of another, and never within 2 000 for a third.'
      },
      {
        term: 'Summing in the log domain needs one more step',
        plain: 'log(e^a + e^b) is computed by factoring out the larger term.',
        formal: 'logSum(a, b) = max(a, b) + log(1 + exp(−|a − b|))',
        readAs: 'To add two numbers held as logarithms, take the larger, then add the logarithm ' +
          'of one plus the exponential of the difference — which never exponentiates a large ' +
          'negative number.',
        detail: 'The forward algorithm sums over paths rather than maximising, so it needs this ' +
          'where Viterbi does not. Computing it naively by exponentiating both terms reintroduces ' +
          'exactly the underflow the log domain was adopted to avoid, which is why the identity ' +
          'is worth knowing rather than deriving each time.',
        example: 'The demo’s forward probability is computed this way and reported as an ordinary ' +
          'probability after the fact.'
      },
      {
        term: 'The best path and the best label at each step are different answers',
        plain: 'Viterbi maximises over sequences; the posterior maximises each position alone.',
        formal: 'the sequence of per-position posterior maxima need not be a valid path at all',
        detail: 'Stringing together the most likely state at each position can produce a sequence ' +
          'containing a zero-probability transition, because nothing constrained the choices to ' +
          'be consistent with each other. Which one you want depends on the question: a path ' +
          'when the sequence itself is the output, per-position labels when each is consumed ' +
          'independently. Reporting one and calling it the other is a common modelling error.',
        example: 'The demo prints both and marks the positions where they disagree.'
      },
      {
        term: 'Weighted transducers compose, and that is how decoders are built',
        plain: 'Context, lexicon and language model become one machine.',
        formal: 'composition combines the weights, so a pipeline becomes a single shortest-path search',
        detail: 'The alternative — running the stages in sequence — means materialising ' +
          'intermediate lattices that are enormous and cannot be optimised as a whole. Composing ' +
          'first lets the combined machine be determinised and minimised before any decoding ' +
          'happens, which is the difference between a research prototype and a system that runs ' +
          'in real time.',
        example: 'Section 24.8 composes two text transducers and checks the result against ' +
          'running them in sequence on 204 inputs.'
      }
    ],

    'automata-over-infinite-words': [
      {
        term: 'A reactive system’s behaviour is an infinite word',
        plain: 'A server has no final state, so acceptance cannot be about where a run stops.',
        formal: 'Büchi acceptance: some accepting state is visited infinitely often',
        detail: 'That one change is what lets the model express liveness. "The request is ' +
          'eventually granted" is not a statement about any finite prefix — no matter how long ' +
          'you wait without a grant, it might still arrive — so only an infinite run can violate ' +
          'it, and only a machine that reads infinite runs can express the violation.',
        example: 'The demo’s monitor accepts runs that visit its `waiting` state forever, which ' +
          'is exactly a request never granted.'
      },
      {
        term: 'Safety fails on a finite prefix; liveness never does',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a safety property:<br/>nothing bad happens"] --> B["broken by a finite trace —<br/>point at the moment"]',
            '    C["a liveness property:<br/>something good eventually happens"] --> D["no finite trace can refute it —<br/>it might still happen next"]',
            '    D --> E["the counter-example is an<br/>infinite loop that never does"]'
          ].join('\n'),
          caption: 'The distinction decides the tool. A test can catch a safety violation; a liveness violation needs something that reasons about infinite behaviour.'
        },
        plain: 'That is the mechanical distinction, and it decides which tool finds the bug.',
        formal: 'a safety violation has a bad prefix with no good continuation; a liveness violation has none',
        detail: 'A test can catch a safety violation because there is a finite trace to catch, ' +
          'and no finite test ever catches a liveness violation. That is why starvation, ' +
          'livelock, unfair locks and retry loops that never converge survive testing, fuzzing ' +
          'and production traffic: every finite trace they produce is indistinguishable from a ' +
          'slow but correct system.',
        example: 'The demo’s starving server passes the safety check and fails the liveness one, ' +
          'with the last column reporting what a finite test would find: nothing.'
      },
      {
        term: 'Every accepted infinite word has a lasso',
        plain: 'A finite stem into a cycle, repeated forever.',
        formal: 'if a Büchi automaton accepts anything, it accepts a word of the form u·vᵂ',
        readAs: 'There is a finite stem followed by a finite cycle repeated forever, which is why ' +
          'a counter-example can be printed at all.',
        detail: 'This is what makes the language decidable and the counter-examples finite ' +
          'objects. Without it, "this system has a bad infinite behaviour" would be true and ' +
          'unprintable. With it, a model checker returns a stem and a cycle that a person can ' +
          'read as an incident report: the request arrives, and then nothing happens, forever.',
        example: 'The demo returns `req ()^ω` — one step of stem into a one-step cycle — and ' +
          'unrolls the first ten steps of it.'
      },
      {
        term: 'Emptiness is a nested depth-first search',
        plain: 'Find accepting states reachable from the start, then look for a path back to each.',
        formal: 'the inner search runs in outer post-order, so each state is visited once per search',
        detail: 'Doing the inner search when the outer one finishes a state is what keeps the ' +
          'whole check linear in states and transitions, rather than running one full search per ' +
          'accepting state. It is the standard algorithm in every explicit-state model checker, ' +
          'and the cycle it finds is directly the lasso.',
        example: 'The demo reports the number of state visits across both searches beside the ' +
          'product size.'
      },
      {
        term: 'Model checking is the product with the property’s NEGATION',
        plain: 'Build a machine accepting the violating traces and check it is empty.',
        formal: 'the system is correct exactly when L(system) ∩ L(¬property) = ∅',
        readAs: 'The system satisfies the property exactly when no behaviour of the system is ' +
          'also a behaviour the negated property accepts.',
        detail: 'Non-empty means a bug WITH a witness, which is the reason the construction is ' +
          'phrased this way round rather than as "check the system is contained in the ' +
          'property". It is the same move as the containment check in section 24.6 — closure ' +
          'plus emptiness — lifted to infinite words.',
        example: 'The demo builds a 3-state product of the server with the violation monitor and ' +
          'reports emptiness.'
      },
      {
        term: 'A witness must be re-run against the machine',
        plain: 'A bug in the nested search produces a confident wrong trace.',
        formal: 'accepting the lasso is checked by running the stem, then the cycle until the state repeats',
        detail: 'The same discipline as everywhere else in the platform: the search is several ' +
          'steps deep, and a defect in it returns a counter-example presented with full ' +
          'confidence. Running the trace back through the product and confirming that the ' +
          'accepting state really is revisited turns the witness into something checkable.',
        example: 'The demo reports "the trace is accepted" as its own metric, computed by ' +
          'replaying the lasso.'
      },
      {
        term: 'Büchi automata do not determinise',
        plain: 'No deterministic Büchi automaton recognises "eventually always p".',
        formal: 'the deterministic Büchi languages are a strict subset of the ω-regular languages',
        readAs: 'The set of languages a deterministic Büchi automaton can recognise is strictly ' +
          'smaller than the set of languages that Büchi automata in general can, so ' +
          'determinisation is not merely expensive but impossible.',
        detail: 'That is why the zoo of acceptance conditions exists. Rabin, Streett and parity ' +
          'are richer rules that DO determinise, at the cost of being harder to state and read. ' +
          'It matters for complementation and for anything involving games or synthesis, all of ' +
          'which need a deterministic machine to work with.',
        example: 'The demo tabulates five conditions with a determinisable column, and Büchi is ' +
          'the readable one that says no.'
      },
      {
        term: 'Safety reduces to an ordinary finite automaton',
        plain: 'Which is why safety can be checked by a monitor in production and liveness cannot.',
        formal: 'a safety property is characterised by its set of bad prefixes, which is a regular language',
        detail: 'A runtime monitor is a finite automaton over prefixes: it watches events, and it ' +
          'can raise an alarm the moment a bad prefix completes. No monitor can ever report a ' +
          'liveness violation, because at every instant the good thing might still be about to ' +
          'happen. That asymmetry decides what observability can and cannot tell you about a ' +
          'running system.',
        example: 'The demo’s conditions table ends on the safety row, marked determinisable and ' +
          'used for runtime monitors.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
