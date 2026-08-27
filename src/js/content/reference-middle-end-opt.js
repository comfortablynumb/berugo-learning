/** Reference entries for loops, calls, aliasing and verification (M29.7-M29.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'loop-optimisations': {
      summary: 'Loop-invariant code motion with an explicit fault-safety condition, run beside ' +
        'a naive version that omits it, plus induction-variable recognition, a weighted cost ' +
        'model whose assumption is printed with the result, and unswitching reported rather ' +
        'than performed.',
      intuition: 'The preheader runs once and the body runs many times, which makes every ' +
        'hoist tempting and every safety condition worth stating precisely — a faulting ' +
        'instruction may only move if the loop running at all guarantees it runs.',
      formulation: {
        equations: [
          {
            label: 'Safe against naive, on the same loop',
            expr: 'version · hoisted · refused · before · after · same answer',
            terms: [
              { sym: 'safe — checks the fault condition', meaning: '4 · 1 · ok · ok · yes' },
              { sym: 'naive — hoists anything invariant', meaning: '5 · 0 · ok · runtime · NO' },
              { sym: 'the refusal', meaning: '%9 — may fault, and b2 does not dominate every loop exit' },
              { sym: 'the verifier', meaning: 'accepts both, which is why running the program is the only gate that catches it' }
            ]
          },
          {
            label: 'The loop, measured',
            expr: 'measure · value',
            terms: [
              { sym: 'depth, body, weighted', meaning: '0 · 15 instructions · 150' },
              { sym: 'the factor', meaning: 'ten assumed iterations per nesting level — an assumption, printed as one' },
              { sym: 'invariant values, induction variables, exits', meaning: '5 · 2 · 1' },
              { sym: 'the two induction variables', meaning: '%15 stepping by an invariant register, %14 stepping by 1' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Anything that may fault is hoisted only if its block dominates every loop exit',
          why: 'A loop that runs zero times must not execute the body, and a loop guard is very often the check that makes the body safe.',
          breaks: 'The naive version turns a program that finished into one that faults, on IR the verifier accepts.'
        },
        {
          name: 'mayFault is a whitelist',
          why: 'A new opcode should be unsafe until somebody has thought about it; a blacklist makes forgetting a miscompilation instead of a missed optimisation.',
          breaks: 'Only division and remainder are listed, so everything else skips the dominance test by construction.'
        },
        {
          name: 'Invariance is computed to a fixpoint',
          why: 'One invariant definition can make another invariant, so a single sweep finds only the shallowest layer and reports no error.',
          breaks: 'Five invariant values are found where a single pass would find two.'
        }
      ],
      complexity: [
        { operation: 'finding invariants', average: 'O(loop instructions × rounds) to a fixpoint', worst: 'rounds bounded by the longest dependence chain' },
        { operation: 'the dominance check per candidate', average: 'O(exits) tree lookups', worst: 'once per faulting candidate' },
        { operation: 'hoisting', average: 'O(hoisted) moves into the preheader', worst: 'order preserved among the moved instructions' },
        { operation: 'the weighted cost', average: 'body size times ten per nesting level', worst: 'an assumption, useful for comparing loops in one function' }
      ],
      failureModes: [
        {
          symptom: 'A program that worked now divides by zero after optimisation.',
          cause: 'A faulting instruction was hoisted out of a body that a guard prevented from running.',
          fix: 'Require dominance over every loop exit for anything that can fault, and refuse with a reason otherwise.'
        },
        {
          symptom: 'LICM finds far less than it should.',
          cause: 'Invariance was computed in one sweep, so a value that depends on another invariant was missed.',
          fix: 'Iterate to a fixpoint; the cost is a few extra passes over the body.'
        },
        {
          symptom: 'The pass has nothing to hoist into.',
          cause: 'The loop header is reached from two blocks outside the loop, so there is no preheader.',
          fix: 'Either create one as a graph transformation or refuse and say so — silently skipping looks like the pass finding nothing.'
        },
        {
          symptom: 'A cost model number is quoted in a report and nobody can defend it.',
          cause: 'The assumed trip count was baked into the figure and never labelled.',
          fix: 'Print the assumption beside the result, and use the number only where it cancels.'
        }
      ],
      inTheWild: [
        'LLVM\'s LICM, with the same speculation-safety question asked through isSafeToSpeculativelyExecute.',
        'GCC\'s loop-invariant motion, and its separate induction-variable optimisation pass.',
        'JIT compilers hoisting bounds checks out of loops, which is exactly this condition on a check that can throw.',
        'Loop unswitching in LLVM, which does perform the duplication this section only reports.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers, chapter 9.5', note: 'loop-invariant motion and the conditions on it' },
        { title: 'Cooper and Torczon — Engineering a Compiler, chapter 8', note: 'induction variables, strength reduction and the loop transformations' },
        { title: 'Allen and Cocke — A Catalogue of Optimizing Transformations (1971)', note: 'where most of these transformations are first named' },
        { title: 'Muchnick — Advanced Compiler Design, chapter 14', note: 'the loop chapter, including unswitching and its cost trade' }
      ]
    },

    'interprocedural-optimisation': {
      summary: 'A call graph that follows copy chains through SSA, an inlining heuristic with a ' +
        'printed cost, benefit and budget per site, escape analysis that reports its reason per ' +
        'allocation, and tail-call recognition — measured over ten conformance programs.',
      intuition: 'A call is a wall the optimiser cannot see across, so inlining is the enabling ' +
        'transformation rather than an optimisation in itself; the heuristic that decides where ' +
        'to apply it is a budget, and every number in it is made up and should be printed.',
      formulation: {
        equations: [
          {
            label: 'The sample',
            expr: 'measure · value',
            terms: [
              { sym: 'direct and indirect calls', meaning: '2 / 0, with 0 recursive edges' },
              { sym: 'sites chosen', meaning: '2 of 2, spending 6 from a budget of 40' },
              { sym: 'the two candidates', meaning: 'read at ratio 1.00, wrap at 1.67' },
              { sym: 'allocations on the stack', meaning: '3 of 5' }
            ]
          },
          {
            label: 'Escape, with reasons',
            expr: 'allocation · escapes · why',
            terms: [
              { sym: 'makeRecord in wrap', meaning: 'yes · returned — exact' },
              { sym: 'makeRecord in main', meaning: 'yes · passed to a call, which this analysis cannot see into — conservative' },
              { sym: 'two closures and a record in main', meaning: 'no · never leaves this frame' },
              { sym: 'across the suite', meaning: '9 of 11 allocations could live on the stack — 81.8%' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The call graph follows copy chains',
          why: 'SSA renaming interposes a copy at every read of a local, so the callee register is several moves from the closure it names.',
          breaks: 'Without it every call is reported indirect, the inliner has nothing to do, and the zero looks plausible.'
        },
        {
          name: 'Direct and indirect edges are counted separately',
          why: 'A whole-program pass that treats an indirect call as one it has seen every caller of will devirtualise something that has another implementation.',
          breaks: 'The graph table names the kind per edge and the suite reports the two columns apart.'
        },
        {
          name: 'Escape analysis reports the reason, not the verdict',
          why: 'Returned is exact and passed-to-a-call is conservative, and only the second could be recovered by more analysis.',
          breaks: 'The reason column separates them; a verdict alone gives a number nobody can act on.'
        }
      ],
      complexity: [
        { operation: 'building the call graph', average: 'O(instructions) plus the copy chains followed', worst: 'a chain is bounded by the function length' },
        { operation: 'the inlining plan', average: 'O(sites log sites) to rank, then greedy against the budget', worst: 'recursive edges excluded outright' },
        { operation: 'escape analysis', average: 'O(instructions × uses) per allocation', worst: 'aliases followed through moves and phis' },
        { operation: 'tail-call detection', average: 'O(instructions) — a two-instruction pattern', worst: 'recognised here, performed by the convention in M30' }
      ],
      failureModes: [
        {
          symptom: 'The inliner reports no candidates on a program full of calls.',
          cause: 'The call graph looked at the call instruction\'s operand instead of following it to an allocation.',
          fix: 'Follow moves and phis back to the definition, and report the direct count so a zero is visible.'
        },
        {
          symptom: 'Compile time explodes and the binary triples.',
          cause: 'Inlining is unboundedly profitable and unboundedly expensive, and nothing said stop.',
          fix: 'Rank by cost-benefit ratio and spend a budget; report what was left on the table.'
        },
        {
          symptom: 'A devirtualised call reaches the wrong implementation once a plugin is loaded.',
          cause: 'An indirect edge was treated as if the whole program were visible.',
          fix: 'Keep the two edge kinds separate and require whole-program knowledge explicitly before devirtualising.'
        },
        {
          symptom: 'Nothing is stack-allocated even though most objects are local.',
          cause: 'Every allocation passed to any call is assumed to escape.',
          fix: 'Compute a per-function summary of which parameters escape — or at minimum report the reason so the imprecision is visible.'
        }
      ],
      inTheWild: [
        'The Go compiler\'s escape analysis, whose -m output is exactly this reason-per-allocation report.',
        'HotSpot\'s scalar replacement, which goes further and splits a non-escaping object into registers.',
        'LLVM\'s inliner and its cost model, which is this shape with far more tuning and a profile.',
        'Scheme and ML implementations, where guaranteed tail calls make deep recursion a supported idiom.'
      ],
      sources: [
        { title: 'Choi, Gupta, Serrano, Sreedhar and Midkiff — Escape Analysis for Java (1999)', note: 'the connection-graph formulation this follows' },
        { title: 'Scheifler — An Analysis of Inline Substitution for a Structured Programming Language (1977)', note: 'the earliest careful treatment of the inlining decision' },
        { title: 'Grove and Chambers — A Framework for Call Graph Construction Algorithms (2001)', note: 'the precision spectrum from CHA to context-sensitive' },
        { title: 'Steele — Debunking the "Expensive Procedure Call" Myth (1977)', note: 'why tail calls are a jump and why that changes what recursion costs' }
      ]
    },

    'alias-analysis': {
      summary: 'Andersen\'s inclusion-based and Steensgaard\'s unification-based points-to ' +
        'analyses run on the same programs and compared pair by pair, both checked against a ' +
        'dynamic oracle that records what actually aliased, with redundant-load elimination as ' +
        'the consumer and a table of language features that answer the question instead.',
      intuition: 'Memory is the gap SSA does not cover, so a load after a store is only the old ' +
        'value if the two pointers cannot be equal; points-to analysis makes that finite by ' +
        'asking which allocation sites each pointer can refer to.',
      formulation: {
        equations: [
          {
            label: 'The merge fixture',
            expr: 'analysis · method · pairs · cost',
            terms: [
              { sym: 'Andersen', meaning: 'inclusion — a subset edge per assignment · 22 pairs · 2 rounds' },
              { sym: 'Steensgaard', meaning: 'unification — classes merged, symmetrically · 28 pairs · 7 merges' },
              { sym: 'precision lost', meaning: '6 pairs — the price of a symmetric, permanent merge' },
              { sym: 'allocation sites', meaning: '2' }
            ]
          },
          {
            label: 'Soundness against the run',
            expr: 'analysis · reported · observed · missed',
            terms: [
              { sym: 'Andersen', meaning: '22 · 16 · 0 — sound' },
              { sym: 'Steensgaard', meaning: '28 · 16 · 0 — sound' },
              { sym: 'the oracle', meaning: 'records what happened on this input; an under-approximation by construction' },
              { sym: 'what that means', meaning: 'it can prove an analysis wrong and can never prove one right' }
            ]
          },
          {
            label: 'Five fixtures',
            expr: 'fixture · sites · Andersen · Steensgaard · lost · loads eliminable',
            terms: [
              { sym: 'merge', meaning: '2 · 22 · 28 · 6 · 0' },
              { sym: 'distinct', meaning: '2 · 2 · 2 · 0 · 0' },
              { sym: 'aliased', meaning: '1 · 6 · 6 · 0 · 1' },
              { sym: 'loop, store', meaning: '2 · 4 · 4 · 0 · 0 and 1 — 1 of 5 separates the two analyses' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every alias that really happens is reported',
          why: 'Reporting more is imprecision and reporting fewer is unsoundness, and every pass downstream trusts the answer.',
          breaks: 'The dynamic oracle records the pairs that occurred; a missed one is a definite bug.'
        },
        {
          name: 'The two analyses compute different relations, not different qualities of the same one',
          why: 'Unification is symmetric and permanent, so one assignment between unrelated pointers makes them alias forever.',
          breaks: 'On two allocation sites the counts are 22 against 28, which describing them would not have shown.'
        },
        {
          name: 'A call invalidates every load the analysis cannot separate',
          why: 'Without an interprocedural summary the callee may write anything, and assuming otherwise is unsound.',
          breaks: 'Two loads of the same field are one redundancy; a call between them makes it zero.'
        }
      ],
      complexity: [
        { operation: 'Andersen', average: 'O(sites³) worst case, solved to a fixpoint over the constraint graph', worst: '2 rounds on this program' },
        { operation: 'Steensgaard', average: 'almost linear with union-find', worst: '7 merges on the same program' },
        { operation: 'alias pairs', average: 'O(registers²) set intersections', worst: '22 and 28 respectively' },
        { operation: 'the dynamic oracle', average: 'O(observations²) per program point', worst: 'one run, one input, one path through the program' }
      ],
      failureModes: [
        {
          symptom: 'A load was forwarded and the value is stale.',
          cause: 'A store between them went through a pointer the analysis wrongly proved distinct.',
          fix: 'Check the analysis against a dynamic oracle; an unsound analysis is worse than none.'
        },
        {
          symptom: 'The analysis proves nothing useful on real code.',
          cause: 'Unification merged everything the moment two pointers met at a join.',
          fix: 'Use inclusion where precision matters, and measure the difference rather than assuming it is small.'
        },
        {
          symptom: 'Two objects allocated in a loop cannot be told apart.',
          cause: 'Allocation-site abstraction gives one name per site, however many objects it creates.',
          fix: 'Accept it, or add context sensitivity — but state the limit, because no amount of solver precision recovers it.'
        },
        {
          symptom: 'Load elimination stops working when a helper call is added.',
          cause: 'The callee may write anything, so the conservative rule clears everything at the call.',
          fix: 'Compute per-function mod summaries, or rely on language guarantees such as immutability.'
        }
      ],
      inTheWild: [
        'LLVM\'s alias-analysis chain, which asks several cheap analyses before any expensive one.',
        'The `restrict` keyword in C, which exists because the analysis usually cannot prove what the programmer knows.',
        'Rust\'s ownership rules, which make unique references a type-system fact rather than an inference.',
        'Java\'s type-based rules, which let a JIT separate pointers of unrelated nominal types for free.'
      ],
      sources: [
        { title: 'Andersen — Program Analysis and Specialization for the C Programming Language (1994)', note: 'the inclusion-based formulation' },
        { title: 'Steensgaard — Points-to Analysis in Almost Linear Time (1996)', note: 'the unification-based one, and the trade it makes' },
        { title: 'Hind — Pointer Analysis: Haven\'t We Solved This Problem Yet? (2001)', note: 'the survey that explains why the answer is still no' },
        { title: 'Hardekopf and Lin — The Ant and the Grasshopper (2007)', note: 'making inclusion-based analysis scale to millions of lines' }
      ]
    },

    'verifying-the-optimiser': {
      summary: 'Three gates run after every pass over seventeen conformance programs, a ' +
        'grammar-driven differential sweep of four hundred generated programs, a shrinker with ' +
        'a validity gate and a same-failure gate, and a coverage table saying which gate would ' +
        'catch a bug in which pass.',
      intuition: 'A verifier says the IR is well formed and a differential run says the program ' +
        'still means what it meant; only the second can see the failure that matters, and a ' +
        'fuzzing campaign without a shrinker produces a backlog rather than a fix.',
      formulation: {
        equations: [
          {
            label: 'The three gates',
            expr: 'gate · catches · blind to',
            terms: [
              { sym: 'the IR verifier', meaning: 'ten structural invariants · a pass producing valid IR that computes the wrong thing' },
              { sym: 'the SSA check', meaning: 'a moved or duplicated definition · the same thing' },
              { sym: 'the differential run', meaning: 'value, output, outcome and every binding · a program that does not terminate' },
              { sym: 'coverage', meaning: 'the verifier has nothing to say about 4 of 6 passes; the differential run has an entry in every row' }
            ]
          },
          {
            label: 'The sweep and the seeded case',
            expr: 'measure · value',
            terms: [
              { sym: 'programs compiled', meaning: '400, each run twice and compared' },
              { sym: 'failures under the full pipeline', meaning: '0' },
              { sym: 'failures under the pipeline with naive LICM', meaning: '0 — the generator cannot write a division guarded by its own loop condition' },
              { sym: 'the seeded program', meaning: 'that exact shape, written by hand, and it fails' }
            ]
          },
          {
            label: 'Shrinking the seeded failure',
            expr: 'measure · before · after',
            terms: [
              { sym: 'lines', meaning: '15 · 6' },
              { sym: 'characters', meaning: '237 · 71' },
              { sym: 'candidates tried, accepted', meaning: '51 · 10' },
              { sym: 'rounds', meaning: '11 — the list is recomputed after every acceptance, or later edits are stale' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every gate runs after every pass',
          why: 'Gating at the end of the pipeline says the pipeline is broken; per pass it names the pass and the invariant.',
          breaks: 'The suite reports 17 of 17 with a per-pass column, and a failure names where it happened.'
        },
        {
          name: 'Every shrink candidate still parses and resolves',
          why: 'A minimal repro that does not compile is a report about undefined behaviour, and is dismissed in one line.',
          breaks: 'Without the gate the reducer deleted a declaration the loop still used, because the failure persisted anyway.'
        },
        {
          name: 'Every accepted candidate fails at the same pass in the same way',
          why: 'A candidate that fails differently has replaced the bug, and the reduction has changed the subject.',
          breaks: 'The comparison is on the failing pass and the kind of failure, not on the fact of failing.'
        }
      ],
      complexity: [
        { operation: 'one gated pass', average: 'O(instructions) to verify plus one execution to compare', worst: 'paid per pass per program' },
        { operation: 'the sweep', average: '400 programs × 2 compilations × 2 runs', worst: 'bounded by a step budget per run' },
        { operation: 'shrinking', average: 'O(candidates × compile) — 51 compiles here', worst: 'recomputed after every acceptance, 11 rounds' },
        { operation: 'the conformance suite', average: '17 programs × 6 passes × 3 gates', worst: '229 instructions in, 129 out' }
      ],
      failureModes: [
        {
          symptom: 'A fuzzing run finds nothing and the optimiser is broken.',
          cause: 'The generator cannot produce the shape the broken pass mishandles.',
          fix: 'Treat coverage as a property of the generator; add seeded cases for shapes the grammar has no production for.'
        },
        {
          symptom: 'The fuzzer reports miscompilations that are not.',
          cause: 'It emitted programs the language does not accept — a leaked loop variable, an unbound name.',
          fix: 'Resolve every generated program before comparing runs; three of four hundred failures here were the generator\'s.'
        },
        {
          symptom: 'The shrinker reports hundreds of accepted candidates and reduces nothing.',
          cause: 'It kept applying a candidate list computed from the previous program, so each acceptance reverted the last.',
          fix: 'Take the first candidate that still fails, then recompute the list from the new program.'
        },
        {
          symptom: 'A bug report sits for weeks.',
          cause: 'It is a two-hundred-line generated program and nobody has time to reduce it.',
          fix: 'Ship the shrinker with the fuzzer; it is the step that turns a found bug into a fixed one.'
        }
      ],
      inTheWild: [
        'Csmith and the hundreds of bugs it found in GCC and LLVM by exactly this loop.',
        'C-Reduce, the shrinker that made those reports actionable, and the reason the campaign worked.',
        'Alive2, which proves LLVM peephole transformations correct rather than testing them.',
        'jsfunfuzz and the JavaScript engine fuzzers, where differential testing runs two engines against each other.'
      ],
      sources: [
        { title: 'Yang, Chen, Eide and Regehr — Finding and Understanding Bugs in C Compilers (2011)', note: 'Csmith, and what randomised differential testing found' },
        { title: 'Regehr, Chen, Cuoq, Eide, Ellison and Yang — Test-Case Reduction for C Compiler Bugs (2012)', note: 'C-Reduce, and why reduction is the hard half' },
        { title: 'Lopes, Lee, Hur, Liu and Regehr — Alive2: Bounded Translation Validation (2021)', note: 'verifying a pass rather than testing it' },
        { title: 'Zeller and Hildebrandt — Simplifying and Isolating Failure-Inducing Input (2002)', note: 'delta debugging, the shrinking algorithm generalised' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
