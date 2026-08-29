/** Reference entries for model checking and deductive verification (M32.7-M32.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'model-checking': {
      summary: 'A protocol checked twice — explicit breadth-first search and a SAT unrolling — '
        + 'required to agree on the depth of the shortest counter-example, with every trace '
        + 'replayed against the model, and the state explosion measured as three separate '
        + 'exponentials: what the variables allow, what is reachable, and what a '
        + 'counter-example costs.',
      intuition: 'A model checker hands back a bug report with an exact reproduction, produced '
        + 'before the code exists — and finding that bug is roughly ten times cheaper than '
        + 'proving there is none.',
      formulation: {
        equations: [
          {
            label: 'Check-then-set with two processes, both methods',
            expr: 'method · answer · cost',
            terms: [
              { sym: 'breadth-first search', meaning: 'violated at depth 6 · 16 states, 26 transitions' },
              { sym: 'SAT unrolling', meaning: 'first satisfiable at depth 6 · 11 431 clauses' },
              { sym: 'replay', meaning: '6 guards re-checked, the final state breaks the invariant' },
              { sym: 'Peterson, the same two methods', meaning: 'no violation · 20 reachable states of 128' }
            ]
          },
          {
            label: 'State explosion, by number of processes',
            expr: 'processes · allowed · reachable · visited before the violation',
            terms: [
              { sym: '2', meaning: '64 · 16 · 16' },
              { sym: '4', meaning: '4 096 · 256 · 107' },
              { sym: '6', meaning: '262 144 · 4 096 · 421' },
              { sym: 'the unrolling at depth 1', meaning: '1 991 clauses at 2, 32 778 at 3, 440 333 at 4' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The two methods must agree on the DEPTH of the first violation',
          why: 'Agreeing on the verdict passes an encoding that lets a step happen without its guard.',
          breaks: 'That bug reported a violation at depth 1 where the search says 6.'
        },
        {
          name: 'Every counter-example is replayed before it is shown',
          why: 'A checker with a bug in its successor generation produces traces that cannot happen.',
          breaks: 'Replay walks the actions, checks each guard, and confirms the final state breaks the invariant.'
        },
        {
          name: 'An exhausted search is a proof; a bounded one is not',
          why: 'No counter-example of length at most k says nothing at all about length k + 1.',
          breaks: 'The report distinguishes "every reachable state holds" from "nothing found in bound".'
        }
      ],
      complexity: [
        { operation: 'explicit-state search', average: 'one visit per reachable state', worst: 'exponential in the variables' },
        { operation: 'finding a counter-example', average: 'far less than the reachable set — 421 of 4 096 here', worst: 'the whole reachable set, when there is none' },
        { operation: 'the SAT unrolling', average: 'one copy of the transition relation per step', worst: 'about sixteen-fold per process on this protocol' },
        { operation: 'partial-order reduction', average: 'an ample-set calculation per state', worst: 'no reduction at all when everything is visible' },
        { operation: 'liveness by the automaton construction', average: 'a cycle search over the product', worst: 'roughly the square of the safety case' }
      ],
      failureModes: [
        {
          symptom: 'The checker runs out of memory on a model that looked small.',
          cause: 'A variable with more values than the property needs — a counter, a buffer, a payload.',
          fix: 'Abstract it: model that a message can be lost, not the bytes in it, and check three participants rather than a hundred.'
        },
        {
          symptom: 'A counter-example makes no sense against the real system.',
          cause: 'The model permits an action the implementation cannot take, so the trace is about a different protocol.',
          fix: 'Replay it by hand against the code; a model whose traces are not reproducible is worse than no model.'
        },
        {
          symptom: 'A bounded check reports no violation and a bug ships anyway.',
          cause: '"No counter-example up to depth k" was read as a proof.',
          fix: 'Quote the bound in the report and treat it as a bug finder until a completeness threshold says otherwise.'
        },
        {
          symptom: 'The model checks clean and the property was the wrong one.',
          cause: 'Safety was checked where the failure is a liveness one — nothing bad happens, and also nothing good.',
          fix: 'Check that some good state is reachable at all; a model where every action is disabled satisfies every invariant.'
        }
      ],
      inTheWild: [
        'SPIN and Promela, where partial-order reduction was made practical.',
        'TLA+ and TLC, used on S3, DynamoDB and the Xbox Live infrastructure.',
        'CBMC and the bounded model checking of real C, with loops unwound rather than cut.',
        'The SMV family and symbolic model checking with BDDs, which handled hardware state spaces first.'
      ],
      sources: [
        { title: 'Clarke, Grumberg, Peled — Model Checking', note: 'the standard text; safety, liveness and the automaton-theoretic approach' },
        { title: 'Biere et al. — Symbolic model checking without BDDs', note: 'bounded model checking, and why SAT changed the field' },
        { title: 'Holzmann — The SPIN Model Checker', note: 'partial-order reduction as an engineering practice' },
        { title: 'Newcombe et al. — How Amazon Web Services uses formal methods', note: 'what it costs and what it found, in production' }
      ]
    },

    'deductive-verification': {
      summary: 'Weakest preconditions turning five annotated programmes into verification '
        + 'conditions, each discharged by the solver from 32.6 or refuted with a state — and '
        + 'the three reasons a verifier says "cannot prove" reported separately: a real bug '
        + 'with an integer counter-example, an annotation too weak, and arithmetic weaker than '
        + 'the programme.',
      intuition: 'A verifier does not sample inputs, so it finds the bugs nobody imagined an '
        + 'input for — which is why the binary-search overflow survived decades of review and '
        + 'not one verification run.',
      formulation: {
        equations: [
          {
            label: 'Five programmes, conditions generated and discharged',
            expr: 'programme · conditions · discharged · what fails',
            terms: [
              { sym: 'midpoint, lo + hi', meaning: '1 · 0 · an integer state: lo = 625, hi = 875, sum = 1500' },
              { sym: 'midpoint, lo + (hi - lo)', meaning: '1 · 1 · nothing' },
              { sym: 'counting loop with its invariant', meaning: '6 · 5 · one condition, only over the rationals' },
              { sym: 'the same loop without it', meaning: '2 · 1 · an unreachable state: n = -1, i = -1' },
              { sym: 'max of two values', meaning: '4 · 4 · nothing, over 3 paths' }
            ]
          },
          {
            label: 'The three failures, and what each one means',
            expr: 'evidence · diagnosis',
            terms: [
              { sym: 'an integer state satisfying the assumptions', meaning: 'a bug in the programme' },
              { sym: 'a state the precondition forbids', meaning: 'an annotation too weak to carry the fact' },
              { sym: 'only a fractional state, and no rounding of it', meaning: 'the theory is weaker than the programme' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Only the invariant crosses a loop boundary',
          why: 'It is what makes verification finite where execution is not.',
          breaks: 'Everything else known before the loop is discarded, which is why a missing invariant produces an unreachable counter-example.'
        },
        {
          name: 'A condition is discharged by refuting its negation',
          why: 'Unsatisfiable is a proof; satisfiable comes with the state where the programme is wrong.',
          breaks: 'The solver is asked about the assumptions together with the negated goal, never about the goal alone.'
        },
        {
          name: 'Nothing infers an invariant',
          why: 'A verifier that weakened an annotation it could not prove would be proving a different programme.',
          breaks: 'A missing invariant produces fewer conditions and no proof — 2 instead of 6 on the counting loop.'
        },
        {
          name: 'A fractional counter-example is reported as one',
          why: 'Program variables are integers, and calling a rational refutation a bug sends engineers to change correct code.',
          breaks: 'Every rounding of the model is re-checked; only a rounding that still refutes the goal is called a failure.'
        }
      ],
      complexity: [
        { operation: 'weakest precondition of a block', average: 'one substitution per assignment', worst: 'the same; it is syntactic' },
        { operation: 'conditions from a branch', average: 'the paths multiply', worst: 'exponential in nested branches, which is why tools name intermediate states' },
        { operation: 'conditions from a loop', average: 'three per invariant clause', worst: 'the same — the cut is what makes it constant' },
        { operation: 'discharging one condition', average: 'a linear-arithmetic query', worst: 'undecidable in general; here, Fourier-Motzkin elimination' },
        { operation: 'the integer witness search', average: '2 to the number of variables roundings', worst: 'capped at 6 variables, and one-sided by construction' }
      ],
      failureModes: [
        {
          symptom: 'A verifier reports "cannot prove" and nobody can tell why.',
          cause: 'Three different situations share one message: a bug, a weak annotation, and a weak theory.',
          fix: 'Separate them in the report — an integer counter-example, an unreachable one, and a fractional one mean different work.'
        },
        {
          symptom: 'A proof goes through and the program is still wrong.',
          cause: 'The specification was wrong, or too weak to say anything useful.',
          fix: 'Review the postconditions the way you would review the code; a proof of the wrong property is worth nothing.'
        },
        {
          symptom: 'Verification effort collapses under the annotation burden.',
          cause: 'It was applied to code that changes weekly instead of to code that is settled and sharp-edged.',
          fix: 'Verify index arithmetic, permission checks and lock-free structures; property-test the business logic.'
        },
        {
          symptom: 'An engineer changes correct code to satisfy the verifier.',
          cause: 'A fractional counter-example was read as a bug.',
          fix: 'Round it and re-check before acting; if no rounding refutes the goal, the complaint is about the rationals.'
        }
      ],
      inTheWild: [
        'Dafny, whose whole design is annotations plus an SMT solver.',
        'Frama-C and ACSL for C, and SPARK for Ada in avionics.',
        'seL4, a verified microkernel where the proof is larger than the code by an order of magnitude.',
        'CompCert, a verified C compiler, and the Csmith result that found no bugs in its verified middle end.'
      ],
      sources: [
        { title: 'Hoare — An axiomatic basis for computer programming', note: 'the triple, and the beginning of all of this' },
        { title: 'Dijkstra — A Discipline of Programming', note: 'weakest preconditions, computed backwards' },
        { title: 'Leino — Dafny: an automatic program verifier', note: 'what the technique looks like when it is usable' },
        { title: 'Bloch — Extra, extra: nearly all binary searches are broken', note: 'the overflow, and how long it survived' },
        { title: 'Reynolds — Separation logic', note: 'the frame problem, made local' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
