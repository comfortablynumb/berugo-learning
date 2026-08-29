/** Worked examples for SAT and SMT solving (M32.5-M32.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'sat-solving': [
      {
        title: 'Four families, and the honest answer to "is clause learning a win"',
        goal: 'Run the same two solvers on four instance shapes and compare like with like.',
        setup: 'The CDCL solver from this section against the plain DPLL from M20, on '
          + 'instances from the same generator. Both columns count branches the search had to '
          + 'guess — CDCL decisions and DPLL nodes — so the ratio is meaningful.',
        steps: [
          { do: 'Run both on random 3-SAT at 4.26 clauses per variable, 70 variables.',
            why: 'The threshold, where instances are hardest and most benchmarks live.',
            work: 'unsat; 125 decisions against 5 831 nodes — a factor of 47' },
          { do: 'Run both on pigeonhole, six pigeons into five holes.',
            why: 'The family with no short resolution proof.',
            work: 'unsat; 183 decisions against 239 nodes — a factor of 1.3' },
          { do: 'Run both on a random instance with a solution planted in it, 80 variables.',
            why: 'An answer to find rather than an absence to prove.',
            work: 'sat; 159 decisions against 43 nodes — learning LOSES, by a factor of 3.7' },
          { do: 'Run both on 40 Horn clauses.',
            why: 'The polynomial fragment.',
            work: 'sat; 0 decisions and 1 node — propagation alone decides it' },
          { do: 'Read the clause visits on the pigeonhole run.',
            why: 'The cost side of learning, which the decision count hides.',
            work: '8 636 clause visits for 1 742 propagations' }
        ],
        answer: 'Clause learning wins by 47 times where it matters and loses on an instance '
          + 'whose answer is a satisfying assignment sitting in plain sight, because VSIDS '
          + 'chases conflicts rather than solutions. The pigeonhole row is the one to keep: a '
          + 'constant-factor improvement on a problem where both solvers are exponential, '
          + 'because every clause a CDCL solver learns is derived by resolution and the '
          + 'exponential lower bound on resolution proofs of the pigeonhole principle applies '
          + 'to it directly. No engineering removes that, and encodings whose '
          + 'unsatisfiability is a counting argument hit it constantly.'
      },
      {
        title: 'One conflict, one cut, one clause',
        goal: 'Follow a single conflict from the trail to the clause the solver keeps.',
        setup: 'Pigeonhole with three holes: 12 variables, 22 clauses, four pigeons that must '
          + 'each take a hole and no two of which may share one. The solver is stopped at its '
          + 'first conflict with the trail intact.',
        steps: [
          { do: 'Read the decision level and the conflicting clause.',
            why: 'A conflict is a clause with every literal false.',
            work: 'level 3; the clause (not x10 or not x7)' },
          { do: 'Walk back through the reasons to the cone that caused it.',
            why: 'The trail is the implication graph, one reason pointer per assignment.',
            work: '12 assignments, of which 3 are decisions' },
          { do: 'Cut at the first unique implication point and read off the clause.',
            why: 'Exactly one literal from the current level makes the backjump well defined.',
            work: '(not x5 or x12 or x9) — three literals from a trail of twelve' },
          { do: 'Take the backjump level from the clause.',
            why: 'The second-highest level in it is where the clause becomes unit.',
            work: 'level 2 — one whole level discarded rather than one decision undone' },
          { do: 'Let the solver finish and check its answer.',
            why: 'An unsatisfiable answer is a claim; a proof is evidence.',
            work: '7 conflicts, and a DRAT proof of 7 steps the checker replays to the empty clause' }
        ],
        answer: 'The learned clause is implied by the formula, so adding it changes nothing '
          + 'about which assignments satisfy it, and the current assignment violates it, so the '
          + 'search is forced somewhere new. That pair of properties is the whole idea: every '
          + 'conflict permanently removes a region of the space rather than one point of it. '
          + 'Notice the sizes — three literals out of twelve assignments — because that ratio '
          + 'is what makes the clause worth keeping, and it is also why clause deletion '
          + 'policies matter once a run has learned a hundred thousand of them.'
      }
    ],

    'smt-solving': [
      {
        title: 'The same conflict, two explanations, and an exponential between them',
        goal: 'Measure what a minimised unsat core is worth.',
        setup: 'A problem containing one real contradiction — a = b together with f(a) not '
          + 'equal to f(b) — plus k independent free choices the theory has no opinion about. '
          + 'The conflict never changes; only the number of theory-consistent boolean models '
          + 'does.',
        steps: [
          { do: 'Solve with a minimised core at k = 0, 1, 2, 3 and 4.',
            why: 'The explanation names only the two atoms that clash.',
            work: '2 rounds at every one of them' },
          { do: 'Solve the same problems returning the whole assignment instead.',
            why: 'Always correct, and it blocks exactly one model per round.',
            work: '2, 4, 10, 28 and 82 rounds' },
          { do: 'Read the average explanation size at k = 4.',
            why: 'This is the number the rounds follow.',
            work: '2.0 literals with a core, 10.0 with the whole assignment' },
          { do: 'Check both answers against brute force over every assignment.',
            why: 'The verdicts must agree however many rounds it took.',
            work: 'both unsat; 1 024 assignments enumerated at k = 4' },
          { do: 'Count the boolean models the padding creates.',
            why: 'To confirm the rounds are enumeration rather than difficulty.',
            work: '3 to the power of k consistent models — 81 at k = 4, and 82 rounds' }
        ],
        answer: 'The conflict is the same two atoms in every run; nothing about the problem got '
          + 'harder. What changed is how much each refutation ruled out, and the round count '
          + 'follows the number of models rather than the difficulty of the contradiction. That '
          + 'is why "the theory returns an explanation" is the architecture rather than a '
          + 'detail: a solver that hands back the whole assignment is a correct enumerator '
          + 'wearing a solver\'s clothes, and it degrades exponentially on padding that a '
          + 'human would not even notice in the input.'
      },
      {
        title: 'Two routes to one contradiction',
        goal: 'Watch the core try a second model after the theory refutes the first.',
        setup: 'Four atoms — a = b, b = c, a = c and f(a) = f(c) — with clauses (a = b or a = '
          + 'c), (b = c or a = c) and not f(a) = f(c). Either route makes a and c equal, and '
          + 'congruence then contradicts the disequality.',
        steps: [
          { do: 'Read the first assignment the core produces and what the theory says.',
            why: 'The core knows nothing about equality; it satisfies the clauses.',
            work: 'refuted, with an explanation of 2 literals' },
          { do: 'Read the blocking clause and the second round.',
            why: 'The core must now avoid that pair, and finds the other route.',
            work: 'refuted again, explanation of 3 literals' },
          { do: 'Read the third round.',
            why: 'With both routes blocked there is nothing left to satisfy.',
            work: 'round 3 is boolean: the core reports unsat, so the answer is unsat' },
          { do: 'Compare with brute force over every assignment.',
            why: 'A 4-atom problem has 16 of them, so the oracle is exhaustive.',
            work: '16 assignments tried, verdict unsat — the two agree' },
          { do: 'Check the proof the solver emitted.',
            why: 'The final SAT call proves the skeleton plus the blocking clauses unsatisfiable.',
            work: '1 proof step replayed to the empty clause' }
        ],
        answer: 'Three rounds and two theory calls settle a problem whose contradiction a human '
          + 'sees immediately, and the reason is that neither half sees the whole thing: the '
          + 'core cannot know that a = b and b = c make a = c, and the theory cannot know that '
          + 'the clauses give it a choice. Note what the proof does and does not cover. It '
          + 'proves the skeleton together with the blocking clauses is unsatisfiable, and it '
          + 'assumes those blocking clauses — so an SMT unsat answer is exactly as trustworthy '
          + 'as the theory that supplied them, which is why proof-producing theory solvers are '
          + 'an active area of work.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
