/** Reference entries for SSA, dataflow and the scalar passes (M29.4-M29.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'ssa-form': {
      summary: 'Cytron phi placement at iterated dominance frontiers, renaming down the ' +
        'dominator tree, pruning to a fixpoint, and destruction back to copies with a ' +
        'sequencer that breaks cycles — measured over every conformance program plus one ' +
        'hand-built swap the language cannot express.',
      intuition: 'Give every register exactly one definition and "the definition of this value" ' +
        'becomes a pointer instead of a search; the phi is the third definition that says which ' +
        'edge you arrived on.',
      formulation: {
        equations: [
          {
            label: 'Placement and pruning across the suite',
            expr: 'program · placed · pruned · kept · instructions',
            terms: [
              { sym: 'conditional', meaning: '1 · 0 · 1 · 9' },
              { sym: 'match', meaning: '4 · 2 · 2 · 27' },
              { sym: 'while', meaning: '1 · 0 · 1 · 12' },
              { sym: 'for', meaning: '3 · 1 · 2 · 26' },
              { sym: 'all four', meaning: '9 placed, 3 pruned, 6 kept — the distance between minimal and pruned SSA' }
            ]
          },
          {
            label: 'Destruction',
            expr: 'program · phis · copies · temporaries',
            terms: [
              { sym: 'conditional, while', meaning: '1 · 2 · 0 each' },
              { sym: 'match, for', meaning: '2 · 4 · 0 each' },
              { sym: 'hand-built swap', meaning: '3 · 7 · 1 — the only case needing a temporary' },
              { sym: 'behaviour', meaning: 'preserved on 5 of 5' }
            ]
          },
          {
            label: 'The loop sample',
            expr: 'measure · value',
            terms: [
              { sym: 'phis placed, pruned', meaning: '3 placed, 1 pruned, 2 kept' },
              { sym: 'slots promoted', meaning: '4, with 0 reads finding no definition on any path' },
              { sym: 'SSA property', meaning: 'holds — 22 definitions, every use dominated by its own' },
              { sym: 'the suite', meaning: '17 of 17 hold both invariants and agree with the core' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every register has exactly one definition',
          why: 'Every pass in this milestone is stated in terms of "the" definition of a value, and there has to be one.',
          breaks: 'The SSA check walks the function and names any register defined twice.'
        },
        {
          name: 'Every use is dominated by its definition, with phis judged on the edge',
          why: 'A phi operand is used on the incoming edge, so it must dominate the PREDECESSOR, not the phi\'s own block.',
          breaks: 'A checker that forgets this rejects correct SSA, which makes the invariant useless because nobody turns it on.'
        },
        {
          name: 'Construction preserves behaviour on every conformance program',
          why: 'Promotion and renaming are the two places a compiler quietly changes what a program computes.',
          breaks: 'The check column runs the IR before and after and compares value, output, outcome and bindings.'
        }
      ],
      complexity: [
        { operation: 'phi placement', average: 'O(blocks × slots) using iterated dominance frontiers', worst: 'the frontier of a join can be most of the graph' },
        { operation: 'renaming', average: 'O(instructions) — one walk down the dominator tree with a stack per slot', worst: 'plus one entry per predecessor per phi' },
        { operation: 'pruning', average: 'O(phis²) as a fixpoint', worst: 'removing one phi can unread another' },
        { operation: 'destruction', average: 'O(phis × predecessors) copies', worst: 'plus one temporary per cycle' }
      ],
      failureModes: [
        {
          symptom: 'A value read at a join is the wrong branch\'s value.',
          cause: 'Renaming popped the stack at the wrong point, or the phi operand was taken from the block rather than the edge.',
          fix: 'Push and pop per dominator-tree node, and fill phi operands when walking each predecessor.'
        },
        {
          symptom: 'The function is full of phis nothing reads.',
          cause: 'Minimal SSA places at the frontier of every writing block without asking whether the result is live.',
          fix: 'Prune to a fixpoint afterwards; a simple construction plus a simple cleanup beats one clever pass.'
        },
        {
          symptom: 'Destruction produced a program that swaps two values wrongly.',
          cause: 'The copies for a set of phis were emitted in order, and two of them named each other.',
          fix: 'Sequence the copies and break any cycle with one temporary — and test it, because most languages never produce one.'
        },
        {
          symptom: 'A local could not be promoted and nobody can say why.',
          cause: 'Something can take its address, so a store through a pointer might write it.',
          fix: 'Report the refusal per slot; in a language with no address-of, the count should be zero and a non-zero one is a bug.'
        }
      ],
      inTheWild: [
        'LLVM\'s mem2reg, which is exactly this promotion and is the first pass in nearly every pipeline.',
        'The Go compiler, which builds SSA directly from the AST rather than promoting afterwards.',
        'V8\'s Turbofan sea-of-nodes IR, where SSA is the representation rather than a form applied to one.',
        'Cranelift, whose block parameters replace phis and make the edge explicit in the syntax.'
      ],
      sources: [
        { title: 'Cytron, Ferrante, Rosen, Wegman and Zadeck — Efficiently Computing Static Single Assignment Form (1991)', note: 'the placement and renaming algorithms implemented here' },
        { title: 'Briggs, Cooper, Harvey and Simpson — Practical Improvements to the Construction and Destruction of SSA Form (1998)', note: 'the copy sequencing and the cycle-breaking temporary' },
        { title: 'Braun, Buchwald, Hack et al. — Simple and Efficient Construction of SSA Form (2013)', note: 'construction without dominance frontiers, as the Go and Firm compilers do it' },
        { title: 'Appel — SSA is Functional Programming (1998)', note: 'why a phi is a parameter and a block is a function' }
      ]
    },

    'dataflow-analysis': {
      summary: 'One worklist solver parameterised by direction, meet, initial value and ' +
        'transfer function, instantiated as liveness, reaching definitions, available ' +
        'expressions and very-busy expressions, with liveness checked against a path ' +
        'enumeration on five fixtures and the cost of each analysis reported as visits per ' +
        'block.',
      intuition: 'A dataflow analysis is a lattice plus a transfer function iterated to a ' +
        'fixpoint; the lattice height guarantees termination, the meet decides whether a fact ' +
        'must hold on every path or on some path, and the initial value has to match the meet ' +
        'or the answer is confidently wrong.',
      formulation: {
        equations: [
          {
            label: 'Four analyses, one solver',
            expr: 'analysis · direction · meet · initial · question',
            terms: [
              { sym: 'liveness', meaning: 'backward · union · empty · does this register still have a reader ahead' },
              { sym: 'reaching', meaning: 'forward · union · empty · which definitions could be the current value' },
              { sym: 'available', meaning: 'forward · intersect · everything · which computations are already done on every path' },
              { sym: 'busy', meaning: 'backward · intersect · everything · which computations will happen on every path from here' }
            ]
          },
          {
            label: 'Cost on the same four-block function',
            expr: 'analysis · visits · visits per block',
            terms: [
              { sym: 'available', meaning: '4 · 1.00' },
              { sym: 'liveness', meaning: '6 · 1.50' },
              { sym: 'reaching', meaning: '7 · 1.75' },
              { sym: 'busy', meaning: '8 · 2.00' }
            ]
          },
          {
            label: 'Liveness against the oracle',
            expr: 'fixture · blocks · visits · live registers · agrees',
            terms: [
              { sym: 'loop', meaning: '4 · 6 · 5 · yes' },
              { sym: 'branch', meaning: '4 · 7 · 3 · yes' },
              { sym: 'both', meaning: '7 · 14 · 10 · yes' },
              { sym: 'reuse, straight', meaning: '1 · 1 · 0 · yes each — 5 of 5 exact' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The initial value matches the meet',
          why: 'Union analyses start at empty and intersection analyses start at everything; the mismatch is silent.',
          breaks: 'An intersection analysis started at empty converges on the first visit and reports a well-formed fixpoint of nothing.'
        },
        {
          name: 'A block re-enters the worklist only when a neighbour\'s fact changed',
          why: 'That is the whole difference between a worklist and a sweep, and on a function with one hot loop it is most of the cost.',
          breaks: 'The visits column is reported per fixture, and straight-line code costs exactly one visit per block.'
        },
        {
          name: 'Liveness agrees with an enumeration of paths',
          why: 'A subtly wrong liveness analysis reports a plausible set and the register allocator built on it produces code that works on most tests.',
          breaks: 'The oracle column compares against the definition on five fixtures; 5 of 5 agree exactly.'
        }
      ],
      complexity: [
        { operation: 'one visit', average: 'O(facts × predecessors) to meet, plus the transfer function', worst: 'set operations over the fact universe' },
        { operation: 'to a fixpoint', average: 'O(blocks × lattice height) visits for a reducible graph', worst: 'the loop fixture takes 6 visits over 4 blocks' },
        { operation: 'a sweep instead', average: 'the same fixpoint, one full pass per round', worst: 'pays for every block whether or not anything moved' },
        { operation: 'the oracle', average: 'exponential — it enumerates paths', worst: 'runnable on four blocks, useless past that' }
      ],
      failureModes: [
        {
          symptom: 'An intersection analysis reports that nothing is available anywhere.',
          cause: 'It was initialised to the empty set, so the first meet fixed the answer at the bottom of the lattice.',
          fix: 'Initialise to the full set for an intersection analysis, and check the pairing in the framework table.'
        },
        {
          symptom: 'The solver never terminates.',
          cause: 'The lattice has infinite height — an interval or a set of constants that keeps growing.',
          fix: 'Add a widening operator that jumps to the top after a bounded number of increases.'
        },
        {
          symptom: 'A backward analysis looks wrong when read in source order.',
          cause: 'Nothing is wrong: OUT is computed from the successors and IN is the transfer function applied to it.',
          fix: 'Read OUT first, then IN, and label the columns in that order.'
        },
        {
          symptom: 'A register allocator spills values that were dead.',
          cause: 'Liveness was computed over slots rather than registers, or the transfer function counted a definition as a use.',
          fix: 'Check liveness against a path enumeration on small graphs; the mismatch is immediate and specific.'
        }
      ],
      inTheWild: [
        'Every optimising compiler\'s liveness pass, which register allocation cannot start without.',
        'LLVM\'s dataflow framework and the lattice-based analyses built on it.',
        'Abstract interpretation as used by Astrée and Infer, which is this framework with richer lattices.',
        'Java\'s definite-assignment rules, which are a reaching-definitions analysis written into the language specification.'
      ],
      sources: [
        { title: 'Kildall — A Unified Approach to Global Program Optimization (1973)', note: 'the framework: lattice, meet, transfer function, fixpoint' },
        { title: 'Kam and Ullman — Monotone Data Flow Analysis Frameworks (1977)', note: 'when the iteration terminates and what it converges to' },
        { title: 'Cousot and Cousot — Abstract Interpretation (1977)', note: 'the general theory, and where widening comes from' },
        { title: 'Aho, Lam, Sethi and Ullman — Compilers, chapter 9', note: 'the four classical analyses side by side' }
      ]
    },

    'scalar-optimisations': {
      summary: 'Sparse conditional constant propagation, copy propagation, global value ' +
        'numbering, five typed peephole rules and dead-code elimination, each gated by the ' +
        'verifier, the SSA check and a differential run, with SCCP compared against its two ' +
        'components and phase ordering measured on five fixtures.',
      intuition: 'Constant propagation and unreachable-code elimination each block the other ' +
        'when run apart and unblock each other when run to a joint fixpoint; every other pass ' +
        'here is cheap, local and only sound because the IR is typed and in SSA.',
      formulation: {
        equations: [
          {
            label: 'The guarded fixture through four pipelines',
            expr: 'pipeline · instructions · blocks removed · branches straightened · values folded',
            terms: [
              { sym: 'SSA construction only', meaning: '15 · 0 · 0 · 0' },
              { sym: 'folding without reachability', meaning: '12 · 0 · 0 · 0' },
              { sym: 'SCCP alone', meaning: '7 · 1 · 1 · 5' },
              { sym: 'the full pipeline', meaning: '6 · 1 · 1 · 5 — 19 down to 6, 68.4% removed' }
            ]
          },
          {
            label: 'Phase ordering, five fixtures',
            expr: 'fixture · A then B · B then A · difference',
            terms: [
              { sym: 'guarded, folding', meaning: '6 · 7 · -1 each' },
              { sym: 'redundant', meaning: '5 · 6 · -1' },
              { sym: 'identities', meaning: '36 · 36 · none' },
              { sym: 'loop', meaning: '25 · 25 · none — 3 of 5 differ, and no order dominates' }
            ]
          },
          {
            label: 'The whole suite',
            expr: 'measure · value',
            terms: [
              { sym: 'programs passing every gate after every pass', meaning: '17 of 17' },
              { sym: 'instructions removed', meaning: '100 of 229 — 43.7%' },
              { sym: 'best and worst ratio', meaning: 'let-chain and conditional at 0.36; while at 0.77' },
              { sym: 'peephole rules on the identities fixture', meaning: '4 of 5 fire; 45 instructions to 24' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A phi meets only the operands arriving on reachable edges',
          why: 'That single clause is what makes a value constant on every reachable path stay constant, and it is the whole of the combination.',
          breaks: 'Folding without reachability reaches 12 instructions where SCCP reaches 7.'
        },
        {
          name: 'Every peephole rule is justified by a type',
          why: 'Multiplying by zero gives zero for a number and does not for a string, so an untyped IR cannot carry the rule.',
          breaks: 'The rules table names the rewrite and the fire count; a rule that never fires anywhere is dead weight.'
        },
        {
          name: 'Three gates after every pass, not at the end of the pipeline',
          why: 'At the end the report is "the pipeline is broken"; per pass it names the pass and the invariant.',
          breaks: 'The pass table carries verify, SSA and same-answer columns per row.'
        }
      ],
      complexity: [
        { operation: 'SCCP', average: 'O(instructions × lattice height) over two worklists', worst: 'each register moves down at most twice' },
        { operation: 'copy propagation', average: 'O(instructions) following move chains', worst: 'a chain can be as long as the function' },
        { operation: 'value numbering', average: 'O(instructions) hashed by opcode and operands, over the dominator tree', worst: 'only sound where the earlier definition dominates' },
        { operation: 'dead code', average: 'O(instructions) marking from roots to a fixpoint', worst: 'effects and results are roots' }
      ],
      failureModes: [
        {
          symptom: 'A constant obviously known at a join is not propagated.',
          cause: 'The phi met an operand arriving on a branch that is never taken.',
          fix: 'Run propagation and reachability jointly, and meet only over edges marked executable.'
        },
        {
          symptom: 'Dead-code elimination deleted a print, or the program\'s result.',
          cause: 'The mark phase started from uses only, and effects and results are not used by anything.',
          fix: 'Make effects and the function result roots, and re-run the differential check on a program with output.'
        },
        {
          symptom: 'Value numbering replaced a use with a definition that does not reach it.',
          cause: 'Two equal expressions were numbered together without checking dominance.',
          fix: 'Number over the dominator tree so the earlier definition provably dominates the later use.'
        },
        {
          symptom: 'Reordering two passes changed the output size and nobody can say which is right.',
          cause: 'Neither is: phase ordering has no globally best answer.',
          fix: 'Measure both orders over a suite, pick one, and run the cheap passes twice to recover most of the difference.'
        }
      ],
      inTheWild: [
        'LLVM\'s SCCP and IPSCCP passes, which are this algorithm and its interprocedural version.',
        'GCC\'s tree-ssa-ccp, running on the same joint fixpoint principle.',
        'HotSpot C2\'s parse-time folding, which does much of this while building the IR.',
        'Every JavaScript engine\'s inline caches, which are constant propagation over types rather than values.'
      ],
      sources: [
        { title: 'Wegman and Zadeck — Constant Propagation with Conditional Branches (1991)', note: 'SCCP, and the argument for the joint fixpoint' },
        { title: 'Alpern, Wegman and Zadeck — Detecting Equality of Variables in Programs (1988)', note: 'global value numbering over SSA' },
        { title: 'Click and Cooper — Combining Analyses, Combining Optimizations (1995)', note: 'why combined passes beat any ordering of separate ones' },
        { title: 'Muchnick — Advanced Compiler Design, chapters 12-13', note: 'the catalogue of scalar transformations and their preconditions' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
