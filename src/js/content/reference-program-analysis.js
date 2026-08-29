/** Reference entries for the foundations and abstract interpretation (M32.1-M32.2). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'static-analysis-foundations': {
      summary: 'One programme analysed four ways with the reported answer beside the true one ' +
        'from an actual run, soundness and precision reported as two separate numbers, the ' +
        'sound/complete quadrant with what each row\'s silence means, and the four precision ' +
        'axes with the cost of each.',
      intuition: 'Rice\'s theorem removes the exact answer, so every analyser is wrong in one ' +
        'of two directions, and the only question worth asking about a tool is which one — ' +
        'because that decides whether a clean report is a proof or a shrug.',
      formulation: {
        equations: [
          {
            label: 'The counting loop, one run of 51 observed values, four precisions',
            expr: 'domain · claims · exact · saying nothing · values outside',
            terms: [
              { sym: 'sign', meaning: '15 · 8 · 7 · 0' },
              { sym: 'parity', meaning: '15 · 11 · 0 · 0' },
              { sym: 'intervals, widening only', meaning: '15 · 8 · 5 · 0' },
              { sym: 'intervals, widening then narrowing', meaning: '15 · 8 · 0 · 0' }
            ]
          },
          {
            label: 'The nested loop, 39 claims and 312 observed values',
            expr: 'domain · exact · at the top of the lattice',
            terms: [
              { sym: 'sign and parity', meaning: '3 · 36 — neither can express a bound' },
              { sym: 'intervals, widening only', meaning: '7 · 32' },
              { sym: 'intervals with narrowing', meaning: '11 · 28' },
              { sym: 'values outside the claim, all four', meaning: '0 of 312' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Soundness is claimed with respect to a stated property, never on its own',
          why: 'The same tool can be sound for null dereferences and neither sound nor complete for races.',
          breaks: 'Every claim in this milestone names the property: the values a numeric local can hold at a program point.'
        },
        {
          name: 'A dynamic oracle refutes and never confirms',
          why: 'It observes one execution, so zero violations is the absence of evidence rather than evidence of absence.',
          breaks: 'The observation count is printed beside every verdict; with zero observations every analysis passes.'
        },
        {
          name: 'Precision and soundness are reported separately',
          why: 'A single score lets the analysis that says "any value is possible" win, since it is perfectly sound.',
          breaks: 'Violations must be zero; exactness and top-of-lattice counts are the second, independent column.'
        }
      ],
      complexity: [
        { operation: 'flow-sensitive analysis', average: 'one abstract state per program point', worst: 'the same; this axis is cheap and nearly universal' },
        { operation: 'path sensitivity', average: 'exponential in the branches on the path', worst: 'unbounded with loops, which is why 32.4 bounds its search' },
        { operation: 'context sensitivity', average: 'one summary per calling context', worst: 'exponential; real tools k-limit it or drop it' },
        { operation: 'field sensitivity', average: 'one abstract location per field', worst: 'plus the aliasing between them, which is the expensive part' },
        { operation: 'the dynamic soundness check', average: 'linear in the observed values', worst: 'the same, and it proves nothing about unobserved runs' }
      ],
      failureModes: [
        {
          symptom: 'A clean report from a linter is read as evidence the bug is absent.',
          cause: 'The tool is neither sound nor complete, so its silence carries no information.',
          fix: 'Find the sentence in its documentation that states the guarantee; if it is about the reports it makes, silence means nothing.'
        },
        {
          symptom: 'A team disables a checker because it "produces too much noise".',
          cause: 'A sound analysis over-approximates, and the merges are creating false positives faster than anyone triages them.',
          fix: 'Raise the precision on the axis that matters for the property, or narrow the scope; do not raise the threshold until the tool is silent.'
        },
        {
          symptom: 'Two tools disagree about the same code and both look right.',
          cause: 'They approximate in opposite directions, so one reports the impossible and the other misses the real.',
          fix: 'Classify each one on the quadrant first; the disagreement is usually not a bug in either.'
        },
        {
          symptom: 'An analysis reports nothing at all about the largest functions.',
          cause: 'It hit an internal budget and gave up, and the report does not distinguish that from a clean result.',
          fix: 'Look for the tool\'s timeout or size-limit diagnostics; findings for a function it abandoned are not weaker evidence, they are none.'
        }
      ],
      inTheWild: [
        'The soundiness manifesto, which documents that essentially every published "sound" analyser has deliberate unsound corners.',
        'Facebook Infer, whose separation-logic analysis is sound for a stated property and deliberately incomplete.',
        'Coverity and similar commercial tools, tuned for a report rate that engineers keep reading rather than for either guarantee.',
        'The C and C++ compilers\' -Wmaybe-uninitialized, a famous case of a merge creating a warning about a path that cannot happen.'
      ],
      sources: [
        { title: 'Nielson, Nielson, Hankin — Principles of Program Analysis', note: 'the standard text; chapter 1 sets up exactly this framing' },
        { title: 'Rice — Classes of recursively enumerable sets and their decision problems', note: 'the theorem that makes approximation mandatory' },
        { title: 'Livshits et al. — In defense of soundiness', note: 'what "sound" means in shipped tools, written by the people who ship them' },
        { title: 'Bessey et al. — A few billion lines of code later', note: 'the commercial reality of false-positive rates and what users tolerate' }
      ]
    },

    'abstract-interpretation': {
      summary: 'The fixpoint as a table: the ascending chain at each loop header round by ' +
        'round, widening throwing a moving bound to infinity in one step, narrowing ' +
        'recovering [0, 11], the same programme in three domains, and a join-only run that ' +
        'exhausts its budget and produces a claim one execution refutes 1 207 times.',
      intuition: 'Widening is deliberate surrender at loop headers, and it is the only reason ' +
        'the analysis finishes on a loop whose bound nobody knows — everything a tool gets ' +
        'wrong about loops traces back to it.',
      formulation: {
        equations: [
          {
            label: 'Rounds of the ascending pass against the distance the loop counts',
            expr: 'bound · join only · with widening',
            terms: [
              { sym: '10', meaning: '8 · 3' },
              { sym: '100', meaning: '53 · 3' },
              { sym: '200', meaning: '103 · 3' },
              { sym: 'a parameter', meaning: 'never converges · 3' }
            ]
          },
          {
            label: 'The loop counting to 1000, join only, 200-round budget',
            expr: 'what it claims · what the run shows',
            terms: [
              { sym: 'at the loop header', meaning: 'x in [0, 398] · x reaches 1000' },
              { sym: 'observed values outside the claim', meaning: '1 207 of 4 011' },
              { sym: 'the block after the loop', meaning: 'bottom — claimed unreachable' },
              { sym: 'the same loop with widening', meaning: '[0, 1001] · 0 of 4 011 outside' }
            ]
          },
          {
            label: 'Nested loops: what narrowing recovers and what it does not',
            expr: 'variable · after widening · after narrowing · the truth',
            terms: [
              { sym: 'inner counter j', meaning: '[0, +infinity] · [0, 3] · [0, 3]' },
              { sym: 'outer counter i', meaning: '[0, +infinity] · [0, +infinity] · [0, 5]' },
              { sym: 'claims at the top', meaning: '32 of 39 · 28 of 39' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Widening is applied at loop headers and nowhere else',
          why: 'Applying it at every merge also terminates, and destroys the precision of every branch in the programme.',
          breaks: 'Headers are the targets of back edges, computed from the CFG rather than guessed from syntax.'
        },
        {
          name: 'Narrowing may only replace an infinite bound with a finite one',
          why: 'Allowing any bound to move re-opens the ascending chain and the descending pass stops terminating too.',
          breaks: 'The narrow operator takes the new bound only where the old one is infinite.'
        },
        {
          name: 'A result below the least fixpoint is unsound, not imprecise',
          why: 'Above the fixpoint the claim holds for every execution; below it, the programme itself is a counter-example.',
          breaks: 'The report carries whether the last round changed anything, so a budget exhaustion cannot be mistaken for convergence.'
        }
      ],
      complexity: [
        { operation: 'one round of the fixpoint', average: 'one transfer per instruction, one join per edge', worst: 'the same; the cost is in the number of rounds' },
        { operation: 'rounds, join only', average: 'one per loop iteration', worst: 'unbounded when the trip count is symbolic' },
        { operation: 'rounds, with widening', average: 'a small constant per loop header', worst: 'bounded by the height of the widened chain, which is finite by construction' },
        { operation: 'the interval domain', average: 'two numbers per variable per program point', worst: 'the same; it is non-relational, which is why it is cheap' },
        { operation: 'the octagon domain', average: 'quadratic space in the variables', worst: 'cubic time per operation, and the usual reason a relational domain is dropped' }
      ],
      failureModes: [
        {
          symptom: 'The analyser reports nothing useful about any loop.',
          cause: 'Widening threw the bound away and nothing on the path back to the header narrows it.',
          fix: 'Widening with thresholds: take the constants in the loop test as candidate bounds before jumping to infinity.'
        },
        {
          symptom: 'The analysis takes minutes on one function and seconds on the rest.',
          cause: 'Widening is not being applied at a header, so the chain is ascending one iteration per round.',
          fix: 'Check the back-edge detection; a header missed by the CFG analysis is a loop analysed by brute force.'
        },
        {
          symptom: 'A tool claims a block is unreachable and it plainly is not.',
          cause: 'The iteration stopped on a budget before the state reached that block, and bottom was reported as a result.',
          fix: 'Treat a non-converged analysis as no result at all; never propagate its states into an optimiser.'
        },
        {
          symptom: 'The analysis is unsound on one operation and nothing else.',
          cause: 'A transfer function that is subtly too narrow — interval multiplication that forgot the negative corners is the classic.',
          fix: 'A dynamic oracle over the fixture programmes: every observed value must lie inside the claim at that point.'
        }
      ],
      inTheWild: [
        'Astree, which proves the absence of run-time errors in Airbus flight control code and is essentially a widening strategy with a domain library attached.',
        'Facebook Infer and the SPARTA framework, both built on this fixpoint shape.',
        'GCC and LLVM value-range propagation, which is an interval analysis with a compiler\'s time budget.',
        'The Rust borrow checker\'s dataflow passes, the same iterate-to-fixpoint machinery over a different lattice.'
      ],
      sources: [
        { title: 'Cousot, Cousot — Abstract interpretation: a unified lattice model (1977)', note: 'the original; the widening operator is in it' },
        { title: 'Cousot, Cousot — Comparing the Galois connection and widening/narrowing approaches', note: 'why narrowing is restricted the way it is' },
        { title: 'Mine — The octagon abstract domain', note: 'the standard relational domain, with its cost stated honestly' },
        { title: 'Blanchet et al. — A static analyzer for large safety-critical software', note: 'Astree: what it takes to make this work on real code' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
