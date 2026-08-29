/** Concepts for loops, interprocedural work, aliasing and verification (M29.7-M29.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'loop-optimisations': [
      {
        term: 'The preheader runs once and the body runs many times',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a computation inside the loop"] --> B["runs n times"]',
            '    C["the same computation<br/>in the preheader"] --> D["runs once"]',
            '    D --> E["so moving it is a win<br/>proportional to the trip count"]',
            '    B --> E',
            '    E --> F["and the whole difficulty is<br/>proving the move is legal"]'
          ].join('\n'),
          caption: 'The economics are never in doubt. Every loop optimisation is an argument about legality, because the payoff was obvious before anyone started.'
        },
        plain: 'That asymmetry is the entire economic argument.',
        formal: 'moving one instruction out of a thousand-iteration body saves 999 executions',
        detail: 'It is also why the safety conditions are worth being careful about: the payoff ' +
          'makes the temptation strong, and every loop optimisation is a rearrangement that ' +
          'has to hold on the paths nobody pictured. A preheader is specifically a block that ' +
          'runs once, immediately before the loop, that every entry passes through — without ' +
          'one there is nowhere to move to.',
        example: 'A loop with no preheader is refused with that reason rather than hoisted into ' +
          'one of its predecessors.'
      },
      {
        term: 'Invariance is a fixpoint, not a sweep',
        plain: 'One invariant definition can make another invariant.',
        formal: 'every operand defined outside the loop, or itself invariant',
        detail: 'Stopping after a single pass finds only the shallowest layer, which looks like ' +
          'the pass working and quietly leaves most of the win on the table. The failure mode ' +
          'is the worst kind for an optimisation: no wrong answers, no error, just less than ' +
          'was available, and nothing to compare against unless somebody measures.',
        example: 'Five invariant values found in a loop where a single sweep would find two.'
      },
      {
        term: 'Hoisting a faulting operation needs a dominance proof',
        plain: 'It may only move if the loop running at all guarantees it runs.',
        formal: 'its block must dominate every exit of the loop',
        detail: 'The condition is where most hand-written loop optimisations become bugs, and ' +
          'the reason it is missed is that the transformation is obviously correct in the case ' +
          'everyone pictures. What the picture omits is the loop that runs zero times — and a ' +
          'loop guard is very often precisely the check that makes the body safe, so the ' +
          'empty-input case is the one that breaks.',
        example: 'A division whose guard is the loop condition: safe LICM refuses it, naive ' +
          'LICM hoists it, and the program then divides by zero.'
      },
      {
        term: 'mayFault is a whitelist',
        plain: 'A new opcode should be unsafe to hoist until somebody has thought about it.',
        formal: 'only division and remainder can fault in this instruction set',
        detail: 'A blacklist has the opposite default: anything not listed is assumed safe, so ' +
          'adding an opcode silently makes it hoistable. The list is short here because the ' +
          'instruction set is small, and the direction of the default is the part worth ' +
          'copying — it is the difference between forgetting causing a missed optimisation and ' +
          'forgetting causing a miscompilation.',
        example: 'Everything except division and remainder is reported as unable to fault, so ' +
          'the dominance test is not even consulted.'
      },
      {
        term: 'Loads are excluded from hoisting, and that is an admission',
        plain: 'A load can only move if nothing in the loop writes the same memory.',
        formal: 'which is the aliasing question',
        detail: 'Without an alias analysis the honest answer is to refuse, and saying so is ' +
          'better than hoisting and hoping. It is also the clearest illustration of why the ' +
          'aliasing section exists: the optimisation is obviously profitable, obviously legal ' +
          'in most cases, and cannot be performed because the compiler cannot tell which cases ' +
          'those are.',
        example: 'Only constants, arithmetic and copies are candidates; a field load inside a ' +
          'loop stays where it is.'
      },
      {
        term: 'A basic induction variable is a phi plus an invariant step',
        plain: 'Its back-edge value is itself plus something that does not change.',
        formal: 'recognised by pattern, not by analysis',
        detail: 'The pattern is small enough that failing to look for it is the only reason not ' +
          'to, and recognising it is the precondition for strength reduction, for bounds ' +
          'analysis and for knowing a loop\'s trip count at all. A loop lowered from `for` ' +
          'always has one because the lowering introduced the index; a `while` has one only if ' +
          'the programmer wrote a counter.',
        example: 'Two induction variables in a lowered for loop: the index the desugaring made ' +
          'and the accumulator the programmer wrote.'
      },
      {
        term: 'A cost model multiplies by an assumption',
        plain: 'Without a static trip count the factor has to be guessed.',
        formal: 'ten per nesting level, stated as an assumption',
        detail: 'Every cost model in every compiler does something like this, and the important ' +
          'part is labelling it. An unlabelled factor in a cost column is how a heuristic ' +
          'becomes folklore that nobody can defend or revise. The number is useful for ' +
          'comparing two loops in the same function, where the assumption cancels, and useless ' +
          'as an absolute figure in a report.',
        example: 'A loop body of fifteen instructions at depth zero is charged 150; the same ' +
          'body one level deeper would be charged 1 500.'
      },
      {
        term: 'Unswitching is reported rather than performed',
        plain: 'Hoisting an invariant branch means duplicating the loop.',
        formal: 'which needs a block cloner, and a pass without one fails the verifier',
        detail: 'Reporting the opportunity honestly is better than shipping a transformation ' +
          'that fails its own gate — and the gate catching it is the verifier doing exactly ' +
          'what it exists for. The trade the transformation makes is also worth stating as two ' +
          'numbers: the branch is removed from every iteration and the code size roughly ' +
          'doubles, which is a decision made against an instruction-cache budget.',
        example: 'A loop with an invariant condition reports a body of thirty instructions ' +
          'becoming sixty after duplication.'
      }
    ],

    'interprocedural-optimisation': [
      {
        term: 'A call is a wall, and inlining removes it',
        plain: 'The optimiser cannot see across a call in either direction.',
        formal: 'inlining is the enabling transformation for everything else',
        detail: 'It cannot fold a constant argument into the body, cannot value-number across ' +
          'the boundary, cannot prove a record does not escape. Removing the wall lets every ' +
          'scalar pass work on code it could not previously reach, which is why compilers ' +
          'spend so much of their budget on the heuristic and why a refactor that moves code ' +
          'across a function boundary can change performance by a factor.',
        example: 'A call to a three-instruction function, inlined, lets constant folding ' +
          'collapse the whole expression.'
      },
      {
        term: 'The heuristic is a budget, not a rule',
        plain: 'Inlining is unboundedly profitable and unboundedly expensive.',
        formal: 'cost by callee size, benefit by call overhead plus constant arguments',
        detail: 'Something has to say stop, and every real heuristic has this shape under the ' +
          'tuning: an estimate per site, a ranking, and a budget that runs out. The numbers are ' +
          'made up — every real one\'s are — and reporting them per site is what makes the ' +
          'decisions readable rather than mysterious. A production inliner adds call-site ' +
          'frequency from a profile, which is the single biggest available improvement.',
        example: 'Two candidate sites at ratios 1.67 and 1.00, both taken from a budget of 40 ' +
          'for a cost of 6.'
      },
      {
        term: 'A direct edge needs a callee the optimiser can name',
        plain: 'A call through a value it cannot trace is an indirect edge.',
        formal: 'and the two must be counted separately',
        detail: 'A whole-program pass that treats them as one assumes it has seen every caller, ' +
          'which is exactly the assumption that makes devirtualisation unsound — the failure ' +
          'appears only when the other implementation is loaded. Keeping the two columns apart ' +
          'costs nothing and is what stops the assumption being made silently.',
        example: 'A higher-order function reports two indirect calls inside itself and one ' +
          'direct call at its use site.'
      },
      {
        term: 'SSA hides direct calls behind copies',
        plain: 'The register a call names is a copy of the closure, not the closure.',
        formal: 'so a call graph built without following move chains has no edges at all',
        detail: 'Renaming turns every read of a local into a copy, so after construction the ' +
          'callee register is several moves away from the allocation. A call graph that does ' +
          'not follow them reports every call as indirect — an inliner with nothing to do, no ' +
          'error message, and a plausible-looking zero in the report. It is three lines to ' +
          'follow the chain and impossible to notice without checking.',
        example: 'A program with two direct calls reported zero until the call graph followed ' +
          'copies.'
      },
      {
        term: 'An allocation escapes if some path lets it outlive the frame',
        plain: 'Returned, stored, captured, or passed to a call.',
        formal: 'anything else can live on the stack, costing no collector',
        detail: 'In a language with closures the question is mostly whether the value is ' +
          'captured, which M28\'s resolver already recorded — and this recomputes it over the ' +
          'IR anyway, because after inlining the tree those captures were recorded from no ' +
          'longer exists. That is a general pattern: a fact computed in the front end has to ' +
          'be recomputed once the middle end starts moving code.',
        example: 'Three of five allocations in one program can live on the stack; one is ' +
          'returned and one is passed to a call.'
      },
      {
        term: 'Passed to a call is the conservative rule',
        plain: 'A callee that only reads its argument does not make it escape.',
        formal: 'proving that needs an interprocedural summary this analysis does not compute',
        detail: 'So the rule costs real precision, and reporting the reason per allocation is ' +
          'what makes the imprecision visible instead of leaving a number nobody can explain. ' +
          'A verdict alone would report two escapes and give no way to tell which is real — ' +
          'and the difference matters, because one of them could be recovered by more analysis ' +
          'and the other could not.',
        example: 'A record passed to a function that only reads a field is reported as escaping ' +
          'with the reason "passed to a call, which this analysis cannot see into".'
      },
      {
        term: 'Recursive edges are excluded rather than depth-limited',
        plain: 'Inlining a cycle without a limit does not terminate.',
        formal: 'and a depth limit is a second number to tune',
        detail: 'Real compilers do inline recursive calls to a bounded depth, and the bound is ' +
          'another benchmark-suite decision rather than a principle. Excluding them outright ' +
          'here keeps the heuristic to one number, and reporting the count of excluded edges ' +
          'is what stops the simplification from looking like an oversight.',
        example: 'A self-recursive function is detected as a cycle in the call graph and never ' +
          'appears as a candidate.'
      },
      {
        term: 'A tail call can reuse its frame',
        plain: 'A call whose result is returned immediately.',
        formal: 'a two-instruction pattern to recognise; a calling convention to perform',
        detail: 'Recognising it is easy and performing it needs the convention M30 defines, so ' +
          'this reports the sites. The transformation is what makes deep recursion viable in a ' +
          'language that guarantees it, and its absence is why recursion depth is a practical ' +
          'limit in languages that do not — which is a language-design consequence rather than ' +
          'an implementation detail.',
        example: 'A function whose body is a single call to another reports one tail-call site.'
      }
    ],

    'alias-analysis': [
      {
        term: 'Memory breaks SSA',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a register: exactly<br/>one definition"] --> B["the definition is a pointer —<br/>no search needed"]',
            '    C["a heap location: any store<br/>through any pointer<br/>might have written it"] --> D["the definition is a QUESTION"]',
            '    D --> E["and answering it is<br/>what alias analysis is for"]'
          ].join('\n'),
          caption: 'SSA gives the optimiser exact information about registers and says nothing about memory, which is why the heap is where the imprecision in every compiler lives.'
        },
        plain: 'A register has one definition; a heap location does not.',
        formal: 'so a load after a store is only the old value if the pointers cannot be equal',
        detail: 'That question is alias analysis, and every load and store elimination in a ' +
          'real compiler is gated on it. It is also the reason SSA construction promotes as ' +
          'many locals as it can: everything moved into a register is out of the gap, and ' +
          'everything left in it needs an analysis that is expensive and imprecise.',
        example: 'A field loaded twice with no store between is redundant only if nothing ' +
          'between may write it.'
      },
      {
        term: 'Points-to turns a heap question into a program-text one',
        plain: 'Ask what each pointer can point at, from a finite set of allocation sites.',
        formal: 'two pointers may alias when their sets overlap',
        detail: 'The heap is unbounded and the set of allocation sites in a program is not, so ' +
          'this is the move that makes the problem tractable at all. It also bounds the ' +
          'precision available: two objects from the same site are indistinguishable, which is ' +
          'why a loop allocating in its body defeats the analysis however precise the rest of ' +
          'it is.',
        example: 'A program with two record literals has two sites, and every pointer\'s set is ' +
          'a subset of those two.'
      },
      {
        term: 'Andersen is inclusion-based and directional',
        plain: 'Assigning q to p means everything q points at, p also points at.',
        formal: 'a subset constraint, solved to a fixpoint; cubic in the worst case',
        detail: 'The direction is where the precision comes from: teaching p about q\'s targets ' +
          'does not teach q about p\'s. That asymmetry is exactly what a program\'s assignments ' +
          'mean, so the analysis is faithful to them — and the price is a constraint graph ' +
          'whose closure is expensive on a large program, which is why it is rarely what a ' +
          'production compiler runs whole-program.',
        example: 'After a merge, the merged pointer points at both sites and each original ' +
          'still points at one.'
      },
      {
        term: 'Steensgaard is unification-based and symmetric',
        plain: 'Assigning q to p merges their classes, permanently and in both directions.',
        formal: 'almost linear, and coarser in a way one example makes obvious',
        detail: 'The merge is not an approximation of the subset relation, it is a different ' +
          'relation. One assignment between two unrelated pointers makes them alias forever, ' +
          'along with everything already merged with either. That is why the two analyses are ' +
          'best compared by running both and counting, rather than described — the description ' +
          'invites "approximately as good", which is wrong.',
        example: 'On the same merge, all three pointers become one class and every pair among ' +
          'them may alias: 28 pairs against 22.'
      },
      {
        term: 'Soundness is the property that matters',
        plain: 'Every alias that really happens must be reported.',
        formal: 'reporting more is imprecision; reporting fewer is unsoundness',
        detail: 'Only one of those is survivable. An analysis that is precise and unsound is ' +
          'worse than useless because every pass downstream trusts it, and the resulting ' +
          'miscompilation appears only on the input where the missed alias occurred. That is ' +
          'why the check here is a dynamic oracle rather than a second static analysis: it ' +
          'records what actually happened.',
        example: 'Sixteen aliases occurred on one run; Andersen reports 22 and Steensgaard 28, ' +
          'and neither misses any.'
      },
      {
        term: 'A dynamic oracle is an under-approximation, and that is right',
        plain: 'It only sees the paths this input took.',
        formal: 'so it can prove an analysis wrong and can never prove one right',
        detail: 'That asymmetry is exactly the shape a soundness check should have. A static ' +
          'analysis must be a superset of what happens on every input, and a single run gives ' +
          'a subset of what happens on one — so a pair the run observed and the analysis ' +
          'missed is a definite bug, while agreement is only evidence. Knowing which of those ' +
          'a test provides is the difference between a check and a comfort.',
        example: 'The oracle records which registers held the same object during a run, ' +
          'independently of either analysis.'
      },
      {
        term: 'Load elimination is exactly as good as the analysis behind it',
        plain: 'A load can be forwarded only if nothing between may write the location.',
        formal: 'a call clears everything, because a callee may write anything',
        detail: 'The last clause is where most of the available elimination goes, and it is ' +
          'conservative for the same reason the escape rule is: without an interprocedural ' +
          'summary the compiler has to assume the worst. That is a concrete cost of not having ' +
          'whole-program information, measurable as the number of loads that could have been ' +
          'removed and were not.',
        example: 'Two loads of the same field with no store between are one redundancy; a call ' +
          'between them makes it zero.'
      },
      {
        term: 'A language can hand the optimiser the answer',
        plain: 'Immutability, ownership and restrict each remove a question.',
        formal: 'which is a measurable return, separate from the correctness argument',
        detail: 'Alias analysis is where compilers give up first — precise whole-program ' +
          'points-to is expensive and any call across a module boundary forces the worst ' +
          'assumption — so what improves generated code is usually not a better analysis but a ' +
          'better input. Berugo gets one such property for free: it has no way to take the ' +
          'address of a local, so every local is promotable.',
        example: 'A unique reference cannot alias anything else by construction, so no ' +
          'analysis has to prove it.'
      }
    ],

    'verifying-the-optimiser': [
      {
        term: 'Three gates, and each catches something different',
        plain: 'The verifier, the SSA check and the differential run.',
        formal: 'run after every pass, not at the end of the pipeline',
        detail: 'Running them at the end tells you the pipeline is broken; running them per ' +
          'pass tells you which pass and which invariant. The cost is one walk and one ' +
          'execution per pass, and it is repaid the first time a pipeline of eleven passes ' +
          'produces a wrong answer — because the alternative is bisecting by hand while ' +
          'reading IR you have to judge by eye.',
        example: 'Six passes over seventeen programs, gated after each, with the failing pass ' +
          'named when one fails.'
      },
      {
        term: 'A verifier cannot see the failure that matters most',
        plain: 'A pass can produce perfectly valid IR that computes the wrong thing.',
        formal: 'no structural check will ever notice',
        detail: 'That is why the differential comparison is a gate rather than a test-suite ' +
          'entry, and why the coverage table is worth reading down its columns: the verifier ' +
          'has nothing to say about four of the six passes, the SSA check covers the ones that ' +
          'MOVE definitions, and only the differential run has an entry in every row.',
        example: 'Naive LICM produces IR that verifies and passes the SSA check, and divides ' +
          'by zero.'
      },
      {
        term: 'A fuzzer is bounded by its generator',
        plain: 'It finds only the shapes its grammar can express.',
        formal: 'four hundred generated programs find nothing under a deliberately broken pass',
        detail: 'The generator here cannot write a division guarded by its own loop condition, ' +
          'which is the shape naive LICM breaks — so the broken pipeline survives the sweep and ' +
          'is caught only by a seeded program. Admitting that is the honest version of the ' +
          'claim, and it is the same lesson as the blind-spot table: coverage is a property of ' +
          'the generator, not of the number of programs.',
        example: 'Zero failures over four hundred generated programs, beside a seeded failure ' +
          'the sweep cannot reach.'
      },
      {
        term: 'A generator that emits invalid programs reports false miscompilations',
        plain: 'An unbound name makes the optimised run fault where the unoptimised one did not.',
        formal: 'the middle end is innocent and the report says otherwise',
        detail: 'This generator leaked a loop variable into the enclosing scope, so later ' +
          'statements referenced a name Berugo scopes to the body. The program did not resolve, ' +
          'the lowering turned the name into a global constant, and the runs diverged — ' +
          'reported as a miscompilation with a plausible-looking failing pass. A fuzzer must ' +
          'emit programs the language accepts before it can say anything about the compiler.',
        example: 'Three failures in four hundred programs, all of them the generator\'s fault, ' +
          'and none after the scoping was fixed.'
      },
      {
        term: 'A shrinker turns a found bug into a fixed one',
        plain: 'The program that exposes a miscompilation is unreadable noise.',
        formal: 'reduce while the failure persists',
        detail: 'A compiler team receiving a two-hundred-line generated program has to do the ' +
          'reduction before they can begin, so in practice the report sits. This is the step ' +
          'people skip because the bug is already found and the work feels like tooling — and ' +
          'it is the step that decides whether the campaign produces fixes or a backlog.',
        example: 'A fifteen-line failure reduced to six lines and 237 characters to 71, in ' +
          'eleven rounds trying fifty-one candidates.'
      },
      {
        term: 'A shrinker must keep the failure the same failure',
        plain: 'A candidate that fails differently has replaced the bug.',
        formal: 'compare the failing pass and the kind of failure, not merely that it failed',
        detail: 'Otherwise the minimal program exhibits something nobody was investigating, and ' +
          'the reduction has quietly changed the subject. It is one comparison and it is what ' +
          'separates a reduction anybody trusts from one that has to be checked by hand — at ' +
          'which point the shrinker has saved nothing.',
        example: 'Every accepted candidate still fails at the same pass with the same kind of ' +
          'failure.'
      },
      {
        term: 'A shrinker must keep the program valid',
        plain: 'A minimal repro that does not compile is dismissed in one line.',
        formal: 'and correctly, because a report about undefined behaviour is not a bug report',
        detail: 'Without a validity gate the reducer happily deletes the declaration of a ' +
          'variable the loop still uses, because the failure persists — the failure is in the ' +
          'optimiser and does not care whether the name resolves. The result is a program that ' +
          'proves nothing. One resolution per candidate closes it, and this is the mistake ' +
          'that makes shrinkers untrusted.',
        example: 'A reduction that had removed a let declaration was rejected once every ' +
          'candidate had to parse and resolve.'
      },
      {
        term: 'A greedy shrinker must recompute after every acceptance',
        plain: 'Continuing through a stale candidate list undoes its own progress.',
        formal: 'a later candidate is the OLD program with one change',
        detail: 'Accepting it silently reverts the acceptance before it, so the reducer makes ' +
          'progress and throws it away — while the accepted-candidate count keeps rising, ' +
          'which makes it look like it is working. The first version of this shrinker reduced ' +
          'twenty-four lines to twenty-four and reported hundreds of acceptances.',
        example: 'Taking the first candidate that still fails and recomputing the list reduced ' +
          'the same program to four lines in nineteen milliseconds.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
