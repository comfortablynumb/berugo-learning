/** Concepts for model checking and deductive verification (M32.7-M32.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'model-checking': [
      {
        term: 'A model is a transition system, and it is deliberately not the program',
        plain: 'Variables, an initial state, and actions with a guard and an effect.',
        formal: 'states are assignments to the variables; an action is enabled where its guard holds',
        detail: 'Writing the model is most of the work and most of the value, because it forces '
          + 'a decision about what the protocol actually is at the level where the interesting '
          + 'mistakes live. Anything the model does not represent cannot be checked, and '
          + 'anything it represents in too much detail makes the state space explode — so '
          + 'abstraction is not an optimisation here, it is the design.',
        example: 'Check-then-set with two processes is 6 boolean variables and 8 actions, which '
          + 'is 64 states on paper and 16 reachable.'
      },
      {
        term: 'Explicit-state checking is breadth-first search with a visited set',
        diagram: {
          definition: [
            'flowchart LR',
            '    I["initial state"] --> Q["queue of unexplored states"]',
            '    Q --> P["pop, check the invariant"]',
            '    P -->|"broken"| C["report the trace — the shortest one,<br/>because the search is breadth-first"]',
            '    P -->|"holds"| S["push every enabled action\'s successor<br/>that has not been seen"]',
            '    S --> Q',
            '    Q -->|"empty"| PR["no reachable state breaks it — a proof"]'
          ].join('\n'),
          caption: 'Two outcomes and they are not symmetric: a violation is a finite trace anybody can replay, and the absence of one is a proof only because the queue emptied.'
        },
        plain: 'Generate every reachable state, hash it, check the invariant.',
        formal: 'the first counter-example found is a shortest one',
        detail: 'Breadth-first is not an arbitrary choice: the length of a counter-example is '
          + 'most of how usable it is, and a depth-first search will happily hand you a '
          + 'forty-step trace for a bug that takes six. The visited set is what makes the '
          + 'search terminate at all, since the state graph has cycles everywhere — and its '
          + 'size is what makes the technique expensive.',
        example: 'The two-process race is found at depth 6, after visiting 16 states and 26 '
          + 'transitions.'
      },
      {
        term: 'The counter-example is the product, and it should be replayed rather than believed',
        plain: 'A trace is a bug report with an exact reproduction attached.',
        formal: 'replay re-checks every guard and the final invariant against the model',
        detail: 'A checker with a bug in its successor generation produces traces that cannot '
          + 'happen, and nothing about the output distinguishes them from real ones. Replaying '
          + 'is cheap — walk the actions, check each guard, apply each effect — and it converts '
          + 'the trace from a claim into a reproduction. It is the same discipline as checking '
          + 'a SAT model against the formula.',
        example: 'The demo replays the six-step interleaving and confirms the final state '
          + 'really violates mutual exclusion.'
      },
      {
        term: 'Bounded model checking asks the same question as a SAT problem',
        diagram: {
          definition: [
            'flowchart TD',
            '    M["transition relation"] --> U["unroll k times:<br/>one copy of every variable per step"]',
            '    U --> C["clauses: step i to step i+1<br/>is a legal action"]',
            '    C --> B["plus: the invariant is broken somewhere"]',
            '    B --> S["SAT solver from 32.5"]',
            '    S -->|"satisfiable"| T["the model IS the trace"]',
            '    S -->|"unsatisfiable"| N["no counter-example of length k or less<br/>— and that is all it says"]'
          ].join('\n'),
          caption: 'The clause count grows by one copy of the transition relation per step: 103 clauses at depth 0 and 15 207 at depth 8 on the two-process model.'
        },
        plain: 'Unroll k steps, add "something breaks", and solve.',
        formal: 'satisfiable exactly when a counter-example of length at most k exists',
        detail: 'What makes this worth doing is that a SAT solver does not enumerate states: it '
          + 'reasons about the whole unrolling at once, so it can find a deep counter-example '
          + 'in a state space far too large to walk. What makes it dangerous is the bound — an '
          + 'unsatisfiable answer says nothing whatsoever about longer traces, and only a '
          + 'completeness threshold or an exhaustive search turns it into a proof.',
        example: 'The unrolling grows about sixteen-fold per process: 1 991 clauses at depth 1 '
          + 'with two processes, 32 778 with three, 440 333 with four — and 11 431 at the '
          + 'depth where the two-process race first appears.'
      },
      {
        term: 'Two methods must agree on the depth, not merely on the verdict',
        plain: 'Both saying "there is a bug" is a weak check.',
        formal: 'the shortest counter-example length from each method must match',
        detail: 'An encoding that lets a step happen without its guard still reports a '
          + 'violation — just a shorter one, through a trace the protocol cannot take. '
          + 'Comparing verdicts passes that bug and comparing depths fails it immediately, '
          + 'which is exactly what happened here: the unrolling reported depth 1 where the '
          + 'search says 6. A differential is only as strong as the field it compares.',
        example: 'On the racing protocol both methods report 6; on Peterson both report no '
          + 'violation, one as a proof and one only within the bound.'
      },
      {
        term: 'The state space is exponential, and the reachable part is a smaller exponential',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["2 processes<br/>64 states allowed<br/>16 reachable"] --> B["4 processes<br/>4 096 allowed<br/>256 reachable"]',
            '    B --> C["6 processes<br/>262 144 allowed<br/>4 096 reachable"]',
            '    C --> D["the counter-example turns up<br/>after 421 states"]'
          ].join('\n'),
          caption: 'Three exponentials with different bases. Finding the bug is cheap; proving its absence costs the whole reachable set; and the space the variables allow is never explored at all.'
        },
        plain: 'Every boolean doubles the space.',
        formal: 'the variables allow 2 to the n states; reachability is what is actually walked',
        detail: 'The gap between the declared space and the reachable set is the only reason '
          + 'this technique works at all, and it is why the discipline is aggressive '
          + 'abstraction: model that a message can be lost, not the bytes in it. The small-'
          + 'scope hypothesis is the other half — almost every protocol bug appears with two or '
          + 'three participants, so checking three and shipping is a defensible engineering '
          + 'position rather than a compromise.',
        example: 'At six processes: 262 144 states allowed, 4 096 reachable, and the violation '
          + 'found after 421.'
      },
      {
        term: 'Partial-order reduction and symmetry are what make real checkers survive',
        plain: 'Two independent actions in either order reach the same state.',
        formal: 'explore an ample set of enabled actions rather than all of them',
        detail: 'If two actions commute and neither is visible to the property, exploring both '
          + 'interleavings adds states and no information — so an ample-set calculation picks '
          + 'one. Symmetry reduction does the same for interchangeable processes, collapsing '
          + 'states that differ only by a permutation. This checker implements neither, which '
          + 'is why its state counts are an honest upper bound rather than what a production '
          + 'tool would report.',
        example: 'The demo\'s six-process model has 4 096 reachable states; symmetry alone '
          + 'would collapse most of them, since the processes are identical.'
      },
      {
        term: 'Safety and liveness are violated by different kinds of trace',
        plain: 'Nothing bad ever happens, against something good eventually happens.',
        formal: 'safety is refuted by a finite trace; liveness needs an infinite one',
        detail: 'That difference decides the machinery. A safety property is an invariant over '
          + 'reachable states, so a reachability search settles it. A liveness property is only '
          + 'violated by a run that goes on forever without the good thing happening, which in '
          + 'a finite state graph means a cycle — found by the automaton-theoretic construction '
          + 'through Buchi automata from M24, and it roughly doubles what a checker has to do.',
        example: '"Two processes are never inside at once" is checkable here; "whoever asks '
          + 'eventually gets in" needs a cycle search this demo does not do.'
      }
    ],

    'deductive-verification': [
      {
        term: 'A Hoare triple is the whole framework',
        plain: 'If this holds before, and the statement runs, that holds after.',
        formal: 'precondition, statement, postcondition',
        detail: 'Everything in this section computes one of the three from the other two, and '
          + 'the useful direction is backwards: given what must hold afterwards, what must hold '
          + 'before. That direction is mechanical, which is what makes verification a program '
          + 'rather than an argument. The forwards direction needs existential quantifiers and '
          + 'is much less pleasant to automate.',
        example: 'The demo\'s five programmes turn into 1 to 6 verification conditions each, '
          + 'entirely mechanically: the midpoint gives 1 condition over 1 path, and the '
          + 'branch gives 4 over 3 paths.'
      },
      {
        term: 'The weakest precondition of an assignment is substitution',
        plain: 'To make `x <= 10` true after `x = y + 1`, you need `y + 1 <= 10` before it.',
        formal: 'wp(x := e, Q) is Q with every x replaced by e',
        detail: 'No search, no solver, no cleverness — rewrite the goal. A straight-line block '
          + 'is that rewrite applied backwards statement by statement, and a branch is the '
          + 'conjunction of the two sides. The whole difficulty of verification is elsewhere: '
          + 'in loops, where substitution cannot terminate, and in the annotations a human has '
          + 'to supply.',
        example: 'The midpoint programme substitutes `sum` away, leaving a condition about lo '
          + 'and hi alone.'
      },
      {
        term: 'A verification condition has no program left in it',
        plain: 'These assumptions imply this goal.',
        formal: 'a purely logical claim, handed to a solver',
        detail: 'The separation is why one verifier can serve several languages and why the '
          + 'solver from 32.6 needs to know nothing about programs. It is also why the '
          + 'reporting is hard: a failed condition names logic rather than lines, and mapping '
          + 'it back to something an engineer can act on is where a usable tool spends its '
          + 'effort.',
        example: 'The midpoint condition is "lo >= 0, hi >= lo, hi <= 1000, sum = lo + hi imply '
          + 'sum <= 1000".'
      },
      {
        term: 'Discharging is refuting the negation, which is why failures are useful',
        diagram: {
          definition: [
            'flowchart LR',
            '    V["assumptions AND not-goal"] --> S["SMT solver"]',
            '    S -->|"unsatisfiable"| P["the goal follows — discharged"]',
            '    S -->|"satisfiable"| M["a model: the state where it fails"]',
            '    M --> Q{"round it to integers —<br/>does it still refute?"}',
            '    Q -->|"yes"| BUG["a bug: lo = 625, hi = 875, sum = 1500"]',
            '    Q -->|"no"| RAT["only the rationals refute it —<br/>the theory is weaker than the program"]'
          ].join('\n'),
          caption: 'A verifier that reported both leaves as "could not prove" would train its users to ignore it, because only one of them is worth acting on.'
        },
        plain: 'Ask whether the assumptions can hold while the goal fails.',
        formal: 'unsat means proved; sat comes with a counter-example state',
        detail: 'The asymmetry is the whole reason to use a solver rather than a checker: a '
          + 'proof is a proof, and a failure arrives with the state in which the program is '
          + 'wrong. That state is what makes verification usable by people who are not writing '
          + 'the proofs themselves — it turns "cannot prove" into "here is the input that '
          + 'breaks it".',
        example: 'The binary-search midpoint fails with lo = 625, hi = 875 and sum = 1500 — an '
          + 'integer state the precondition allows.'
      },
      {
        term: 'A loop is cut at its invariant, and the cut forgets everything else',
        plain: 'Three conditions: entry, preservation, and what comes after.',
        formal: 'the invariant is the only thing that crosses the loop boundary',
        detail: 'That is what makes verification finite where execution is not, and it is also '
          + 'the source of the annotation burden. Nothing about the loop survives the cut '
          + 'except the invariant, so a fact the code needs afterwards must appear in it — '
          + 'which is why leaving the invariant out does not produce a weaker proof, it '
          + 'produces no proof, with a counter-example in a state the program can never reach.',
        example: 'The counting loop proves `i >= 0` afterwards in 6 conditions with its '
          + 'invariant, and fails at i = -1 without it.'
      },
      {
        term: 'Nothing here infers an invariant, and saying so is the honest position',
        plain: 'The verifier does not guess what you meant.',
        formal: 'invariant inference is a separate problem; abstract interpretation is one approach',
        detail: 'A tool that quietly weakened an invariant it could not prove would be proving a '
          + 'different program, and the user would never know. The cost is real: an invariant '
          + 'per loop, plus frame conditions saying what a procedure leaves alone. That is the '
          + 'reason deductive verification is used on code where correctness is worth days, and '
          + 'why the technique is often paired with an inference engine that proposes '
          + 'candidates for a human to confirm.',
        example: 'The counting loop needs `i >= 0` and `i <= n` written down; the abstract '
          + 'interpreter in 32.2 would derive [0, 11] for a similar loop automatically.'
      },
      {
        term: 'A fractional counter-example is not a state a program can be in',
        plain: 'The solver decides the rationals; your variables are integers.',
        formal: 'satisfiable over the rationals does not mean satisfiable over the integers',
        detail: 'Over the integers `i < n` implies `i + 1 <= n`; over the rationals it does not, '
          + 'and n = 0.5 is the witness. A verifier that reported that as a failed invariant '
          + 'would send an engineer to change code that is correct, so the demo rounds the '
          + 'counter-example every way it can and reports separately whether any rounding still '
          + 'refutes the goal. Finding none is not a proof — it is one honest sentence about a '
          + 'neighbourhood.',
        example: 'The counting loop\'s preservation condition is refuted only at n = 0.5, and '
          + 'no rounding of that refutes it.'
      },
      {
        term: 'The technique pays exactly where everybody believes the code is correct',
        plain: 'Settled algorithms are where the surviving bugs are.',
        formal: 'a proof covers every execution, including the ones nobody thought to test',
        detail: 'The binary-search overflow is the standard example precisely because the '
          + 'algorithm had been taught, reviewed and shipped for decades. Verification finds '
          + 'that class of bug because it does not sample: it asks whether any state satisfying '
          + 'the precondition breaks the assertion, and the answer does not depend on anybody '
          + 'imagining a large array. The same argument applies to lock-free data structures, '
          + 'index arithmetic and permission checks.',
        example: 'One condition each for the two midpoints, and the only difference between '
          + 'them is where the parentheses go.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
