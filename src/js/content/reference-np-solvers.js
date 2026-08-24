/** Reference entries for solvers, hardness in practice and the workshop (M20.7-M20.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'using-solvers': {
      summary: 'One scheduling instance under six models — three at-most-one encodings with and ' +
        'without symmetry breaking — all agreeing with a hand-written search, plus the exact ' +
        'clause cost of at-most-one from five to two thousand literals and a slot sweep where ' +
        'the node count is a factorial.',
      intuition: 'Spend the effort on the model and the validation; the solver is a library, and ' +
        'the two cheap wins are symmetry breaking and checking the decoded answer.',
      formulation: {
        equations: [
          {
            label: 'At most one of n literals, three ways',
            expr: 'pairwise n(n − 1)/2 · commander O(n) · sequential 3n − 4',
            terms: [
              { sym: 'n = 5', meaning: '10 · 12 · 11 clauses, and 0 · 2 · 4 new variables' },
              { sym: 'n = 100', meaning: '4 950 · 350 · 296 clauses, and 0 · 52 · 99 variables' },
              { sym: 'n = 2 000', meaning: '1 999 000 · 6 999 · 5 996 clauses — a factor of 333' },
              { sym: 'the crossover', meaning: 'around twenty literals; use pairwise below and a counter above, in one model' }
            ]
          },
          {
            label: 'Six models of one NO instance, 18 tasks and 6 slots',
            expr: 'variables / clauses / nodes / propagations',
            terms: [
              { sym: 'pairwise', meaning: '108 / 720 / 1 439 / 18 010' },
              { sym: 'commander', meaning: '144 / 720 / 1 439 / 21 923' },
              { sym: 'sequential', meaning: '198 / 702 / 1 439 / 21 150' },
              { sym: 'each with symmetry breaking', meaning: '+6 clauses, 1 node, 73 to 94 propagations' }
            ]
          },
          {
            label: 'The slot sweep, and the factorial in it',
            expr: 'nodes without symmetry breaking against 2·c! − 1',
            terms: [
              { sym: '3 slots', meaning: '11 nodes, and 2 × 3! − 1 = 11' },
              { sym: '4 and 5 slots', meaning: '47 and 239, matching 2 × 4! − 1 and 2 × 5! − 1' },
              { sym: '6 slots', meaning: '1 439 nodes and 720 conflicts, matching 2 × 6! − 1 and 6!' },
              { sym: '7 and 8 slots', meaning: '17 and 19 — the answer is YES and the effect nearly vanishes' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every model of one instance gives the same answer',
          why: 'An encoding is a translation; a row that disagrees is a bug rather than a faster method.',
          breaks: 'A commander encoding that omits the "the commander implies its group" half is satisfiable where the source is not.'
        },
        {
          name: 'Auxiliary variables are allocated from one shared counter',
          why: 'Two constraints that each number their own fresh variables end up sharing variables that mean two different things.',
          breaks: 'A helper that returns a self-contained numbering is convenient and silently wrong the moment it is called twice.'
        },
        {
          name: 'Symmetry-breaking clauses must rule out no solution',
          why: 'Fixing a clique’s colours is safe because those vertices need distinct colours anyway; fixing arbitrary vertices is not.',
          breaks: 'Ordering constraints on non-adjacent vertices can exclude every optimal answer, turning SAT into UNSAT.'
        }
      ],
      complexity: [
        { operation: 'pairwise at-most-one', average: 'n(n − 1)/2 clauses, no new variables', worst: '1 999 000 clauses at n = 2 000' },
        { operation: 'commander at-most-one', average: 'O(n) clauses and O(n) variables, recursing over groups', worst: '6 999 clauses and 1 002 variables at n = 2 000' },
        { operation: 'sequential (Sinz) at-most-one', average: '3n − 4 clauses and n − 1 variables', worst: '5 996 clauses and 1 999 variables at n = 2 000' },
        { operation: 'sequential at-most-k', average: 'O(n·k) clauses and variables', worst: 'the dominant cost in the rostering model of 20.9 — 3 171 clauses for one requirement' },
        { operation: 'DPLL on the 6-slot colouring model', average: '1 439 nodes, whichever encoding', worst: 'exactly 2·c! − 1 for a clique of c asked for c − 1 slots' },
        { operation: 'the same with symmetry breaking', average: '1 node', worst: '12 nodes on the satisfiable side, where the effect is small' }
      ],
      failureModes: [
        {
          symptom: 'The model will not fit in memory.',
          cause: 'Pairwise at-most-one over a large group — half a million clauses at a thousand literals.',
          fix: 'Switch that group to a sequential or commander counter. The crossover is around twenty literals and the arithmetic is exact.'
        },
        {
          symptom: 'The solver is fast on small instances and hopeless one size up.',
          cause: 'Unbroken symmetry: a group of interchangeable objects multiplies the search by a factorial.',
          fix: 'Fix the assignment of one mutually-conflicting group. It rules out nothing and removes the whole factor.'
        },
        {
          symptom: 'Two encodings of the same constraint give different answers.',
          cause: 'One of them is wrong — usually a missing half of an equivalence, or shared auxiliary variables.',
          fix: 'Check every encoding exhaustively at small n against the semantics, before comparing any timings.'
        },
        {
          symptom: 'A benchmark shows the encoding making no difference at all.',
          cause: 'The solver branches on a fixed variable order, so auxiliary variables never change its search shape.',
          fix: 'Report clause counts and propagation counts alongside node counts, and say which solver produced them.'
        }
      ],
      inTheWild: [
        'Exam and shift timetabling encoded to SAT or MaxSAT, where symmetry breaking over interchangeable rooms and slots is standard.',
        'Hardware verification and equivalence checking, the industry that made CDCL solvers what they are.',
        'Package resolution in Dart, Swift and modern Python tooling, where the resolver is a small SAT solver.',
        'Configuration and feature-model analysis, where at-most-one over feature groups is the dominant constraint.'
      ],
      sources: [
        { title: 'Sinz — Towards an optimal CNF encoding of Boolean cardinality constraints (2005)', note: 'the sequential counter this section measures' },
        { title: 'Klieber and Kwon — Efficient CNF encoding for selecting 1 from N objects', note: 'the commander encoding' },
        { title: 'Biere, Heule, van Maaren and Walsh — Handbook of Satisfiability', note: 'the reference for encodings, symmetry breaking and solver behaviour' },
        { title: 'Crawford, Ginsberg, Luks and Roy — Symmetry-breaking predicates for search problems', note: 'why lex-leader constraints are safe and what they cost' },
        { title: 'Marques-Silva and Sakallah — GRASP: a search algorithm for propositional satisfiability', note: 'the conflict-driven learning this section’s DPLL deliberately lacks' }
      ]
    },

    'hardness-in-practice': {
      summary: 'The random 3-SAT phase transition measured over sixty instances per ratio with ' +
        'medians, quartiles and worst cases, and the runtime distribution of a stochastic solver ' +
        'on one instance over forty seeds with four restart cutoffs — including one that makes ' +
        'things much worse.',
      intuition: 'Hardness is a property of a distribution, not of a class, and when a cost ' +
        'distribution is heavy-tailed the fix is a cutoff rather than a faster algorithm.',
      formulation: {
        equations: [
          {
            label: 'The phase transition at 44 variables, 60 instances per point',
            expr: 'ratio · satisfiable fraction · median nodes · worst',
            terms: [
              { sym: '1.00 and 2.00', meaning: '100% satisfiable, medians 10 and 14, worst 17 and 19' },
              { sym: '4.00 and 4.27', meaning: '86.7% and 58.3%, medians 134 and 256' },
              { sym: '4.50 — the cost peak', meaning: '41.7% satisfiable, median 313, worst 931' },
              { sym: '6.00 and 8.00', meaning: '0% satisfiable, medians 137 and 53 — cheap again' }
            ]
          },
          {
            label: 'The two crossings, which are not the same point',
            expr: 'satisfiability crossover against cost peak',
            terms: [
              { sym: 'half satisfiable', meaning: 'ratio 4.38 by interpolation at 44 variables' },
              { sym: 'peak median cost', meaning: 'ratio 4.50' },
              { sym: 'the asymptotic value', meaning: '4.27; both measurements drift towards it as n grows' },
              { sym: 'why it matters', meaning: 'a benchmark generated outside the band is easy for a structural reason' }
            ]
          },
          {
            label: 'One instance, 40 seeds, WalkSAT flips',
            expr: 'median · mean · 90th percentile · worst · restarts',
            terms: [
              { sym: 'no restarts', meaning: '1 125 · 1 582 · 3 724 · 6 060 · —' },
              { sym: 'cutoff 1 000', meaning: '1 192 · 1 314 · 2 836 · 5 252 · 37' },
              { sym: 'cutoff 3 000', meaning: '1 125 · 1 566 · 4 051 · 5 442 · 7 — almost no effect' },
              { sym: 'cutoff 100', meaning: '4 670 · 6 747 · 17 580 · 20 384 · 2 666 — 4.3× worse than nothing' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every point on a phase-transition plot is many instances, not one',
          why: 'The transition is a property of the distribution; a single instance per ratio measures noise.',
          breaks: 'A curve drawn from one seed per ratio is not monotone and does not reproduce.'
        },
        {
          name: 'The reported statistic is the median, with the spread beside it',
          why: 'Near the threshold the mean is dominated by rare runs and moves between experiments.',
          breaks: 'Quoting a mean as "the solve time" makes a benchmark irreproducible with nobody at fault.'
        },
        {
          name: 'The restart comparison shares its random stream with the baseline',
          why: 'Otherwise part of any difference between them is the seeds rather than the strategy.',
          breaks: 'Running fresh trials for the restart column makes a 10% effect indistinguishable from sampling noise.'
        }
      ],
      complexity: [
        { operation: 'DPLL on random 3-SAT below the threshold', average: 'median 10 to 36 nodes at ratios 1 to 3.5', worst: '435 at ratio 3.5 — the tail begins before the transition does' },
        { operation: 'DPLL at the threshold', average: 'median 256 to 313 nodes at 44 variables', worst: '1 433 nodes; the peak grows exponentially with n' },
        { operation: 'DPLL above the threshold', average: 'median 137 at ratio 6 and 53 at ratio 8', worst: 'contradictions appear within a few decisions' },
        { operation: 'WalkSAT on a planted instance', average: 'median 1 125 flips over 40 seeds', worst: '6 060 flips — 5.4× the median, and it cannot report UNSAT at all' },
        { operation: 'WalkSAT with a well-chosen cutoff', average: 'mean 1 314 against 1 582', worst: '5 252, with 37 restarts across 40 runs' },
        { operation: 'WalkSAT with a cutoff below the median', average: 'mean 6 747 — worse than no restarts', worst: '20 384 flips and 2 666 restarts' }
      ],
      failureModes: [
        {
          symptom: 'A solver benchmarked on generated instances looks excellent and fails in production.',
          cause: 'The generator produced under-constrained instances, which are easy for a structural reason.',
          fix: 'Generate at the threshold ratio, and include a structural family such as pigeonhole.'
        },
        {
          symptom: 'The same job takes 30 seconds most days and 40 minutes occasionally.',
          cause: 'Heavy-tailed search runtime — an unlucky start wandered somewhere with no short path out.',
          fix: 'Measure the distribution, pick a cutoff above the median, and restart. Bound the total rather than the attempt.'
        },
        {
          symptom: 'Restarts were added and the job got slower.',
          cause: 'The cutoff is below the median, so every attempt is abandoned just short of finishing.',
          fix: 'Take the cutoff from the measured distribution. The demo’s shortest cutoff is 4.3× worse than none.'
        },
        {
          symptom: 'A benchmark cannot be reproduced by a colleague.',
          cause: 'A mean over a heavy-tailed sample, or too few instances per configuration.',
          fix: 'Report the median with quartiles and the instance count, and publish the seeds.'
        }
      ],
      inTheWild: [
        'SAT competition benchmark suites, which deliberately mix random threshold instances with industrial and crafted families.',
        'Hedged requests in distributed systems: the same argument, applied to a network rather than a search.',
        'Randomised restarts inside every modern CDCL solver, usually on a Luby sequence rather than a fixed cutoff.',
        'Job schedulers that cap and retry rather than waiting, which is a restart strategy whether or not it is called one.'
      ],
      sources: [
        { title: 'Cheeseman, Kanefsky and Taylor — Where the really hard problems are (1991)', note: 'the phase transition, and the paper that started this line' },
        { title: 'Mitchell, Selman and Levesque — Hard and easy distributions of SAT problems', note: 'the 4.27 threshold measured' },
        { title: 'Gomes, Selman and Kautz — Boosting combinatorial search through randomization (1998)', note: 'heavy tails and the restart argument' },
        { title: 'Luby, Sinclair and Zuckerman — Optimal speedup of Las Vegas algorithms', note: 'the universal restart schedule when the distribution is unknown' },
        { title: 'Williams, Gomes and Selman — Backdoors to typical case complexity', note: 'why industrial instances with millions of variables solve at all' }
      ]
    },

    'reduction-workshop': {
      summary: 'A rostering scenario encoded to CNF, solved, decoded and then checked against ' +
        'every stated requirement by code sharing nothing with the encoder, with the ' +
        'preferences the model cannot carry listed alongside what the answer achieved on them, ' +
        'and a feasibility frontier where "no answer" arrives in two different forms.',
      intuition: 'The failure mode is not a slow solver but a model that quietly answers a ' +
        'different question, and validating the decoded answer against the original ' +
        'requirements is the only defence.',
      formulation: {
        equations: [
          {
            label: 'Five requirements, and what each cost to encode',
            expr: 'clauses · auxiliary variables, for 9 nurses over 7 days',
            terms: [
              { sym: 'at most one shift per nurse per day', meaning: '189 clauses, 0 auxiliary — pairwise over three literals' },
              { sym: 'exactly the required headcount per shift', meaning: '3 171 clauses, 1 512 auxiliary — two cardinality counters per shift' },
              { sym: 'no day shift after a night shift', meaning: '54 clauses, 0 auxiliary' },
              { sym: 'at most 5 shifts each, and a rest day per window of 4', meaning: '1 935 + 2 664 clauses, 900 + 1 188 auxiliary' }
            ]
          },
          {
            label: 'The model, the solve and the check',
            expr: 'one instance end to end',
            terms: [
              { sym: 'the formula', meaning: '3 789 variables of which 3 600 are counters, and 8 013 clauses' },
              { sym: 'the solve', meaning: '4 707 DPLL nodes in 813 ms' },
              { sym: 'the validation', meaning: '5 of 5 requirements hold, checked against the grid rather than the formula' },
              { sym: 'what it did not say', meaning: 'shifts per nurse 5, 5, 5, 5, 5, 4, 2, 2, 2 — a spread of 3' }
            ]
          },
          {
            label: 'The feasibility frontier: 6 days, demand 2/1/1, cap 4 shifts',
            expr: 'nurses · capacity · required · what the solver said',
            terms: [
              { sym: '4 nurses', meaning: 'capacity 16 against 24 required — proved infeasible in 14 663 nodes' },
              { sym: '5 nurses', meaning: 'capacity 20 against 24 — budget exhausted at 40 000 nodes, and NO proof' },
              { sym: '6 nurses', meaning: 'capacity 24 against 24 — feasible, 6 327 nodes, validates' },
              { sym: '7 and 8 nurses', meaning: '247 and 33 nodes; slack makes the instance collapse' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The validator shares no code with the encoder',
          why: 'A checker derived from the model checks the model, and agrees with a wrong one exactly as happily.',
          breaks: 'Reusing the encoder’s variable-indexing helper inside the checker makes an off-by-one invisible to both.'
        },
        {
          name: 'Every requirement is reported separately',
          why: 'A single pass-or-fail hides which requirement drifted, which is the only information worth having.',
          breaks: 'An assertion that the whole schedule "is valid" tells an operator nothing they can act on.'
        },
        {
          name: 'A budget overrun is never reported as infeasibility',
          why: 'One is a claim about every schedule and the other is a claim about one run.',
          breaks: 'An API that returns null for both makes a team relax a requirement that did not need relaxing.'
        }
      ],
      complexity: [
        { operation: 'encoding the roster', average: 'O(nurses · days · shifts) for the local rules', worst: 'the cardinality counters dominate: 5 511 of the 8 013 clauses' },
        { operation: 'solving it', average: '4 707 nodes at 9 nurses; 33 at 8 nurses on the shorter horizon', worst: 'exhausts a 40 000-node budget one step below the feasibility boundary' },
        { operation: 'decoding', average: 'O(nurses · days · shifts) — one pass over the assignment', worst: 'the same; it detects a nurse with two shifts rather than picking one' },
        { operation: 'validating', average: 'O(nurses · days) per requirement, five requirements', worst: 'milliseconds, against seconds for the solve — the cheapest step in the pipeline' },
        { operation: 'the counting check', average: 'O(1) — capacity against demand', worst: 'free, exact, and it classifies both infeasible rows correctly before any solving' }
      ],
      failureModes: [
        {
          symptom: 'The optimiser produces schedules the domain experts reject.',
          cause: 'The model carries the hard constraints and none of the preferences, and nobody wrote down which were which.',
          fix: 'List the unmodelled requirements explicitly and report what each answer achieved on them. Then decide whether to move to MaxSAT or ILP.'
        },
        {
          symptom: 'The solver returns UNSAT and nobody knows which requirement to relax.',
          cause: 'A solver’s UNSAT names no requirement; the diagnosis has to be built.',
          fix: 'Check the counting arguments first, then request an unsatisfiable core, then re-solve with each constraint group dropped.'
        },
        {
          symptom: 'A model that worked for months starts producing subtly wrong answers.',
          cause: 'A requirement changed and an encoding assumption that used to be implied stopped being implied.',
          fix: 'Keep the independent validator in the pipeline, not just in the test suite; it catches drift on the run it happens.'
        },
        {
          symptom: 'A polynomial problem is being solved with a general-purpose solver.',
          cause: 'It was modelled as scheduling when it is assignment — bipartite matching or min-cost flow.',
          fix: 'Check the catalogue before encoding. Recognition is most of the work, and half of "NP-hard" claims are misidentifications.'
        }
      ],
      inTheWild: [
        'Nurse and driver rostering, which is where most of the constraint-programming literature on this pattern comes from.',
        'Cloud capacity planning and bin packing, usually ILP with an objective and a hard feasibility core.',
        'Course and exam timetabling, colouring with a long list of soft preferences bolted on.',
        'Compiler register allocation, which is colouring with spilling as the objective the pure model cannot express.'
      ],
      sources: [
        { title: 'Garey and Johnson — Computers and Intractability, appendix', note: 'the catalogue that makes recognition possible' },
        { title: 'Burke et al. — The state of the art of nurse rostering', note: 'the constraint families and which are hard against soft in practice' },
        { title: 'Williams — Model Building in Mathematical Programming', note: 'the standard reference for turning a requirement into constraints honestly' },
        { title: 'Biere et al. — Handbook of Satisfiability, chapters on applications', note: 'encoding practice, unsatisfiable cores and MaxSAT' },
        { title: 'Hooker — Integrated Methods for Optimization', note: 'when to use SAT, when ILP, when CP, and how to combine them' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
