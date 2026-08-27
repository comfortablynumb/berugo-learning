/** Reference entries for the IR, control-flow graphs and dominators (M29.1-M29.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'designing-an-ir': {
      summary: 'A three-address, typed, register-based IR with explicit blocks and jumps, ten ' +
        'named invariants a verifier enforces after every pass, and an origin column that ' +
        'traces every instruction back to the core node and the source line that produced it.',
      intuition: 'An AST hides the thing every optimisation asks about — the paths control can ' +
        'take — so the middle end lowers it once into blocks and edges and states everything ' +
        'over the graph; a verifier turns "well-formed" into ten specific disasters it will ' +
        'name.',
      formulation: {
        equations: [
          {
            label: 'The loop sample, lowered',
            expr: 'measure · value',
            terms: [
              { sym: 'blocks', meaning: '4, each ending in exactly one terminator' },
              { sym: 'instructions', meaning: '32, terminators included' },
              { sym: 'virtual registers', meaning: '22' },
              { sym: 'slots', meaning: '4 named locals, still in memory until 29.4 promotes them' },
              { sym: 'verifier', meaning: 'all 10 invariants hold' }
            ]
          },
          {
            label: 'The ten invariants',
            expr: 'name · what it requires',
            terms: [
              { sym: 'terminator', meaning: 'every block ends in exactly one terminator' },
              { sym: 'target', meaning: 'every jump target names a block in this function' },
              { sym: 'defined', meaning: 'every register read is defined somewhere' },
              { sym: 'phi-position, phi-edges', meaning: 'phis come first; one entry per predecessor' },
              { sym: 'entry, reachable', meaning: 'the entry has no predecessors; every block is reachable' },
              { sym: 'slot', meaning: 'every local read or written is declared on the function' },
              { sym: 'single-def, dominance', meaning: 'the two SSA invariants, checked from 29.3 onwards' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every block ends in exactly one terminator',
          why: 'A block that falls off its end has no successors, and every graph algorithm downstream reads successors.',
          breaks: 'The verifier names the block and the pass that left it, rather than a crash three passes later.'
        },
        {
          name: 'Every instruction carries the core node and source span it came from',
          why: 'A wrong instruction has to be traceable to the construct that emitted it, or debugging the lowering means reading IR by eye.',
          breaks: 'The origin table is rendered from those fields, so a missing one shows as an empty cell.'
        },
        {
          name: 'The verifier runs after every pass, not at the end',
          why: 'At the end it says the pipeline is broken; per pass it says which pass and which invariant.',
          breaks: 'The pass table has a verify column per row, and a NO names the invariant.'
        }
      ],
      complexity: [
        { operation: 'lowering one core node', average: 'O(1) amortised — emit into the current block', worst: 'O(1)' },
        { operation: 'verifying a function', average: 'O(instructions + edges) for the eight structural invariants', worst: 'plus O(blocks²) for dominance' },
        { operation: 'the loop sample', average: '32 instructions over 4 blocks', worst: '22 registers, 4 slots' },
        { operation: 'cloning a function for a differential run', average: 'O(instructions)', worst: 'once per pass per program' }
      ],
      failureModes: [
        {
          symptom: 'A pass works on small functions and produces nonsense on a loop.',
          cause: 'It assumed a tree, or assumed forward-only edges, and the back edge broke it.',
          fix: 'State the pass over the graph, and check it on a fixture whose graph is cyclic.'
        },
        {
          symptom: 'The IR is valid and the program computes the wrong answer.',
          cause: 'A verifier is a structural check and cannot see semantics.',
          fix: 'Gate every pass on a differential run against the unoptimised program as well.'
        },
        {
          symptom: 'A wrong instruction cannot be attributed to anything.',
          cause: 'The lowering dropped the source span, so the IR is a flat list with no provenance.',
          fix: 'Carry the core node and the span on every instruction; it costs two fields and saves the debugging.'
        },
        {
          symptom: 'A pass deletes a block and a later pass jumps to nowhere.',
          cause: 'A deletion is a two-place edit and the predecessor list was not updated.',
          fix: 'Make target validity an invariant so the deletion fails immediately rather than the jump much later.'
        }
      ],
      inTheWild: [
        'LLVM IR, which is SSA, typed, and verified by a pass that runs in every debug build.',
        'Cranelift\'s CLIF, whose verifier is the reason a JIT can trust a freshly written pass.',
        'The Go compiler\'s SSA form, which can dump every intermediate function as HTML for exactly this reason.',
        'WebAssembly, which is a stack machine but validates every function against a typed abstract interpretation.'
      ],
      sources: [
        { title: 'Cooper and Torczon — Engineering a Compiler', note: 'the IR design chapter this milestone follows' },
        { title: 'Muchnick — Advanced Compiler Design and Implementation', note: 'the catalogue of representations and what each is good at' },
        { title: 'Lattner and Adve — LLVM: A Compilation Framework (2004)', note: 'why a typed SSA IR with a verifier became the default' },
        { title: 'Appel — Modern Compiler Implementation in ML', note: 'lowering a functional core language to blocks and jumps' }
      ]
    },

    'control-flow-graphs': {
      summary: 'Blocks and edges built from the lowered IR, with back edges identified by ' +
        'dominance, natural loops merged per header, critical edges found and split, and six ' +
        'fixtures measured to show which shapes the language can actually produce.',
      intuition: 'The graph is the object every later analysis is stated over; a back edge is ' +
        'one whose target dominates its source, which is what separates a loop from a jump into ' +
        'the middle of one.',
      formulation: {
        equations: [
          {
            label: 'Six fixtures, measured',
            expr: 'program · blocks · edges · critical · unreachable · loops',
            terms: [
              { sym: 'nested', meaning: '7 · 8 · 0 · 0 · 2' },
              { sym: 'conditional, twoLatches', meaning: '7 · 8 · 0 · 0 · 1 each' },
              { sym: 'early', meaning: '7 · 7 · 0 · 0 · 1' },
              { sym: 'straight', meaning: '1 · 0 · 0 · 0 · 0' },
              { sym: 'handmade', meaning: '5 · 7 · 6 · 0 · 0 — and irreducible' }
            ]
          },
          {
            label: 'The loop-shaped definitions',
            expr: 'term · condition',
            terms: [
              { sym: 'back edge', meaning: 'its target dominates its source' },
              { sym: 'natural loop', meaning: 'the target, plus everything that reaches the source without leaving through the target' },
              { sym: 'critical edge', meaning: 'from a block with several successors to one with several predecessors' },
              { sym: 'reducible', meaning: 'every loop has a single entry — true for all structured control flow' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A natural loop is merged per header, not per back edge',
          why: 'Two latches jumping to the same header are one loop, and treating them as two double-counts every body instruction.',
          breaks: 'The twoLatches fixture reports 1 loop from 2 back edges.'
        },
        {
          name: 'Splitting removes every critical edge and adds no others',
          why: 'SSA destruction places copies on edges, and a copy on a critical edge lands where it must not run.',
          breaks: 'The handmade fixture goes from 5 blocks with 6 critical edges to 11 blocks with none.'
        },
        {
          name: 'The loop finder agrees with an enumeration of the definition',
          why: 'A finder that over-collects by one block returns a plausible set and every loop pass built on it is wrong.',
          breaks: 'The oracle column compares block sets per loop, and reports 2 of 2 agreeing.'
        }
      ],
      complexity: [
        { operation: 'building the graph', average: 'O(instructions)', worst: 'one pass over the block list' },
        { operation: 'finding back edges', average: 'O(edges) given the dominator tree', worst: 'plus the cost of dominance' },
        { operation: 'a natural loop', average: 'O(blocks + edges) by backward reachability from the latch', worst: 'per back edge' },
        { operation: 'the oracle', average: 'exponential — it enumerates paths', worst: 'usable on seven blocks and nothing larger' }
      ],
      failureModes: [
        {
          symptom: 'A "loop" was found that is really a jump into the middle of a region.',
          cause: 'Back edges were identified by block ordering rather than by dominance.',
          fix: 'Use the dominance test; it is the definition and it costs one lookup per edge.'
        },
        {
          symptom: 'SSA destruction inserted a copy that runs on a path it should not.',
          cause: 'A phi operand was placed on a critical edge, so the copy landed in a block reached from elsewhere.',
          fix: 'Split critical edges before destruction; the check is two counts per edge.'
        },
        {
          symptom: 'A loop pass loops forever or misses most of the body.',
          cause: 'The graph is irreducible and the algorithm assumed a single entry per loop.',
          fix: 'Detect irreducibility and either bail out or run node splitting, but do not silently proceed.'
        },
        {
          symptom: 'Dead code survives every pass and nothing explains why.',
          cause: 'Unreachable blocks were never pruned, so their instructions look used by their own successors.',
          fix: 'Remove unreachable blocks as part of building the graph, and report the count.'
        }
      ],
      inTheWild: [
        'LLVM\'s LoopInfo, which is exactly natural loops from back edges, merged per header.',
        'GCC\'s CFG with its critical-edge splitting pass, run before out-of-SSA for the same reason.',
        'JVM bytecode verification, which builds a CFG per method to type-check every merge point.',
        'Binary analysis tools such as Ghidra and angr, where recovering the CFG from machine code is the hard part.'
      ],
      sources: [
        { title: 'Allen — Control Flow Analysis (1970)', note: 'the paper that named basic blocks and intervals' },
        { title: 'Hecht and Ullman — Characterizations of Reducible Flow Graphs (1974)', note: 'what reducibility is and why structured code has it' },
        { title: 'Cooper and Torczon — Engineering a Compiler, chapter 9', note: 'natural loops, back edges and the merging rule' },
        { title: 'Ramalingam — Identifying Loops in Almost Linear Time (1999)', note: 'the loop-forest algorithms that handle irreducible graphs' }
      ]
    },

    'dominators': {
      summary: 'The Cooper-Harvey-Kennedy iterative dominator tree, reaching its fixpoint in ' +
        'two rounds over seven blocks, checked block by block against an exponential ' +
        'enumeration of the definition, with dominance frontiers, post-dominators and the six ' +
        'optimiser questions they answer.',
      intuition: 'Dominance answers "does every path here go through there", which is the same ' +
        'question six unrelated-looking passes are really asking; the frontier is where a value ' +
        'stops being the only possibility, which is where a phi goes.',
      formulation: {
        equations: [
          {
            label: 'The fixpoint',
            expr: 'round · blocks whose dominator changed',
            terms: [
              { sym: 'round 1', meaning: '6 — every block gets its first answer from its predecessors' },
              { sym: 'round 2', meaning: '0 — nothing changed, which is what proves the fixpoint' },
              { sym: 'visit order', meaning: 'reverse postorder, so every predecessor but a back edge is already known' },
              { sym: 'against the oracle', meaning: '7 of 7 blocks agree' }
            ]
          },
          {
            label: 'Six passes, one tree',
            expr: 'question · the dominance form of it',
            terms: [
              { sym: 'is this definition available at that use', meaning: 'does the defining block dominate the using block' },
              { sym: 'can I hoist this out of the loop', meaning: 'does its block dominate every exit of the loop' },
              { sym: 'is this edge a back edge', meaning: 'does the target dominate the source' },
              { sym: 'where does a value stop being the only possibility', meaning: 'the dominance frontier of the defining block' },
              { sym: 'will this definitely run if I get here', meaning: 'does it post-dominate this block' },
              { sym: 'is this computation redundant', meaning: 'has an equal one been computed in a dominating block' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The iteration runs one more round than it needs',
          why: 'A fixpoint is proved by a round that changes nothing; stopping when a round is small is a guess.',
          breaks: 'The rounds table reports the changed count per round, and the last is zero.'
        },
        {
          name: 'The frontier of a block is computed from the graph, before any phi exists',
          why: 'Phi placement must not depend on phis, or the construction is circular.',
          breaks: 'The frontier column is filled from predecessors and immediate dominators alone.'
        },
        {
          name: 'The tree agrees with the definition on every block',
          why: 'A wrong dominator tree produces an optimiser that hoists past a branch and passes every test where the branch went one way.',
          breaks: 'The oracle removes each block and asks what becomes unreachable; 7 of 7 agree.'
        }
      ],
      complexity: [
        { operation: 'one round of the iteration', average: 'O(blocks × predecessors) set intersections', worst: 'as many rounds as the loop nesting depth plus one' },
        { operation: 'this graph', average: '2 rounds over 7 blocks', worst: '6 changes then 0' },
        { operation: 'dominance frontiers', average: 'O(edges) once the tree exists', worst: 'one walk per join predecessor' },
        { operation: 'the oracle', average: 'O(blocks × (blocks + edges)) reachability searches', worst: 'a definition, not an algorithm' }
      ],
      failureModes: [
        {
          symptom: 'Phis appear in the wrong blocks and SSA construction produces wrong values.',
          cause: 'The dominance frontier was computed from an incorrect tree.',
          fix: 'Check the tree against the removal definition on small graphs before trusting it.'
        },
        {
          symptom: 'The dominator computation is slow on large functions.',
          cause: 'Blocks are visited in an arbitrary order, so facts propagate one edge per round.',
          fix: 'Visit in reverse postorder — the same fixpoint in far fewer rounds, and it is only a performance change.'
        },
        {
          symptom: 'A pass hoists a computation past a branch that guarded it.',
          cause: 'It checked that the definition dominated the use and not that its block dominated the exits.',
          fix: 'Use the right dominance question for the transformation; the six are not interchangeable.'
        },
        {
          symptom: 'Post-dominators come out wrong on a function with several returns.',
          cause: 'Post-dominance is dominance on the reversed graph and needs a single exit to reverse from.',
          fix: 'Add a virtual exit block that every return flows to, then reverse.'
        }
      ],
      inTheWild: [
        'LLVM\'s DominatorTree, recomputed after any change to the CFG and consulted by nearly every pass.',
        'GCC\'s dominance info, with the same two flavours and the same virtual exit for post-dominance.',
        'Static analysers that report "this check always passes" using post-dominance over the guard.',
        'JIT compilers, where the iterative algorithm is preferred over Lengauer-Tarjan for being simpler and fast enough.'
      ],
      sources: [
        { title: 'Cooper, Harvey and Kennedy — A Simple, Fast Dominance Algorithm (2001)', note: 'the iterative algorithm implemented here, and why it beats the asymptotically better one' },
        { title: 'Lengauer and Tarjan — A Fast Algorithm for Finding Dominators (1979)', note: 'the near-linear algorithm the above paper argues against in practice' },
        { title: 'Cytron, Ferrante, Rosen, Wegman and Zadeck — Efficiently Computing SSA Form (1991)', note: 'dominance frontiers and what they are for' },
        { title: 'Prosser — Applications of Boolean Matrices to the Analysis of Flow Diagrams (1959)', note: 'where the notion of dominance first appears' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
