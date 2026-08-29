/** Worked examples for model checking and deductive verification (M32.7-M32.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'model-checking': [
      {
        title: 'Two methods, and the number they have to agree on',
        goal: 'Check one protocol twice and compare the depth rather than the verdict.',
        setup: 'Check-then-set with two processes: each observes that no flag is up, then '
          + 'raises its own, then enters. Six boolean variables, eight actions, and the '
          + 'invariant is that at most one process is inside.',
        steps: [
          { do: 'Run the explicit breadth-first search.',
            why: 'Every reachable state, generated and hashed.',
            work: 'violated after 16 states and 26 transitions, at depth 6' },
          { do: 'Replay the counter-example against the model.',
            why: 'A trace nobody replays is a story.',
            work: '6 guards re-checked, and the final state breaks mutual exclusion' },
          { do: 'Unroll the transition relation into CNF at each depth from 0 to 8.',
            why: 'The same question as a SAT problem.',
            work: '103 clauses at depth 0, growing by 1 888 per step to 15 207 at depth 8' },
          { do: 'Find the first depth whose unrolling is satisfiable.',
            why: 'This is the number that has to match.',
            work: 'depth 6 — the same as the search' },
          { do: 'Run both on Peterson\'s algorithm instead.',
            why: 'A protocol that is correct, to check the methods agree on that too.',
            work: '20 reachable states of 128 allowed, no violation from either' }
        ],
        answer: 'Both methods say depth 6, and that agreement is the check worth having. '
          + 'Comparing verdicts alone would have passed an encoding that let a step happen '
          + 'without its guard: it reported a violation at depth 1, through a trace the '
          + 'protocol cannot take, and "both agree there is a bug" hid it completely. Note the '
          + 'asymmetry in the two clean answers on Peterson, too. The search exhausted 20 '
          + 'reachable states, which is a proof; the unrolling found nothing up to depth 8, '
          + 'which is a statement about traces of length 8.'
      },
      {
        title: 'Three exponentials, and which one you have to pay',
        goal: 'Measure the state space, the reachable part, and the cost of a counter-example.',
        setup: 'The same racing protocol with 2 to 6 processes. Three boolean variables per '
          + 'process, so the declared space is 8 to the power of the processes.',
        steps: [
          { do: 'Count the states the variables allow at 2, 4 and 6 processes.',
            why: 'The number people quote when they say state explosion.',
            work: '64, 4 096 and 262 144' },
          { do: 'Count the reachable states at the same sizes.',
            why: 'This is what a proof of safety actually costs.',
            work: '16, 256 and 4 096 — 4 to the power of the processes' },
          { do: 'Count the states visited before the counter-example appears.',
            why: 'Finding a bug is a different job from proving there is none.',
            work: '16, 107 and 421' },
          { do: 'Compare the two exponentials at six processes.',
            why: 'The ratio is the whole practice.',
            work: '4 096 reachable against 421 to find the bug — about ten times cheaper' },
          { do: 'Try the SAT unrolling at three and four processes.',
            why: 'The other method has its own explosion.',
            work: '32 778 clauses at depth 1 with three processes, 440 333 with four' }
        ],
        answer: 'Both methods are exponential and they explode in different directions, which '
          + 'is why real tools ship both. The reachable set is 4 to the power of the processes '
          + 'while the declared space is 8 to the power — the gap between them is the only '
          + 'reason explicit-state checking is possible at all, and it is entirely a property '
          + 'of the protocol rather than of the checker. The practical reading is the third '
          + 'row: the counter-example turns up after a tenth of the work that proving safety '
          + 'costs, which is why this technique earns its keep as a bug finder long before '
          + 'anybody tries to certify anything with it.'
      }
    ],

    'deductive-verification': [
      {
        title: 'The binary-search overflow, as a verification condition',
        goal: 'Watch a settled algorithm fail its specification, and fix it by rearranging.',
        setup: 'A precondition that lo is at least 0, hi is at least lo, and hi is at most '
          + '1000; an assignment computing the midpoint sum; and an assertion that the sum '
          + 'stays inside the range.',
        steps: [
          { do: 'Generate the verification conditions for `sum = lo + hi`.',
            why: 'Weakest-precondition reasoning leaves a claim with no program in it.',
            work: '1 condition, over 1 path' },
          { do: 'Discharge it.',
            why: 'The solver is asked whether the assumptions can hold while the goal fails.',
            work: 'satisfiable — 1 condition, 0 discharged' },
          { do: 'Read the model, and round it to integers.',
            why: 'A fractional state is not a state; an integer one is a bug.',
            work: 'lo = 625, hi = 875, sum = 1500 — every assumption holds and the goal fails' },
          { do: 'Change the assignment to `sum = lo + (hi - lo)` and re-run.',
            why: 'The same arithmetic, grouped so it cannot leave the range.',
            work: '1 condition, discharged: eliminating every variable leaves 0 < 0' },
          { do: 'Compare what the two programmes compute.',
            why: 'To be sure the fix is a rearrangement rather than a change of meaning.',
            work: 'identical for every input: lo + (hi - lo) is hi, checked over a 5 by 5 grid' }
        ],
        answer: 'The two programmes differ by where the parentheses go and one of them fails '
          + 'its specification for a quarter of the states its precondition allows. This is why '
          + 'the technique pays on code everybody believes is correct: the verifier does not '
          + 'sample inputs, so it does not need anybody to imagine a large array. It asks '
          + 'whether ANY state satisfying the precondition breaks the assertion, and hands back '
          + 'the state when the answer is yes.'
      },
      {
        title: 'What a missing invariant costs, and what a fractional counter-example means',
        goal: 'Separate the three reasons a verifier says "cannot prove".',
        setup: 'A counting loop from 0 to n with a precondition that n is at least 0, asserting '
          + 'afterwards that the counter never went negative and that the loop ran to the '
          + 'bound. Run once with the invariant written down and once without it.',
        steps: [
          { do: 'Verify with the invariant `i >= 0, i <= n`.',
            why: 'Three conditions per invariant clause, plus the assertions.',
            work: '6 conditions, 5 discharged' },
          { do: 'Read the one that fails.',
            why: 'It is the preservation condition: i < n must imply i + 1 <= n.',
            work: 'refuted at n = 0.5, i = 0' },
          { do: 'Round that counter-example every way and re-check.',
            why: 'The programme\'s variables are integers.',
            work: '4 roundings of n = 0.5 and i = 0, none of which refutes the goal' },
          { do: 'Verify the same loop with the invariant left out.',
            why: 'The loop cut keeps the invariant and forgets everything else.',
            work: '2 conditions, 1 discharged' },
          { do: 'Read the failure.',
            why: 'It should be a state the programme can reach — and it is not.',
            work: 'n = -1, i = -1, which the precondition n >= 0 forbids and the cut discarded' }
        ],
        answer: 'Three different messages hide behind "cannot prove", and a tool that gives all '
          + 'three the same wording teaches its users to ignore it. Here they are separated: '
          + 'the midpoint fails with a state the programme can really be in, which is a bug; '
          + 'the preservation condition fails only over the rationals, which is the arithmetic '
          + 'being weaker than the programme; and the loop without an invariant fails with an '
          + 'unreachable state, which is the annotation being too weak. Note that removing the '
          + 'invariant REDUCED the condition count from 6 to 2. Fewer questions and no proof — '
          + 'that is the shape of the annotation burden, and it is why writing invariants feels '
          + 'like making more work for yourself.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
