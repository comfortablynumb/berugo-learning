/** Worked examples for the IR, control-flow graphs and dominators (M29.1-M29.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'designing-an-ir': [
      {
        title: 'One loop, four blocks, and where the tree went',
        goal: 'Watch a single `for` node become a graph, and count what it cost.',
        setup: 'The loop sample is three statements of surface Berugo: a let, a for over a ' +
          'literal array, and an accumulation inside it. The lowering runs the M28 front end ' +
          'to a core tree and then walks that tree into blocks.',
        steps: [
          { do: 'Count the blocks and the instructions the lowering produces.',
            why: 'The size of the graph a tree of that shape turns into.',
            work: '4 blocks and 32 instructions, terminators included' },
          { do: 'Read the origin column for the first three instructions.',
            why: 'Every instruction names the core node and the source text it came from.',
            work: 'const 0, store @0, const 1 — from num, letDecl and num' },
          { do: 'Find the instruction that made the graph cyclic.',
            why: 'A tree has no such edge, which is the entire argument for lowering.',
            work: 'the jump at the end of the loop body back to b1' },
          { do: 'Count the virtual registers and the slots.',
            why: 'Named locals are memory here; only 29.4 promotes them.',
            work: '22 registers and 4 slots — $i0, t, v and the array' },
          { do: 'Ask the verifier.',
            why: 'A lowering that is subtly wrong produces plausible IR.',
            work: 'all 10 invariants hold' }
        ],
        answer: 'Three statements of source become a 4-block graph of 32 instructions. Almost ' +
          'all of that growth is the `for`: the desugaring already turned it into a while over ' +
          'an index, and the lowering turned the while into a header, a body and a join. The ' +
          'origin column is what makes the growth readable rather than alarming — every one of ' +
          'the 32 rows names the core node and the source line it came from, so a wrong ' +
          'instruction can be traced to the construct that emitted it instead of being ' +
          'reasoned about from the IR alone.'
      },
      {
        title: 'Ten invariants, and what each one is standing in front of',
        goal: 'Show that a verifier is a list of specific disasters, not a general check.',
        setup: 'The invariant table names each of the ten conditions the verifier enforces and ' +
          'whether it holds on the current sample.',
        steps: [
          { do: 'Count the invariants and how many hold on the loop sample.',
            why: 'The baseline: correct IR satisfies all of them.',
            work: '10 of 10' },
          { do: 'Separate the ones that need a dominator tree from the ones that do not.',
            why: 'Two of the ten cannot be checked by a walk over the instruction list.',
            work: 'single-def and dominance — the two SSA invariants, checked from 29.3 onwards' },
          { do: 'Find the invariant that catches a lowering that forgot to terminate a block.',
            why: 'The commonest lowering bug, and the one with the least obvious symptom.',
            work: 'invariant 1 of 10 — terminator: every block ends in exactly one' },
          { do: 'Find the invariant that catches a pass deleting a block someone still jumps to.',
            why: 'A deletion is a two-place edit and the second place is easy to miss.',
            work: 'invariant 2 of 10 — target: every jump target names a block in this function' },
          { do: 'Ask what the whole list is blind to.',
            why: 'The limit is the point of the table.',
            work: '0 of the 10 — a pass producing valid IR that computes the wrong thing' }
        ],
        answer: 'The ten invariants are worth stating as ten rather than as "the IR is ' +
          'well-formed", because a named invariant reports which one broke and where. Eight ' +
          'are structural and checkable by a walk; two are the SSA conditions and need the ' +
          'dominator tree 29.3 builds. What none of them can see is a pass that produces a ' +
          'valid function computing a different answer — 17 of 17 conformance programs ' +
          'verify and 17 of 17 also compute exactly what the core language computed, and only ' +
          'the second column would notice the difference. That is why 29.10 makes the ' +
          'differential run a gate and not merely a test.'
      }
    ],

    'control-flow-graphs': [
      {
        title: 'Six fixtures measured, and two columns that come out zero',
        goal: 'Find out what shapes Berugo can actually produce, rather than assuming.',
        setup: 'Six programs — four lowered from surface Berugo, one straight-line, one built ' +
          'by hand — each measured for blocks, edges, critical edges, unreachable blocks and ' +
          'loops.',
        steps: [
          { do: 'Read the critical-edge column down the four lowered fixtures.',
            why: 'A critical edge is what forces edge splitting before SSA destruction.',
            work: '0 for every one of them' },
          { do: 'Read it for the hand-built graph.',
            why: 'The column is not zero because the measurement is broken.',
            work: '6 critical edges out of 7' },
          { do: 'Check the reducibility column the same way.',
            why: 'Irreducible graphs are the ones the loop algorithms cannot handle.',
            work: '1 of 6 fixtures is irreducible, and it is the hand-built one' },
          { do: 'Ask why the lowered ones cannot produce either.',
            why: 'The reason is structural, not luck.',
            work: '5 of 6 fixtures have neither — every branch target is a fresh block, ' +
              'and structured control flow cannot make a loop with two entries' },
          { do: 'Count blocks and edges on the nested fixture.',
            why: 'The one with two loops, to compare against its loop table.',
            work: '7 blocks, 8 edges, 2 natural loops, deepest nesting 2' }
        ],
        answer: 'Two of the five columns are zero on everything the language can write, and ' +
          'reporting that is more useful than a passing test. The edge splitter and the ' +
          'irreducibility check earn nothing on Berugo — they exist because a language with ' +
          '`goto`, a template expander or a block-merging pass produces both, and a compiler ' +
          'that meets one for the first time in production has a very bad afternoon. The ' +
          'hand-built fixture is what stops those two code paths being untested branches: ' +
          'splitting turns its 5 blocks and 6 critical edges into 11 blocks and none.'
      },
      {
        title: 'A loop finder checked against the definition it implements',
        goal: 'Show why a second implementation catches what a test suite does not.',
        setup: 'The algorithm finds natural loops from back edges; the oracle enumerates the ' +
          'definition directly — every block that can reach a latch without passing through ' +
          'the header.',
        steps: [
          { do: 'Count the back edges and the loops on the nested fixture.',
            why: 'One natural loop per back edge, before any merging.',
            work: '2 back edges and 2 loops' },
          { do: 'Read the outer loop\'s block set from both.',
            why: 'The two columns exist to be compared row by row.',
            work: 'b1, b2, b4, b5, b6 from each, and they agree' },
          { do: 'Read the inner one.',
            why: 'The nested case is where a naive finder over-collects.',
            work: 'b4, b5 from each, agreeing, at depth 1 inside b1' },
          { do: 'Say what a subtly wrong finder would have produced.',
            why: 'This is the failure the oracle exists to catch.',
            work: 'a 6-block set where the answer is 5 — plausible, and nothing but a ' +
              'second implementation notices' },
          { do: 'Check the two-latches fixture.',
            why: 'Two back edges to the same header must merge into one loop.',
            work: '1 loop from 2 back edges' }
        ],
        answer: 'Both loops agree with the enumeration, which is the only kind of evidence ' +
          'worth having here. A loop finder that over-collects by one block still returns a set ' +
          'that looks right, and every pass built on it — invariance, depth, exits — is then ' +
          'wrong in a way that shows up as a rare miscompilation rather than as a failing test. ' +
          'The oracle is exponential and useless at scale, which is exactly why it is the ' +
          'right thing to check the fast algorithm against on graphs of seven blocks.'
      }
    ],

    'dominators': [
      {
        title: 'Two rounds over seven blocks, and why the second one matters',
        goal: 'Watch a fixpoint reach its answer and then prove it has.',
        setup: 'The Cooper-Harvey-Kennedy iteration walks the blocks in reverse postorder, ' +
          'intersecting the dominator sets of each block\'s predecessors until nothing changes.',
        steps: [
          { do: 'Count the rounds and what changed in each.',
            why: 'The shape of a fixpoint is one productive round and one confirming one.',
            work: 'round 1 changed 6 blocks, round 2 changed 0' },
          { do: 'Say what the second round is for.',
            why: 'It computes nothing, and stopping without it is a bug.',
            work: '0 changes in round 2, which is what proves the fixpoint was reached' },
          { do: 'Ask why the first round nearly finishes the job.',
            why: 'The visit order is doing the work.',
            work: '6 of the 7 blocks settle in round 1 — reverse postorder means every ' +
              'predecessor except a back edge already has an answer when a block is visited' },
          { do: 'Read the immediate dominator of the join block b6.',
            why: 'The join is the interesting node: neither arm dominates it.',
            work: 'b2 — the branch above the arms, not either arm' },
          { do: 'Read b6\'s dominance frontier.',
            why: 'This is where 29.4 will place a phi, computed before any phi exists.',
            work: 'b1 — the loop header' }
        ],
        answer: 'Two rounds for a seven-block graph, and the second one is pure confirmation. ' +
          'That is what a good visit order buys: an arbitrary order reaches the same fixpoint ' +
          'and takes more rounds, so reverse postorder is a performance decision rather than a ' +
          'correctness one. The frontier column is the payoff — reading down it lists every ' +
          'place a value stops being the only possibility, which is the phi placement rule ' +
          'answered from the graph alone.'
      },
      {
        title: 'The exponential definition, run on purpose',
        goal: 'Check a fast dominance algorithm against the thing it is a fast version of.',
        setup: 'The oracle removes one block at a time and asks which blocks become unreachable ' +
          'from the entry; that is the definition of dominance, and it is quadratic in ' +
          'reachability searches.',
        steps: [
          { do: 'Count the blocks and the agreements.',
            why: 'Every row is one block\'s full dominator set from both sides.',
            work: '7 of 7 agree' },
          { do: 'Read b4\'s set from each.',
            why: 'A block inside the inner loop, three levels from the entry.',
            work: 'b0, b1, b2, b4 from both' },
          { do: 'State the oracle\'s definition in one sentence.',
            why: 'It is the definition, which is why it can be an oracle at all.',
            work: 'A dominates B when removing A makes B unreachable from the entry — ' +
              '7 removals, 1 per block' },
          { do: 'Say what a wrong dominator tree would produce.',
            why: 'The reason the check is worth its cost.',
            work: '1 wrong entry is enough: an optimiser that hoists code past a branch ' +
              'and looks correct on every test where the branch goes one way' },
          { do: 'Count the questions the finished tree answers.',
            why: 'The tree is built once and consulted by passes that seem unrelated.',
            work: '6 questions from six different passes' }
        ],
        answer: 'Seven blocks, seven agreements, and the point is the asymmetry between the two ' +
          'implementations rather than the number. The oracle is unusable on a real function ' +
          'and cannot be subtly wrong; the iteration is linear in practice and can. Checking ' +
          'the second against the first on small graphs is how a compiler gets to trust a ' +
          'structure that six different passes then consult without re-deriving.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
