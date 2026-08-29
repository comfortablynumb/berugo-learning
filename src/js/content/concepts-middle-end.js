/** Concepts for the IR, control-flow graphs and dominators (M29.1-M29.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'designing-an-ir': [
      {
        term: 'An AST is a tree and control flow is a graph',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an AST: nesting"] --> B["a node has one parent,<br/>and there are no paths"]',
            '    C["a CFG: blocks and edges"] --> D["a block has many predecessors,<br/>and there ARE paths"]',
            '    D --> E["which is what makes questions like<br/>does this value reach here<br/>askable at all"]',
            '    B --> F["so optimisation does not<br/>happen on the AST"]',
            '    E --> F'
          ].join('\n'),
          caption: 'Almost every optimisation is a question about paths, and a tree does not have any. That is the whole reason a compiler builds a second representation.'
        },
        plain: 'Optimisation does not happen on the AST because a tree has no paths.',
        formal: 'is this value available here is a question about paths',
        detail: 'Every analysis in a middle end asks something about the routes control can ' +
          'take, and a tree deliberately hides those. Answering on the tree means ' +
          'reconstructing the graph inside each analysis, from a structure designed not to ' +
          'have one. Lowering to blocks and jumps once, and asking the question against the ' +
          'graph, is the entire argument for having an intermediate representation at all.',
        example: 'A four-block IR from a loop that was one node; the back edge that makes it ' +
          'cyclic has no counterpart in the tree.'
      },
      {
        term: 'Three-address code',
        plain: 'One operation per instruction, into a named register.',
        formal: 'the nesting disappears and every intermediate value gets a name',
        detail: 'A tree expresses a computation by nesting, so an intermediate value is a ' +
          'position rather than a thing. Flattening gives each one a name, and a name is what ' +
          'lets a pass say "the definition of this value" instead of "the left child of the ' +
          'parent of this node". Nearly every optimisation is stated in those terms, so the ' +
          'flattening is not a convenience but a precondition.',
        example: 't + v * 2 becomes three instructions and gives the multiplication a name the ' +
          'optimiser can talk about.'
      },
      {
        term: 'Registers rather than a stack',
        plain: 'A stack IR is smaller and gives no value a name.',
        formal: 'on a stack the definition of a value is a position, not an identity',
        detail: 'A position changes whenever anything before it changes, so every optimisation ' +
          'would have to be phrased as a transformation of the stack rather than of values. ' +
          'Registers cost size and buy names, which is why a middle end uses them and a ' +
          'bytecode VM does not — M30 will emit a stack machine from exactly this register IR, ' +
          'and the conversion is the last thing that happens rather than the first.',
        example: 'This IR has 22 virtual registers for a four-block loop, and every one of them ' +
          'can be the subject of a sentence.'
      },
      {
        term: 'A named local is a slot until SSA promotes it',
        plain: 'Reading a variable is a load; writing it is a store.',
        formal: 'a value that depends on which path ran cannot be named by a compile-time map',
        detail: 'It looks wasteful and is the only correct choice. A variable assigned inside a ' +
          'loop has a value determined by which path arrived, and a map from name to register ' +
          'built while walking the tree can only name the register from the last assignment it ' +
          'happened to see — which on a loop that never runs was never defined. Loads and ' +
          'stores can express it; the promotion back to registers is what a phi function is.',
        example: 'let t = 0; while … { t = t + 1; } read a register the loop never defined, ' +
          'until every local became a slot.'
      },
      {
        term: 'The verifier is the highest-value piece of a middle end',
        plain: 'It turns "the optimiser produced garbage" into "pass X broke invariant Y".',
        formal: 'ten named invariants, checked after every pass',
        detail: 'Without one, a broken pass shows up as wrong output from a program compiled ' +
          'through eleven passes, and the only way to find it is to bisect by hand — which ' +
          'depends on a human recognising invalid IR, and people are bad at that. A block with ' +
          'two terminators looks fine at a glance. The cost is one walk per pass and it is ' +
          'repaid in the first hour of the first bug.',
        example: 'Removing a terminator, pointing a jump at nothing, or reading an undefined ' +
          'register each produce a named violation rather than a refusal.'
      },
      {
        term: 'An invariant in a comment is not an invariant',
        plain: 'A verifier can only check what somebody wrote down as code.',
        formal: 'all ten are executable, and each can be violated on purpose',
        detail: 'The temptation is to document a rule and assume it holds, because the code ' +
          'that maintains it is right there. Rules decay: a pass added later does not know ' +
          'about the comment. Making each one a function that returns a named failure means ' +
          'the rule is enforced at every pass boundary rather than at the moment somebody ' +
          'remembers it — and being able to watch each one fire is what makes anybody believe ' +
          'the set is complete.',
        example: 'The demo injects five defects and each names its own invariant.'
      },
      {
        term: 'Every instruction keeps the span it came from',
        plain: 'The IR remembers which source construct produced each instruction.',
        formal: 'the origin kind and the original span, carried through lowering',
        detail: 'M28 spent a milestone making spans survive desugaring, and dropping them at ' +
          'the IR boundary would waste it. A diagnostic from the middle end — this loop cannot ' +
          'be vectorised, this value may be null — is useless without a place to point, and ' +
          'the place has to be source the developer wrote rather than a generated index ' +
          'variable. It is one field per instruction and it cannot be retrofitted.',
        example: 'Every instruction of a lowered for loop points at the loop, not at the ' +
          'block that replaced it.'
      },
      {
        term: 'Every stage is a pure function of its input',
        plain: 'A stage reads its input, produces its output, and keeps nothing.',
        formal: 'the whole pipeline run twice on one program, and the artefacts compared',
        detail: 'Purity is what makes a pipeline inspectable — any prefix can be run and every ' +
          'intermediate kept — and it is easy to lose by accident, most classically to a ' +
          'module-level counter for fresh names. The loss is invisible until two compilations ' +
          'in one process disagree, which is a bug report nobody can reproduce. Comparing ' +
          'fingerprints of every artefact after a second run costs one pass and names the ' +
          'offending stage.',
        example: 'All seventeen conformance programs produce identical fingerprints for all ' +
          'five stages on a second run.'
      }
    ],

    'control-flow-graphs': [
      {
        term: 'A basic block has one entry and one exit',
        plain: 'Control enters at the top and leaves at the bottom.',
        formal: 'anything true at the start of a block is true for all of it',
        detail: 'That is what lets an analysis compute one fact per block rather than one per ' +
          'instruction, which is most of why the representation is worth building. The ' +
          'boundaries are forced rather than chosen: a block ends at a jump or a branch and ' +
          'begins at any instruction something can jump to, so the partition is a property of ' +
          'the program rather than a decision.',
        example: 'A loop with a branch in its body is seven blocks, and the largest holds ' +
          'fourteen instructions.'
      },
      {
        term: 'A back edge is one whose target dominates its source',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an edge pointing to<br/>an earlier block"] --> B{"does its target DOMINATE<br/>its source?"}',
            '    B -->|yes| C["a back edge —<br/>this is a real loop"]',
            '    B -->|no| D["just a jump backwards<br/>in the layout"]',
            '    D --> E["treating it as a loop finds<br/>loops that are not there"]'
          ].join('\n'),
          caption: 'Block order in the CFG is an artefact of how the code was laid out. Dominance is the structural test, and it is the one that survives reordering.'
        },
        plain: 'Not merely one that points at an earlier block.',
        formal: 'this is the difference between a loop and a jump into the middle of one',
        detail: 'An edge into a loop from outside points backwards and is not a back edge, and ' +
          'a graph containing one is irreducible: no natural loop describes the region, and ' +
          'every loop optimisation has nothing to work with. Defining the term through ' +
          'dominance rather than through position is what makes loop detection a consumer of ' +
          'the dominator tree, which is the usual shape in a middle end.',
        example: 'A hand-built graph with a cycle entered at both its blocks reports zero ' +
          'natural loops, because neither block dominates the other.'
      },
      {
        term: 'Two back edges to one header are one loop',
        plain: 'A continue produces a second path back, not a second loop.',
        formal: 'merge the natural loops that share a header',
        detail: 'Treating each back edge as its own loop reports two loops sharing every block, ' +
          'which makes the nesting forest not a forest and makes every depth wrong — so every ' +
          'cost estimate downstream is wrong too. The merge is three lines and the failure it ' +
          'prevents is silent: two plausible loops where there is one, and an optimiser that ' +
          'hoists into the wrong preheader.',
        example: 'A while loop whose body says continue gives 1 loop with 2 latches, and a ' +
          'naive finder gives 2 loops with identical bodies. Without the continue, both arms ' +
          'of the conditional join before the latch and there is only ever one back edge.'
      },
      {
        term: 'The natural loop of a back edge',
        plain: 'The target, plus everything that reaches the source without leaving through it.',
        formal: 'a backwards reachability walk from the latch, stopping at the header',
        detail: 'That is the definition, and computing it as a walk is fast while enumerating ' +
          'the paths it describes is not. The two must agree, which is why the demo runs both: ' +
          'a loop finder that is subtly wrong returns a plausible set of blocks, and nothing ' +
          'in the rest of the compiler will notice — every loop pass will simply optimise the ' +
          'wrong region.',
        example: 'Both loops of a nested pair agree exactly with a path enumeration on every ' +
          'block.'
      },
      {
        term: 'Nesting depth is what a cost model multiplies by',
        plain: 'An inner loop body runs once per iteration of every loop around it.',
        formal: 'the saving from moving code out is the product of the enclosing trip counts',
        detail: 'That is why loop optimisation is where the measurable wins are and why depth ' +
          'is worth computing rather than guessing. It is also why the multiplier has to be ' +
          'named as an assumption when a static trip count is unavailable, which it usually ' +
          'is: an unlabelled factor in a cost column is how a heuristic turns into folklore ' +
          'that nobody can defend or revise.',
        example: 'Two nested loops give depths 0 and 1, and the inner body is charged ten times ' +
          'the outer one under a stated assumption.'
      },
      {
        term: 'A critical edge has nowhere to put code',
        plain: 'From a block with several successors to one with several predecessors.',
        formal: 'no block runs on exactly that path',
        detail: 'Any pass needing to insert something on one specific edge has no place for it: ' +
          'the end of the source runs on both its paths, the start of the target runs whichever ' +
          'way you came. SSA destruction needs exactly this, and so does a register allocator ' +
          'inserting spills. Splitting the edge inserts a block; skipping the split produces ' +
          'bugs that appear only where two paths merge and the values differ.',
        example: 'A hand-built graph has six critical edges and none after splitting, which ' +
          'costs five extra blocks.'
      },
      {
        term: 'An unreachable block is a correctness problem',
        plain: 'Not merely wasted space.',
        formal: 'it has no predecessors, so a phi targeting it has an impossible edge',
        detail: 'Every dataflow analysis will compute facts for code that never runs and merge ' +
          'them into code that does, so the facts about live code become weaker for no reason. ' +
          'A phi with an entry for an edge that cannot be taken is worse: the value on that ' +
          'edge is never defined, so a later pass reading it reads a register with no ' +
          'definition. Removing them is a correctness step disguised as tidying.',
        example: 'The lowering already prunes them, so the count is zero on every fixture — ' +
          'which says the work is done earlier, not that it is unnecessary.'
      },
      {
        term: 'Structured control flow is reducible for free',
        plain: 'No Berugo program can produce an irreducible graph.',
        formal: 'if, while, break and continue cannot make a loop with two entries',
        detail: 'Irreducibility comes from arbitrary jumps and from some code generators, so a ' +
          'language without goto gets the property without asking. A compiler still has to ' +
          'handle the case — its front end is not the only thing that produces its IR — but ' +
          'knowing where the property comes from is what makes it possible to say honestly ' +
          'that a pass earns nothing on this input rather than that the problem does not exist.',
        example: 'Five fixtures written in Berugo are all reducible; the one that is not was ' +
          'built by hand.'
      }
    ],

    'dominators': [
      {
        term: 'A dominates B when every path from the entry to B goes through A',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["can I move this computation<br/>out of the loop?"] --> D["all of them reduce<br/>to dominance"]',
            '    B["is this value definitely<br/>initialised here?"] --> D',
            '    C["where does a phi function go?"] --> D',
            '    D --> E["every path from entry to B<br/>passes through A"]',
            '    E --> F["so whatever A did<br/>has certainly happened"]'
          ].join('\n'),
          caption: 'Most legality questions in an optimiser are really asking whether something is guaranteed to have run. Dominance is that guarantee, computed once and reused everywhere.'
        },
        plain: 'The one relation most legality questions reduce to.',
        formal: 'computed once after every change to the graph, and consulted everywhere',
        detail: 'Is this definition available here, can this be hoisted there, is this edge a ' +
          'back edge, where does a phi go, will this definitely run — six questions from six ' +
          'passes, all answered by a walk up one tree. That is unusual: most analyses answer ' +
          'one question. It is why the tree is cached rather than rederived, and why dominance ' +
          'appears in parts of a compiler that look unrelated to control flow.',
        example: 'In a loop with a branch in its body, the header dominates six of seven ' +
          'blocks and neither arm dominates the join.'
      },
      {
        term: 'The immediate dominator is the nearest one, and they form a tree',
        plain: 'Each block has exactly one.',
        formal: 'so dominance is a tree walk rather than a set membership test',
        detail: 'The tree structure is what makes SSA renaming a depth-first walk with a stack ' +
          'rather than another fixpoint, and what makes "does A dominate B" a walk up parents ' +
          'rather than a comparison of sets. Both are consequences of uniqueness, and both ' +
          'would be lost if the relation were represented as the sets it implies — which is ' +
          'the obvious first implementation and much slower.',
        example: 'Seven blocks give seven immediate dominators, and the entry has none.'
      },
      {
        term: 'The iterative algorithm converges in two rounds',
        plain: 'Intersect the predecessors, walking both fingers up the tree until they meet.',
        formal: 'Cooper, Harvey and Kennedy, in about twenty lines',
        detail: 'Lengauer–Tarjan is asymptotically better and is what a production compiler ' +
          'uses at scale, but the iterative version is faster on the graphs real functions ' +
          'actually have and its fixpoint can be watched round by round. Choosing the ' +
          'watchable one is a teaching decision; choosing it in a compiler is a measurement, ' +
          'and the measurement has gone that way often enough to be worth knowing.',
        example: 'Round one settles all six non-entry blocks and round two changes nothing, ' +
          'which is what proves the fixpoint.'
      },
      {
        term: 'Reverse postorder is why it converges quickly',
        plain: 'Visit a block only after its predecessors, except across back edges.',
        formal: 'a reducible graph settles in the first pass and the second confirms it',
        detail: 'The order does not change where the iteration converges — monotone functions ' +
          'reach the same fixpoint whatever order they are applied in — so this is a ' +
          'performance decision rather than a correctness one. Knowing which kind of decision ' +
          'it is matters: a graph needing many rounds is a sign the order was not respected, ' +
          'not a sign the algorithm is wrong.',
        example: 'Two rounds over seven blocks, and the second makes zero changes.'
      },
      {
        term: 'The dominance frontier is where a value stops being the only possibility',
        plain: 'The first joins downstream of a block.',
        formal: 'blocks A does not strictly dominate but whose predecessor it does',
        detail: 'The definition is awkward and the meaning is not. Past the frontier, control ' +
          'could have arrived without passing through A, so a value defined in A is no longer ' +
          'the only candidate — which is exactly the condition a phi function records. That ' +
          'makes SSA construction a consumer of this computation rather than an independent ' +
          'algorithm, and it is why the frontier is computed before any phi is placed.',
        example: 'Both arms of a branch have the join in their frontier, and the block that ' +
          'dominates everything downstream has an empty one.'
      },
      {
        term: 'Post-dominance answers will this definitely run',
        plain: 'Dominance on the reversed graph.',
        formal: 'B post-dominates A when every path from A to an exit goes through B',
        detail: 'That is the safety condition for speculating a computation — moving it ' +
          'earlier is only free if it was going to happen anyway — and it is why loop-invariant ' +
          'code motion asks about loop EXITS rather than about the header. The two relations ' +
          'are the same algorithm on two graphs, which is worth noticing: implementing ' +
          'post-dominance as a separate analysis is a duplicated bug surface.',
        example: 'In a loop with a branch, the header post-dominates the blocks inside the ' +
          'branch and the exit post-dominates everything.'
      },
      {
        term: 'Several exits need a virtual one',
        plain: 'The reversed graph has no single entry when a function returns from three places.',
        formal: 'an exit node with an edge from each real exit',
        detail: 'It is not a hack. "Every path to an exit" is a statement about all of them at ' +
          'once, and the virtual node is what turns that into one question rather than three ' +
          'that have to be intersected afterwards. Skipping it and running post-dominance from ' +
          'one arbitrary exit gives an answer that is correct about that path and wrong about ' +
          'the program.',
        example: 'A function with an early return has two exits, and post-dominance is computed ' +
          'from a node with an edge from both.'
      },
      {
        term: 'A brute-force oracle by path enumeration',
        plain: 'A dominates B when removing A makes B unreachable.',
        formal: 'exponential, and only ever run on small graphs',
        detail: 'That is precisely what an oracle is for: the fast algorithm is the one that ' +
          'can be subtly wrong, and a wrong dominator tree produces an optimiser that hoists ' +
          'code past a branch and looks correct on every test where the branch went one way. ' +
          'Checking a linear algorithm against an exponential definition on small inputs is ' +
          'cheap and is the only thing that separates "it runs" from "it is right".',
        example: 'Every block of every fixture agrees exactly between the tree and the ' +
          'enumeration.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
