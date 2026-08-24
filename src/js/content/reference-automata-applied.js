/** Reference entries for production automata, weighted machines and Büchi (M24.9-M24.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'automata-in-production': {
      summary: 'A generated lexer reporting every maximal-munch decision including the shorter ' +
        'matches it passed over, and a structural ReDoS analyser checked against nine patterns ' +
        'with known verdicts before the flagged ones are actually attacked.',
      intuition: 'Both scanner rules and both ReDoS shapes are mechanical, which is what lets ' +
        'them be checks rather than folklore.',
      formulation: {
        equations: [
          {
            label: 'The two scanner rules',
            expr: 'longest match wins; among equal lengths, the earliest rule wins',
            terms: [
              { sym: 'maximal munch', meaning: 'keep scanning past a match that already succeeded' },
              { sym: 'priority', meaning: 'declaration order, which is why keywords precede identifiers' },
              { sym: 'the empty match', meaning: 'an error, not a token — otherwise the scanner never advances' },
              { sym: 'on "if x >>= 12"', meaning: '7 decisions, 4 tokens, 3 decisions passing over a shorter match' }
            ]
          },
          {
            label: 'The two ReDoS shapes',
            expr: 'nesting: a repetition over a repetition · overlap: two runs from a state back to itself',
            terms: [
              { sym: 'nesting', meaning: 'found on the syntax tree — (a*)* and a* have identical position automata' },
              { sym: 'overlap', meaning: 'found in the position automaton — (aa|a)* looks innocent and is not' },
              { sym: 'why the position automaton', meaning: 'ε-free and position-faithful; Thompson’s ε-edges flag everything' },
              { sym: 'verdicts', meaning: '9 of 9 correct, including (a|ab)*c which looks dangerous and is not' }
            ]
          },
          {
            label: 'The measured blow-up on (a+)+b',
            expr: 'repeats · input length · backtracking steps · simulation steps · ratio',
            terms: [
              { sym: '4', meaning: '6 characters · 99 · 28 · 3.5×' },
              { sym: '8', meaning: '10 characters · 1 659 · 52 · 31.9×' },
              { sym: '12', meaning: '14 characters · 26 619 · 76 · 350.3×' },
              { sym: '16', meaning: '18 characters · 425 979 · 100 · 4 259.8×' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The scanner remembers the last accepting length rather than returning at the first',
          why: 'That IS maximal munch, and without it `>>=` comes back as two tokens.',
          breaks: 'The demo lists the shorter matches passed over at each position, so a first-success scanner’s output is visible.'
        },
        {
          name: 'A zero-length longest match is an error',
          why: 'Consuming nothing means the scanner never advances.',
          breaks: 'A rule list written with `a*` where `a+` was meant hangs rather than failing, which is worse to diagnose.'
        },
        {
          name: 'The analyser is checked against patterns with known verdicts before it is trusted',
          why: 'A detector that flags safe patterns is worse than none, because it trains people to ignore it.',
          breaks: 'The demo runs 9 patterns and reports the correct count, with one safe-looking-but-dangerous and one dangerous-looking-but-safe.'
        },
        {
          name: 'The attack string ends in a tail the pattern cannot match',
          why: 'A matching string stops at the first success and is harmless.',
          breaks: 'Fuzzing with valid inputs finds nothing, which is why the analysis has to be structural.'
        }
      ],
      complexity: [
        { operation: 'scanning one position', average: 'O(rules × longest match) transitions', worst: 'every rule advanced until all have died' },
        { operation: 'scanning a file', average: 'O(n) with a merged DFA', worst: 'O(n × rules) with rules run separately, as the demo does for visibility' },
        { operation: 'ambiguity search', average: 'O(positions²) pairs, bounded word length', worst: 'quadratic in the position count' },
        { operation: 'nesting check', average: 'one walk of the syntax tree', worst: 'linear in the pattern' },
        { operation: 'backtracking match', average: 'linear on most inputs', worst: 'exponential — 425 979 steps on an 18-character input' },
        { operation: 'NFA simulation', average: 'O(states) per character', worst: '100 steps on the same input' }
      ],
      failureModes: [
        {
          symptom: '`>>=` tokenises as `>>` then `=` and the parser fails somewhere unrelated.',
          cause: 'The scanner returned at the first accepting rule.',
          fix: 'Maximal munch: keep advancing and remember the furthest acceptance.'
        },
        {
          symptom: 'Keywords come back as identifiers after a rule list is reordered.',
          cause: 'Priority is declaration order, and it is load-bearing and silent.',
          fix: 'Keep keywords first, or check a keyword table after tokenising an identifier.'
        },
        {
          symptom: 'A request times out on one specific input and nothing else.',
          cause: 'A pattern with a nested quantifier or overlapping alternatives, meeting a non-matching string.',
          fix: 'Rewrite the pattern, or use an engine that simulates. Add the analyser to CI.'
        },
        {
          symptom: 'A ReDoS scanner flags half the codebase.',
          cause: 'It is analysing an ε-NFA, where one run appears as several.',
          fix: 'Use the position automaton for overlap and the syntax tree for nesting.'
        }
      ],
      inTheWild: [
        'flex, re2c and every lexer generator, which implement exactly these two rules.',
        'TCP’s connection state machine and OAuth flows, which are protocol automata.',
        'XState and similar statechart libraries, which add hierarchy and orthogonal regions.',
        'The Cloudflare outage of 2019, caused by a regular expression with this structure.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers: Principles, Techniques and Tools', note: 'maximal munch, priority and lexer generation' },
        { title: 'Harel — Statecharts: a visual formalism for complex systems (1987)', note: 'hierarchy, orthogonal regions and history' },
        { title: 'Weideman et al. — Analyzing matching time behavior of backtracking regular expression matchers (2016)', note: 'the ambiguity criterion this analyser implements' },
        { title: 'Cox — Regular expression matching can be simple and fast (2007)', note: 'why the simulation is linear and the backtracker is not' }
      ]
    },

    'weighted-and-probabilistic': {
      summary: 'Viterbi checked against enumeration of every path, the posterior disagreeing with ' +
        'the best path, and plain-probability decoding measured to reach exactly zero at 619 ' +
        'steps for one symbol and never within 2 000 for another.',
      intuition: 'One trellis, six semirings: the algorithm never changes and the meaning of the ' +
        'answer does.',
      formulation: {
        equations: [
          {
            label: 'The Viterbi recurrence',
            expr: 'V(t, s) = max over s′ of V(t−1, s′) + log P(s′ → s) + log P(oₜ | s)',
            readAs: 'The best score for a state at a step is the best score for any previous ' +
              'state, plus the log of the transition probability into this one, plus the log of ' +
              'the probability of emitting what was observed.',
            terms: [
              { sym: 'cells', meaning: 'observations × states — 6 for a 3-step, 2-state model' },
              { sym: 'brute force', meaning: 'states^observations paths — 8 for the same model' },
              { sym: 'back-pointers', meaning: 'read the path backwards from the best final cell' },
              { sym: 'why not greedy', meaning: 'the best cell per column need not lie on any valid path' }
            ]
          },
          {
            label: 'Why the log domain',
            expr: 'a path multiplies one probability below one per symbol',
            terms: [
              { sym: '"clean" repeated', meaning: 'plain probability reaches exactly 0 at 619 steps' },
              { sym: '"shop" repeated', meaning: 'at 522 steps' },
              { sym: '"walk" repeated', meaning: 'not within 2 000 — the failure depends on the model and the data' },
              { sym: 'log domain at 1 000 steps', meaning: 'about −1 204, and still exact' }
            ]
          },
          {
            label: 'Semirings: one algorithm, six meanings',
            expr: 'along a path ⊗ · between paths ⊕ · what it computes',
            terms: [
              { sym: 'tropical (+, min)', meaning: 'the shortest path' },
              { sym: 'log (+, max)', meaning: 'the most probable path, without underflowing' },
              { sym: 'probability (×, +)', meaning: 'the total probability of the observations — the forward algorithm' },
              { sym: 'Boolean (∧, ∨)', meaning: 'ordinary acceptance — a plain automaton is this case' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The decoder is checked against enumeration of every path',
          why: 'A wrong recurrence returns a plausible path, and comparing two dynamic programs shares an assumption.',
          breaks: 'The demo enumerates 8 paths on a 3-step model and compares both the path and the score.'
        },
        {
          name: 'Everything runs in the log domain',
          why: 'Multiplying probabilities underflows to exactly zero and every path then ties.',
          breaks: 'The naive decoder does not throw or warn — it returns a valid-looking sequence chosen arbitrarily.'
        },
        {
          name: 'Sums in the log domain factor out the larger term',
          why: 'Exponentiating both terms reintroduces the underflow the log domain was adopted to avoid.',
          breaks: 'log(e^a + e^b) computed naively is zero exactly when the plain algorithm would have been.'
        },
        {
          name: 'The best path and the per-position best label are reported separately',
          why: 'They answer different questions and the second may not be a valid path at all.',
          breaks: 'The demo marks the positions where they disagree rather than presenting one as the other.'
        }
      ],
      complexity: [
        { operation: 'Viterbi', average: 'O(T · |Q|²) time, O(T · |Q|) space for the pointers', worst: 'the same' },
        { operation: 'forward', average: 'O(T · |Q|²), with logSum instead of max', worst: 'the same' },
        { operation: 'forward–backward posterior', average: 'two passes, O(T · |Q|²) each', worst: 'the same' },
        { operation: 'brute-force enumeration', average: '|Q|^T paths', worst: '8 paths at T = 3; 1 024 at T = 10 — a test only' },
        { operation: 'plain-probability decoding', average: 'identical work, and it underflows', worst: 'zero at 619 steps for one symbol of this model' },
        { operation: 'beam search', average: 'O(T · beam · |Q|), an approximation', worst: 'can lose the best path — the usual trade at scale' }
      ],
      failureModes: [
        {
          symptom: 'A decoder returns nonsense on long sequences and works on short ones.',
          cause: 'Probabilities underflowed to zero, so every path ties and the first is returned.',
          fix: 'Work in the log domain. Measure where the naive version dies rather than guessing.'
        },
        {
          symptom: 'A "most likely tag sequence" contains an impossible transition.',
          cause: 'Per-position posterior maxima were strung together instead of running Viterbi.',
          fix: 'Decide which question is being asked; they are different answers.'
        },
        {
          symptom: 'A hand-written decoder passes the examples and fails on real data.',
          cause: 'An off-by-one in the back-pointers or a swapped emission index.',
          fix: 'Check against brute-force enumeration on small models; it shares nothing with the recurrence.'
        },
        {
          symptom: 'A decoding pipeline is too slow to run in real time.',
          cause: 'Stages run in sequence with intermediate lattices materialised between them.',
          fix: 'Compose the weighted transducers first, then optimise the combined machine.'
        }
      ],
      inTheWild: [
        'Part-of-speech tagging and named-entity recognition, the classic HMM applications.',
        'Speech recognition decoders, built as composed weighted transducers.',
        'Viterbi decoding of convolutional codes, which is the same algorithm on a different trellis.',
        'Noisy-channel spell correction, where the weights are edit costs.'
      ],
      sources: [
        { title: 'Viterbi — Error bounds for convolutional codes (1967)', note: 'the algorithm, in its original coding-theory setting' },
        { title: 'Rabiner — A tutorial on hidden Markov models (1989)', note: 'the standard treatment of the three problems and their algorithms' },
        { title: 'Mohri, Pereira and Riley — Speech recognition with weighted finite-state transducers', note: 'composition as the architecture of a decoder' },
        { title: 'Jurafsky and Martin — Speech and Language Processing', note: 'the log domain, beam search and the practical failure modes' }
      ]
    },

    'automata-over-infinite-words': {
      summary: 'Three systems checked against two properties with a nested depth-first emptiness ' +
        'search, where the server that may wait forever passes safety and fails liveness with a ' +
        'lasso that is re-run to confirm it.',
      intuition: 'Safety fails on a finite prefix and liveness never does, which decides what ' +
        'testing can and cannot find.',
      formulation: {
        equations: [
          {
            label: 'Büchi acceptance',
            expr: 'a run is accepting when some accepting state is visited infinitely often',
            terms: [
              { sym: 'why infinite words', meaning: 'a reactive system has no final state' },
              { sym: 'lasso form', meaning: 'every accepted word has a representative u·vᵂ — a stem into a repeated cycle' },
              { sym: 'so emptiness is', meaning: 'is there a reachable accepting state on a cycle' },
              { sym: 'the algorithm', meaning: 'nested depth-first search, with the inner search in outer post-order' }
            ]
          },
          {
            label: 'Model checking',
            expr: 'the system satisfies the property ⟺ L(system) ∩ L(¬property) = ∅',
            readAs: 'Build a machine accepting exactly the behaviours that violate the property, ' +
              'intersect it with the system, and check the result is empty — a non-empty result ' +
              'is a bug with a witness.',
            terms: [
              { sym: 'the demo product', meaning: '3 reachable pairs, 4 state visits' },
              { sym: 'the witness', meaning: 'req, then the empty step forever — a 1-step stem into a 1-step cycle' },
              { sym: 'confirmation', meaning: 'the lasso is replayed against the product and the accepting state is revisited' },
              { sym: 'why', meaning: 'a bug in the nested search returns a confident wrong trace' }
            ]
          },
          {
            label: 'The three-by-two matrix',
            expr: 'system · safety · liveness · what a finite test would find',
            terms: [
              { sym: 'always grants', meaning: 'holds · holds · nothing, correctly' },
              { sym: 'may wait forever', meaning: 'holds · VIOLATED · nothing — every finite trace is also a correct prefix' },
              { sym: 'grants without a request', meaning: 'VIOLATED · violated · immediately, in a 1-step trace' },
              { sym: 'the lesson', meaning: 'the middle row is the class of bug that survives testing' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The monitor accepts the VIOLATING behaviours, not the correct ones',
          why: 'A non-empty language is then a bug with a printable witness.',
          breaks: 'Checking containment the other way round gives a yes-or-no with nothing attached.'
        },
        {
          name: 'The counter-example is replayed against the product',
          why: 'The nested search is several steps deep and a defect returns a wrong trace confidently.',
          breaks: 'The demo reports "the trace is accepted" as its own metric, computed by replaying the lasso.'
        },
        {
          name: 'The inner search runs in outer post-order',
          why: 'That is what keeps the whole check linear rather than one full search per accepting state.',
          breaks: 'Running the inner search eagerly makes the algorithm quadratic in the state count.'
        }
      ],
      complexity: [
        { operation: 'nested depth-first emptiness', average: 'O(states + transitions)', worst: 'the same — each state is visited once per search' },
        { operation: 'the product', average: 'system states × monitor states, reachable only', worst: 'the product, which is where model checking gets expensive' },
        { operation: 'LTL to Büchi', average: 'exponential in the formula length', worst: '2^O(|φ|) states — the formula is small, so this is usually fine' },
        { operation: 'Büchi complementation', average: 'no simple construction', worst: '2^O(n log n) — which is why the other acceptance conditions exist' },
        { operation: 'safety monitoring at runtime', average: 'O(1) per event with a DFA over prefixes', worst: 'the same; this is why safety can be checked live' },
        { operation: 'liveness monitoring at runtime', average: 'impossible', worst: 'at every instant, the good thing might still be about to happen' }
      ],
      failureModes: [
        {
          symptom: 'A starvation bug survives every test and appears in production under load.',
          cause: 'It is a liveness violation, and no finite trace exhibits it.',
          fix: 'Model check, or argue. Testing cannot reach this class.'
        },
        {
          symptom: 'A model checker reports a counter-example that does not reproduce.',
          cause: 'A defect in the nested search produced a trace that is not actually accepted.',
          fix: 'Replay the lasso against the product before reporting it.'
        },
        {
          symptom: 'A monitor is asked to alarm on "the queue eventually drains" and never fires.',
          cause: 'Liveness properties have no bad prefix for a monitor to detect.',
          fix: 'Monitor a safety approximation — "the queue drains within 30 seconds" — which does have one.'
        },
        {
          symptom: 'A determinisation of a Büchi automaton is attempted and fails.',
          cause: 'Deterministic Büchi automata are strictly weaker; "eventually always p" has none.',
          fix: 'Use Rabin, Streett or parity acceptance, which determinise at the cost of readability.'
        }
      ],
      inTheWild: [
        'SPIN and TLA+, which check liveness properties against models of real systems.',
        'Runtime verification tools, which monitor safety properties and cannot monitor liveness.',
        'Reactive synthesis, which needs parity automata precisely because Büchi ones do not determinise.',
        'Distributed systems work, where fairness assumptions are Streett conditions in disguise.'
      ],
      sources: [
        { title: 'Büchi — On a decision method in restricted second order arithmetic (1962)', note: 'the acceptance condition and the decidability result' },
        { title: 'Vardi and Wolper — An automata-theoretic approach to automatic program verification (1986)', note: 'the product-with-the-negation architecture of model checking' },
        { title: 'Courcoubetis, Vardi, Wolper and Yannakakis — Memory-efficient algorithms for the verification of temporal properties (1992)', note: 'the nested depth-first search' },
        { title: 'Alpern and Schneider — Defining liveness (1985)', note: 'the safety/liveness decomposition and why every property is a conjunction of the two' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
