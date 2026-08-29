/** Concepts for SSA, dataflow and the scalar passes (M29.4-M29.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'ssa-form': [
      {
        term: 'Every register is defined exactly once',
        plain: 'So the definition of a value is a pointer rather than a search.',
        formal: 'anywhere in the function, one definition per register',
        detail: 'Ask what defines this value in a non-SSA IR and the answer is a reaching- ' +
          'definitions analysis: a fixpoint over the whole function, recomputed after every ' +
          'change. In SSA it is one pointer, valid by construction, and it stays valid because ' +
          'a pass that breaks it breaks a checkable invariant. That converts a whole class of ' +
          'analyses into lookups, which is why the form won.',
        example: 'A four-block loop in SSA has 22 definitions and every use is dominated by ' +
          'its own.'
      },
      {
        term: 'A phi function names the edge',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["x = 1 on the then branch"] --> C["the paths join"]',
            '    B["x = 2 on the else branch"] --> C',
            '    C --> D["x₃ = φ(x₁ from then,<br/>x₂ from else)"]',
            '    D --> E["the value now depends on<br/>which edge arrived"]',
            '    E --> F["and single-assignment survives"]'
          ].join('\n'),
          caption: 'Without the phi, a join would need two definitions of one name and the whole guarantee collapses. It is not an instruction so much as a record of which way control came.'
        },
        plain: 'Two paths define a variable, so a third definition says which arrived.',
        formal: 'not an instruction any machine has; destruction turns it back into copies',
        detail: 'It is easy to read a phi as a trick and it is the opposite: given that every ' +
          'register has one definition, there is no other way to write down a value that ' +
          'depends on the path. The alternative is to abandon the property at every join, ' +
          'which is the non-SSA IR the form exists to improve on. Its unexecutability is the ' +
          'price, and destruction is where the price is paid.',
        example: 'A loop header carries two phis, one for the accumulator and one for the ' +
          'index, each with an entry from the entry block and one from the latch.'
      },
      {
        term: 'Placement is the iterated dominance frontier',
        plain: 'A phi goes where a variable stops being the only possibility.',
        formal: 'iterated, because inserting a phi is itself a definition',
        detail: 'Taking the frontier once misses the phis that the newly inserted ones force ' +
          'further down, so the computation is a fixpoint. Cytron\'s algorithm is exactly ' +
          'this, and its dependence on the dominance frontier is why the dominator tree has to ' +
          'exist first — SSA construction is a consumer of that analysis rather than an ' +
          'independent traversal.',
        example: 'Three phis placed for a for loop, at the header, from the two blocks that ' +
          'write each slot.'
      },
      {
        term: 'Renaming walks the dominator tree, not the CFG',
        plain: 'A stack per variable, pushed on a definition and popped on the way out.',
        formal: 'the top of the stack is the definition that reaches here',
        detail: 'That property holds because the walk follows dominance: everything visited ' +
          'inside a subtree is dominated by its root, so a definition pushed at the root ' +
          'reaches all of it. Walking the CFG instead gives no such guarantee — a block can be ' +
          'reached from several places — and the stack would hold whichever definition the ' +
          'traversal happened to see last.',
        example: 'Four slots promoted, every load rewritten to a copy of whichever definition ' +
          'dominates it.'
      },
      {
        term: 'Pruned SSA drops the phis nothing reads',
        plain: 'A minimal construction places more than are needed.',
        formal: 'a fixpoint, because removing one phi can make another unread',
        detail: 'The frontier says where a phi COULD be needed, not where one is; on a loop ' +
          'most of the placed phis turn out to have no reader. Removing them is cheap and the ' +
          'difference between the two counts is the whole of "minimal versus pruned" — which ' +
          'is a distinction usually described and rarely measured, though the measurement is ' +
          'two numbers.',
        example: 'Three phis placed for a for loop, one pruned, two kept.'
      },
      {
        term: 'Memory sits outside the property',
        plain: 'A register has one definition; a heap location does not.',
        formal: 'so loads and stores keep their own machinery',
        detail: 'This is the exception that shapes everything after it. SSA says nothing about ' +
          'memory, so the moment a value lives in the heap the def-use chain is broken and the ' +
          'question becomes an aliasing one. Promoting locals to registers is exactly the work ' +
          'of moving as much as possible out of that gap, and what cannot be moved is why the ' +
          'last analysis in this milestone exists.',
        example: 'Every local in Berugo is promotable, because the language has no way to take ' +
          'the address of one.'
      },
      {
        term: 'Destruction needs the critical edges split first',
        plain: 'A phi operand becomes a copy in the predecessor that supplied it.',
        formal: 'and if that predecessor has another successor, the copy runs on the wrong path',
        detail: 'That is why 29.2 splits critical edges as a prophylactic rather than when a ' +
          'pass discovers it needs one: the pass that needs it is the one furthest from the ' +
          'graph work, and a failure here appears only where two paths merge with different ' +
          'values. Splitting everything up front costs a few blocks and removes the class.',
        example: 'Four conformance programs need a phi, and destruction inserts two copies per ' +
          'phi with the edges already split.'
      },
      {
        term: 'The swap problem, and why no Berugo program has it',
        plain: 'Two phis whose operands are each other become two copies that both go wrong.',
        formal: 'a temporary breaks the cycle, and the count of temporaries is reported',
        detail: 'Writing a swap in Berugo needs a third variable, and that variable breaks the ' +
          'cycle before SSA sees it — so the sequencer never fires on any program the language ' +
          'can express. It still has to be right, because a later pass that rotates copies can ' +
          'produce the shape, so the case is exercised against a pair built by hand rather ' +
          'than left as an untested branch.',
        example: 'A hand-built trio of phis, two of them exchanging values, needs one ' +
          'temporary and seven copies; every conformance program needs none.'
      }
    ],

    'dataflow-analysis': [
      {
        term: 'One algorithm, many lattices',
        plain: 'Four analyses that look different are one worklist loop with four settings.',
        formal: 'a direction, a meet, an initial value and a transfer function',
        detail: 'Recognising this turns "write a new analysis" into "define a domain", which is ' +
          'a day rather than a month, and it is the single most useful thing to know about the ' +
          'subject. The practical consequence is larger than it sounds: a hand-written ' +
          'traversal over a cyclic graph terminates by accident or reports a fact that only ' +
          'holds on the first iteration, and defining a domain instead inherits the solver\'s ' +
          'termination argument.',
        example: 'Liveness, reaching definitions, available expressions and very busy ' +
          'expressions all run through one solver.'
      },
      {
        term: 'Union means on some path; intersection means on every path',
        plain: 'That is the entire content of the choice of meet.',
        formal: 'live if ANY successor reads it; available only if EVERY path computed it',
        detail: 'A register is live if one successor needs it, because the program only has to ' +
          'take one of those paths; an expression is available only if every path already ' +
          'computed it, because the program might take any of them. Getting the direction of ' +
          'the quantifier wrong produces an analysis that runs, converges, and reports facts ' +
          'that are true of the wrong program.',
        example: 'Liveness is backward-union and available expressions is forward-intersect, ' +
          'and all four combinations of the two choices are used by something.'
      },
      {
        term: 'An intersection analysis must start at the top of the lattice',
        plain: 'Initialise to the full set, not to empty.',
        formal: 'starting at empty makes the first meet empty and the fixpoint nothing',
        detail: 'This is the classic implementation mistake and it is silent: the analysis ' +
          'converges immediately, reports a perfectly well-formed fixpoint, and every fact in ' +
          'it is the empty set. Nothing crashes and no pass complains, because "nothing is ' +
          'available" is a sound if useless answer. Only comparing the result against an ' +
          'expectation catches it.',
        example: 'Available expressions starts every block at the full set and lets the ' +
          'iteration remove members.'
      },
      {
        term: 'The backward boundary needs the same care',
        plain: 'A block with no successors has nothing to meet over.',
        formal: 'its OUT is the boundary value, not whatever it was initialised to',
        detail: 'For an intersection analysis the initial value is the full set, so without an ' +
          'explicit boundary the exit block reports every expression as certain to be computed ' +
          'after a point from which no path exists. The forward case gets this right by ' +
          'accident because the entry is usually initialised deliberately; the backward case ' +
          'is where it is forgotten.',
        example: 'Very busy expressions reports an empty set at the exit once the boundary is ' +
          'set, and the full set before.'
      },
      {
        term: 'Termination is monotonicity plus finite height',
        plain: 'A fact can only move one way, and there are finitely many moves.',
        formal: 'an argument, not a hope',
        detail: 'That is what makes the loop safe to run without a bound, and it is why an ' +
          'analysis that does not converge in a few passes over a reducible graph has a ' +
          'non-monotone transfer function rather than a hard problem. A lattice of infinite ' +
          'height — integer ranges, for example — needs a widening operator to force ' +
          'termination, and that widening is where such analyses lose their precision.',
        example: 'A constant-propagation lattice has three levels, so a register\'s fact can ' +
          'change at most twice.'
      },
      {
        term: 'The worklist is an optimisation, not a different algorithm',
        plain: 'Re-examine a block only when a neighbour moved.',
        formal: 'the same fixpoint as sweeping, reached with fewer visits',
        detail: 'The order in which monotone functions are applied cannot change where they ' +
          'converge, so this is purely about cost — which matters on a large function with one ' +
          'hot loop, where sweeping pays for the whole function every round to learn about a ' +
          'few blocks. Reporting the visit count is what makes the saving visible rather than ' +
          'assumed.',
        example: 'Liveness on a four-block loop costs six visits, and very busy expressions ' +
          'costs eight.'
      },
      {
        term: 'A phi operand is used on the edge',
        plain: 'Not in the block holding the phi.',
        formal: 'charging it to the phi\'s own block makes a value look live on paths it never took',
        detail: 'It is a three-line special case and skipping it is invisible until a register ' +
          'allocator built on the liveness result reports interference that is not real and ' +
          'runs out of registers on a function that did not need them. The rule follows from ' +
          'what a phi means: the operand is read as control travels the edge, before the block ' +
          'is entered at all.',
        example: 'Liveness agrees exactly with a path enumeration on every fixture, including ' +
          'the ones with phis.'
      },
      {
        term: 'A brute-force liveness oracle',
        plain: 'A register is live out when some path reads it before writing it.',
        formal: 'exponential in the paths, and run only on small graphs',
        detail: 'The definition enumerated. A liveness analysis that is subtly wrong reports a ' +
          'plausible set and the register allocator built on it produces code that works on ' +
          'every test where the wrong path was not taken — which is the shape of bug that ' +
          'survives a test suite and reaches production. Checking a linear algorithm against ' +
          'the definition on small inputs is the cheapest possible insurance.',
        example: 'Five fixtures, every block, exact agreement.'
      }
    ],

    'scalar-optimisations': [
      {
        term: 'Copy propagation makes SSA output readable',
        plain: 'Renaming turns every load of a promoted slot into a copy.',
        formal: 'a move makes two registers one value, so later reads can read the source',
        detail: 'A freshly constructed function is full of them, and construction deliberately ' +
          'leaves them rather than trying to avoid them: a simple construction plus a simple ' +
          'cleanup is easier to get right than one pass doing both, and the cleanup helps ' +
          'everything after it as well. The pass also has to rewrite anything outside the ' +
          'instruction stream that names a register, or a redundant copy is kept alive forever.',
        example: 'Six copies resolved on a four-block loop, and the program stops shrinking if ' +
          'the exit map is not rewritten too.'
      },
      {
        term: 'Dead code is mark and sweep over uses',
        plain: 'Start from what must run and keep what it transitively reads.',
        formal: 'terminators, stores, calls — and the function\'s results',
        detail: 'The last clause is not a special case, it is the boundary. A program\'s ' +
          'observable bindings are values that outlive the function, and nothing inside reads ' +
          'them, so without it the pass correctly proves the whole program dead and deletes ' +
          'it. Every real compiler has the same rule under a different name: the return value ' +
          'and anything that escapes are live by definition.',
        example: 'Twelve instructions removed from a four-function program, and every result ' +
          'register kept as a root.'
      },
      {
        term: 'Value numbering needs dominance',
        plain: 'The earlier computation must dominate the later one.',
        formal: 'two identical expressions on sibling branches are not redundant',
        detail: 'Replacing the second with the first would read a register that may not have ' +
          'been defined on this path, which is a use not dominated by its definition — exactly ' +
          'the invariant the SSA check states. Walking the dominator tree with a scoped table ' +
          'makes the restriction automatic rather than remembered, which is the difference ' +
          'between a pass that is right and one that is right on the cases somebody tested.',
        example: 'Commutative operations are keyed with their operands sorted, so add of one ' +
          'and two is the same value as add of two and one.'
      },
      {
        term: 'SCCP is more than its two halves',
        plain: 'Constants and reachability, run to a joint fixpoint.',
        formal: 'a phi meets only the operands arriving on live edges',
        detail: 'Each half is blocked by what the other knows: propagation cannot fold a value ' +
          'guarded by a condition it has not proved false, and elimination cannot prove the ' +
          'branch dead without knowing the condition is constant. Running them together ' +
          'unblocks both, and the last clause above is the mechanism — an operand on a dead ' +
          'edge does not force the phi to bottom.',
        example: 'On a program with a division guarded by a false condition, folding alone ' +
          'reaches twelve instructions and SCCP reaches seven.'
      },
      {
        term: 'A fold that could fault must not be folded',
        plain: 'Dividing by zero at compile time is either a crash or a silent infinity.',
        formal: 'the program is entitled to fault at run time',
        detail: 'And the optimiser is not entitled to decide it does not. This is the same ' +
          'principle as the loop-hoisting condition seen from the other side: an optimisation ' +
          'may not make a fault happen earlier, and it may not make one disappear. Every ' +
          'folder here refuses the faulting cases explicitly rather than relying on the host ' +
          'language\'s arithmetic to do something reasonable.',
        example: 'The folder leaves a division by zero in the IR so the runtime reports it.'
      },
      {
        term: 'A peephole rule is only sound because the IR is typed',
        plain: 'Multiplying by zero gives zero for a number and not for a string.',
        formal: 'five rules, each an algebraic identity over a known type',
        detail: 'Without the type the rule has to be dropped, which is a concrete return on ' +
          'having kept the checker\'s types in the IR rather than a general argument for ' +
          'typing. Counting how often each rule fires is the other half: a peephole rule that ' +
          'never fires is dead weight in the pipeline, and the count is how a compiler decides ' +
          'which to keep.',
        example: 'Four of five rules fire on a fixture with non-constant operands, and none ' +
          'fire across the conformance suite.'
      },
      {
        term: 'Constants hide the peephole rules',
        plain: 'SCCP folds an identity before the peephole pass can see it.',
        formal: 'the rules need a non-constant operand to fire at all',
        detail: 'A fixture written with literals reports every rule firing zero times, which ' +
          'reads as a broken pass and is a fixture that does not exercise it. The operand has ' +
          'to be something the optimiser cannot know — a parameter is the cheapest one — and ' +
          'noticing this is a general lesson about testing an optimiser: the passes interact, ' +
          'so an input that reaches one may never reach the next.',
        example: 'Adding zero to a constant folds to the constant; adding zero to a parameter ' +
          'is where the rule applies.'
      },
      {
        term: 'Phase ordering is genuinely unsolved',
        plain: 'A then B and B then A produce different code.',
        formal: 'no fixed order is optimal for every program',
        detail: 'Passes enable each other in both directions — propagation exposes redundant ' +
          'expressions, value numbering exposes constants — so the space of orderings is ' +
          'factorial and the best point in it depends on the program. Real compilers fix an ' +
          'order by measurement over a benchmark suite and run the cheap passes several times, ' +
          'which is why a pipeline listing looks repetitive, and why a performance regression ' +
          'is a real bug report rather than a misunderstanding.',
        example: 'Four of five fixtures give different instruction counts depending on which ' +
          'of two passes runs first.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
