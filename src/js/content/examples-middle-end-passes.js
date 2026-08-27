/** Worked examples for SSA, dataflow and the scalar passes (M29.4-M29.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'ssa-form': [
      {
        title: 'Nine phis placed, three pruned, and the difference that names the form',
        goal: 'Measure what "pruned SSA" means instead of describing it.',
        setup: 'Four conformance programs that need a phi at all are constructed twice: once ' +
          'with phis at the iterated dominance frontier of every writing block, and once with ' +
          'the unread ones removed to a fixpoint.',
        steps: [
          { do: 'Sum the placed and the kept columns.',
            why: 'The two numbers the two forms report.',
            work: '9 placed, 3 pruned, 6 kept' },
          { do: 'Find the program with the largest gap.',
            why: 'Where the placement rule is most generous.',
            work: 'match — 4 placed, 2 pruned, 2 kept' },
          { do: 'Say why pruning is a fixpoint and not a sweep.',
            why: 'One removal can make another phi unread.',
            work: '3 removals across the 4 programs, repeated until nothing more is removable' },
          { do: 'Count the slots promoted on the loop sample and the reads with no definition.',
            why: 'A promotion that cannot find a reaching definition is a resolver bug.',
            work: '4 slots promoted, 0 reads found no definition on any path' },
          { do: 'Read the two surviving phis at the loop header.',
            why: 'A loop-header phi always has one entry from outside and one from the latch.',
            work: '%21 for the loop index and %20 for the accumulator, each with a b0 and a b2 ' +
              'entry' }
        ],
        answer: 'Nine phis reduce to six once the unread ones go, and the third of them removed ' +
          'is exactly the distance between minimal and pruned SSA. The placement rule is stated ' +
          'over the blocks that WRITE a local, without asking whether anything reads the ' +
          'result, which is what makes it simple enough to be obviously correct; the pruning ' +
          'pass is what makes it economical. Splitting the job that way is the same principle ' +
          'as leaving the copies for 29.6 to remove.'
      },
      {
        title: 'A swap that no Berugo program can write',
        goal: 'Test the branch of SSA destruction that the language cannot reach.',
        setup: 'Destruction replaces each phi with copies in its predecessors. Where two phis ' +
          'name each other, the copies must be sequenced and a cycle needs a temporary.',
        steps: [
          { do: 'Count the copies destruction inserts across the four real programs.',
            why: 'The baseline: a phi becomes one copy per predecessor.',
            work: '2, 4, 2 and 4 copies, and 0 temporaries anywhere' },
          { do: 'Read the hand-built loop.',
            why: 'Two of its three phis have each other as operands; the third is the counter ' +
              'that makes the loop finite enough to run.',
            work: '3 phis, 7 copies, 1 temporary' },
          { do: 'Ask why no real program produces one.',
            why: 'The surface language rules the shape out.',
            work: '0 of the 4 real programs — Berugo sequences its assignments, so writing ' +
              'a swap requires a third variable, and that variable breaks the cycle ' +
              'before SSA sees it' },
          { do: 'Say where a cycle does come from.',
            why: 'Other languages and other passes reach it easily.',
            work: '3 sources — simultaneous assignment, tuple binding, or an earlier pass ' +
              'that rotated copies' },
          { do: 'Check behaviour on all five.',
            why: 'Destruction is where a wrong sequence produces a wrong program silently.',
            work: '5 of 5 preserved' }
        ],
        answer: 'Four of the five cases need no temporary and the fifth is built by hand. That ' +
          'is the honest result: the cycle breaker earns nothing on this language and still has ' +
          'to be right, because the first program that needs it will be produced by a later ' +
          'pass rather than by a programmer. Leaving it as an untested branch is how a compiler ' +
          'acquires a bug that only appears after some unrelated optimisation is enabled.'
      }
    ],

    'dataflow-analysis': [
      {
        title: 'One solver, four analyses, and the field that is easy to get wrong',
        goal: 'Show that the classical analyses differ only in their parameters.',
        setup: 'The framework table lists direction, meet, initial value and the question each ' +
          'analysis answers; the same worklist solver runs all four.',
        steps: [
          { do: 'Read the direction and meet for liveness.',
            why: 'The analysis the register allocator in M30 will need.',
            work: 'row 1 of 4 — backward, union: a fact holds if it holds on SOME path' },
          { do: 'Read them for available expressions.',
            why: 'The opposite corner of the same table.',
            work: 'row 3 of 4 — forward, intersect: on EVERY path' },
          { do: 'Pair each meet with its initial value.',
            why: 'These two must match or the fixpoint is wrong.',
            work: '2 unions start at empty; 2 intersections start at everything' },
          { do: 'Say what happens if an intersection analysis starts at empty.',
            why: 'This is the classic mistake and it is silent.',
            work: '0 facts everywhere — it converges immediately and reports a perfectly ' +
              'well-formed fixpoint' },
          { do: 'Compare the cost of the four on the same four-block function.',
            why: 'The direction and meet change the work, not just the answer.',
            work: 'liveness 1.50 visits per block, reaching 1.75, available 1.00, busy 2.00' }
        ],
        answer: 'Four analyses, one algorithm, and the only field that can fail silently is the ' +
          'initial value. Everything else about a wrong parameterisation shows up as a wrong ' +
          'answer somewhere; an intersection analysis started at the bottom of its lattice ' +
          'reaches a fixpoint on the first visit and reports it confidently. The cost column ' +
          'says the choice is not free either: the same function costs twice as many visits ' +
          'for very-busy expressions as for available ones.'
      },
      {
        title: 'Liveness checked by enumerating paths',
        goal: 'Prove a worklist solver right against the definition of the fact it computes.',
        setup: 'The oracle asks the definition: a register is live out of a block when some ' +
          'path from a successor reads it before anything on that path writes it. That ' +
          'enumerates paths and is exponential.',
        steps: [
          { do: 'Count the fixtures and the agreements.',
            why: 'Five graphs of different shapes, including two with loops.',
            work: '5 of 5 agree exactly' },
          { do: 'Read the loop fixture\'s cost.',
            why: 'A loop is where a worklist earns its name.',
            work: '4 blocks, 6 visits, 5 live registers' },
          { do: 'Compare with the straight-line one.',
            why: 'No cycle means no re-examination.',
            work: '1 block, 1 visit, 0 live registers' },
          { do: 'Read the fixpoint sets for the loop and note the direction.',
            why: 'A backward analysis is read OUT first, then IN.',
            work: 'b1 has %4 in and %22, %23, %4 out' },
          { do: 'Say what a subtly wrong liveness analysis costs.',
            why: 'The consumer is a register allocator.',
            work: '1 missing register is enough — code that works on every test where the ' +
              'wrong path was not taken' }
        ],
        answer: 'Five fixtures, five exact agreements, and the value is in what the oracle is: ' +
          'a path enumeration that cannot be subtly wrong and cannot be run on anything real. ' +
          'Reading the backward sets in source order is the commonest way to conclude the ' +
          'solver is broken when it is not — the facts travelled from the successors, so OUT ' +
          'is computed first and IN is what the block\'s transfer function makes of it.'
      }
    ],

    'scalar-optimisations': [
      {
        title: 'SCCP against the two things it is made of',
        goal: 'Show a combination doing what neither component can.',
        setup: 'The guarded fixture divides by a value that is only reachable when a condition ' +
          'the propagator cannot fold is true. Four pipelines are run on it.',
        steps: [
          { do: 'Read the size after SSA construction alone.',
            why: 'The starting point, full of the copies promotion left behind.',
            work: '15 instructions' },
          { do: 'Run constant folding without reachability.',
            why: 'Propagation on its own.',
            work: '12 instructions, 0 blocks removed, 0 branches straightened, 0 values folded' },
          { do: 'Run SCCP.',
            why: 'The same two analyses, run to a joint fixpoint.',
            work: '7 instructions, 1 block removed, 1 branch straightened, 5 values folded' },
          { do: 'Say what the difference is on this program.',
            why: 'The extra instructions are not arbitrary.',
            work: '5 instructions, one of them a division by zero that propagation alone ' +
              'must leave, because folding it would be wrong on a branch it cannot ' +
              'prove dead' },
          { do: 'Run the full pipeline and compare.',
            why: 'What the remaining four passes add on top.',
            work: '6 instructions — 19 down to 6, 68.4% removed' }
        ],
        answer: 'Twelve against seven, and the five instructions between them are the point of ' +
          'combining the analyses. Propagation is blocked because it cannot prove the branch ' +
          'dead; elimination is blocked because it cannot fold the condition. Run to a joint ' +
          'fixpoint each unblocks the other, and a phi then meets only the operands arriving on ' +
          'live edges — which is the clause that makes a value constant on every reachable path ' +
          'stay constant. SCCP is not a better folder; it answers a different question.'
      },
      {
        title: 'Phase ordering, measured on five fixtures',
        goal: 'Turn "the order of passes matters" into a table with a sign on it.',
        setup: 'Two passes are chosen from the pipeline and run in both orders on each fixture; ' +
          'the difference in final instruction count is reported.',
        steps: [
          { do: 'Count the fixtures where the two orders differ.',
            why: 'If the answer were "never", phase ordering would not be a problem.',
            work: '3 of 5 differ' },
          { do: 'Read the sign of the differences.',
            why: 'A consistent sign would mean one order simply wins.',
            work: 'guarded 6 against 7, redundant 5 against 6, folding 6 against 7 — all ' +
              'three favour the first order' },
          { do: 'Read the two that do not move.',
            why: 'Not every program is sensitive to the order.',
            work: 'identities at 36 both ways and loop at 25 both ways' },
          { do: 'Say what a compiler does about it.',
            why: 'There is no order that is best everywhere.',
            work: '0 orders win everywhere — pick one by measurement over a benchmark ' +
              'suite, and run the cheap passes twice' },
          { do: 'Check the peephole rules on the identities fixture.',
            why: 'The fixture where the rewrite rules have something to do.',
            work: '4 of 5 rules fire, and the program goes 45 to 24 — 46.7% removed' }
        ],
        answer: 'Three of five fixtures give different code depending on the order, which is ' +
          'the phase-ordering problem at a scale small enough to read. Neither order dominates ' +
          'on this suite, so there is nothing to conclude except that a real compiler picks by ' +
          'measurement and accepts that some program gets the worse of it. The peephole column ' +
          'makes the same kind of admission: four of five rules fire on the fixture built for ' +
          'them, and none of them fires on the guarded program at all.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
