/** Worked examples for static-analysis foundations and abstract interpretation (M32.1-M32.2). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'static-analysis-foundations': [
      {
        title: 'One loop, one property, four precisions',
        goal: 'Watch soundness stay constant while precision moves, and measure both.',
        setup: 'The programme is `let x = 0; let n = 10; while (x < n) { x = x + 2; } let r = ' +
          'x;`. The property is "which values can each local hold at each program point". It ' +
          'is analysed four ways and run once, and every observed value is checked against ' +
          'every claim.',
        steps: [
          { do: 'Run the programme and count what the check has to work with.',
            why: 'A soundness verdict is worth exactly the observations behind it.',
            work: '13 block visits, 26 snapshots, 51 observed numeric values' },
          { do: 'Analyse with the sign domain and read the two columns.',
            why: 'The cheapest domain, and it cannot express a bound at all.',
            work: '15 claims, 8 exact, 7 at the top of the lattice, 0 values outside' },
          { do: 'Analyse with parity.',
            why: 'A different fact, not a more precise one.',
            work: '15 claims, 11 exact, 0 at the top, 0 values outside' },
          { do: 'Analyse with intervals, widening only.',
            why: 'Now the domain can express the bound, and the operator has thrown it away.',
            work: '15 claims, 8 exact, 5 saying nothing, 0 values outside' },
          { do: 'Add the narrowing pass.',
            why: 'The same domain, one more pass over the same graph.',
            work: '15 claims, 8 exact, 0 saying nothing, 0 values outside' }
        ],
        answer: 'All four are sound — 0 of 51 observed values fell outside any claim — and ' +
          'they differ entirely in how much they say. That is the point of separating the two ' +
          'measurements: an analysis that answered "any value is possible" everywhere would ' +
          'score a perfect 0 violations and be worthless. Note also that "exact" is not ' +
          'comparable across domains: parity scores 11 exact by making claims like "even", ' +
          'which are true, cheap and no use for a bounds check.'
      },
      {
        title: 'The nested loop, where three of the four levels say almost nothing',
        goal: 'See precision collapse on a program shape that is completely ordinary.',
        setup: 'Two nested loops: the outer runs five times, the inner three, and a counter ' +
          '`t` is incremented in the inner body. 39 claims are reachable, and the run ' +
          'produces 312 observed values.',
        steps: [
          { do: 'Analyse with sign and with parity.',
            why: 'Neither domain can express what the loops are doing to the counter.',
            work: 'both: 3 of 39 claims exact, 36 of 39 at the top of the lattice' },
          { do: 'Analyse with intervals and widening only.',
            why: 'The domain can now express a bound; the operator has thrown two away.',
            work: '7 of 39 exact, 32 at the top' },
          { do: 'Add narrowing and count what comes back.',
            why: 'The descending pass recovers what the branch conditions justify.',
            work: '11 of 39 exact, 28 at the top' },
          { do: 'Look at which claims were recovered.',
            why: 'The recovery is not spread evenly, and the pattern is the lesson.',
            work: 'the inner counter comes back to [0, 3] exactly; the outer stays [0, +∞]' },
          { do: 'Check soundness across all four.',
            why: 'Precision collapsed and correctness did not.',
            work: '0 violations over 312 observed values, in every level' }
        ],
        answer: 'A completely ordinary nested loop leaves 28 of 39 claims at the top of the ' +
          'lattice even at the best precision this analysis offers, and every one of those ' +
          'claims is sound. This is what "sound and useless" looks like in practice, and it is ' +
          'why a tool that reports nothing about your loops is not necessarily broken — it is ' +
          'reporting the truth about what it was able to derive. The number to look at is not ' +
          'the violation count, which is zero for a tool that says nothing at all.'
      }
    ],

    'abstract-interpretation': [
      {
        title: 'Widening costs a bound and buys termination that does not depend on the program',
        goal: 'Price the operator by running the same analysis with and without it.',
        setup: 'The loop `while (x < n) { x = x + 2; }` with n a literal, analysed with the ' +
          'interval domain. Rounds are counted for the ascending pass only, and the bound is ' +
          'moved from 10 to 300.',
        steps: [
          { do: 'Analyse with the join alone at a bound of 10, 50, 100 and 200.',
            why: 'Each round admits exactly one more loop iteration.',
            work: '8, 28, 53 and 103 rounds — one per iteration, plus three' },
          { do: 'Analyse with widening at the same four bounds.',
            why: 'The bound is thrown away rather than followed.',
            work: '3 rounds at every one of them' },
          { do: 'Compare the answers the two produce at a bound of 10.',
            why: 'The obvious worry is that widening is buying speed with precision here.',
            work: 'identical: x in [0, 11] at the loop header, from both' },
          { do: 'Read the ascending chain the join produced.',
            why: 'The shape is the argument.',
            work: '[0, 0], [0, 2], [0, 4], [0, 6], [0, 8], [0, 10], [0, 11], then stable' },
          { do: 'Read the chain widening produced.',
            why: 'Two steps, and the second is the surrender.',
            work: '[0, 0], then [0, +∞], then unchanged — narrowing returns it to [0, 11]' }
        ],
        answer: 'On this loop widening costs nothing at all: the same answer, in 3 rounds ' +
          'instead of 8, and in 3 rounds instead of 103 when the bound is 200. The cost is ' +
          'real elsewhere — the nested fixture keeps [0, +infinity] for its outer counter — ' +
          'but the thing to take from the numbers is the shape rather than the constant. ' +
          'Without widening the analysis cost is a property of the program being analysed; ' +
          'with it, it is a property of the analyser. Only the second one can be promised to a ' +
          'user.'
      },
      {
        title: 'An iteration that runs out of rounds does not give a weaker answer',
        goal: 'Show that stopping short of the fixpoint produces a claim the program refutes.',
        setup: 'The same loop with a bound of 1000, analysed with the join alone under a ' +
          '200-round budget, then with widening. The run visits 1 003 blocks and ' +
          'produces 4 011 observed values.',
        steps: [
          { do: 'Run the join-only analysis and check whether it converged.',
            why: 'The last round is the only thing that distinguishes a fixpoint from a stop.',
            work: 'still changing at round 200; converged = no' },
          { do: 'Read what it claims at the loop header.',
            why: 'The claim looks entirely reasonable.',
            work: 'x in [0, 398], having climbed by 2 per round for 200 rounds' },
          { do: 'Check that claim against the run.',
            why: 'This is the direction a dynamic oracle can settle.',
            work: '1 207 of 4 011 observed values fall outside the claims — the analysis is unsound' },
          { do: 'Read what it claims about the block after the loop.',
            why: 'The second failure is worse than the first.',
            work: 'bottom — 0 values admitted, so the code after the loop is claimed dead' },
          { do: 'Run the same analysis with widening.',
            why: 'The comparison is the whole point.',
            work: '3 rounds, x in [0, 1001] at the header, 0 of 4 011 values outside, 8 of 15 claims exact' }
        ],
        answer: 'The budgeted analysis is not a coarser version of the right answer; it is ' +
          'below the fixpoint, and everything below a fixpoint is a claim about a program that ' +
          'the program can break. Two of its outputs are actively dangerous: an interval that ' +
          'excludes values the loop really produces, and a claim that live code is dead — ' +
          'which in an optimiser is a miscompilation and in a checker is a whole function that ' +
          'silently gets no analysis. This is why "did the iteration converge" belongs in the ' +
          'report, and why a tool that tells you it hit an analysis limit is telling you its ' +
          'findings for that function are not weaker evidence but no evidence.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
