/** Concepts for scheduling, WebAssembly and the JIT (M30.5-M30.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'machine-scheduling': [
      {
        term: 'A stall is a cycle spent waiting',
        plain: 'Results arrive late, and an instruction that needs one too soon has to wait.',
        formal: 'a consumer issues no earlier than its producer plus that producer\'s latency',
        detail: 'A processor issues instructions in order and each result takes a fixed number ' +
          'of cycles to become readable. If the next instruction wants a value that has not ' +
          'arrived, the pipeline holds, and those held cycles are pure loss. Scheduling is ' +
          'reordering the block so something useful happens in the gap, which is only possible ' +
          'because most blocks contain work that does not depend on the value being waited for.',
        example: 'The loads fixture spends 16 of its 34 cycles waiting, and the schedule takes ' +
          'that to 14 of 32.'
      },
      {
        term: 'The dependence DAG',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["instruction A produces a value"] --> B["instruction B consumes it"]',
            '    B --> C["so B must come after A"]',
            '    C --> D["and the edge carries a weight:<br/>how many cycles A\'s result<br/>takes to arrive"]',
            '    D --> E["scheduling is a topological order<br/>that minimises the waiting"]'
          ].join('\n'),
          caption: 'Program order is one valid schedule among many. The DAG says which orders are legal, and the weights say which of those legal orders is fast.'
        },
        plain: 'Which instructions must come after which, with a weight for how long each takes.',
        formal: 'an edge from producer to consumer, weighted by the producer\'s latency',
        detail: 'A legal reordering is any topological order of this graph, so the DAG is the ' +
          'complete statement of what the scheduler may not do. Building it is where the ' +
          'conservatism lives: a true edge follows a value, but a memory edge and an effect ' +
          'edge follow assumptions, and both exist because the scheduler has no alias ' +
          'information. Removing them would need the analysis M29.9 built, and assuming them ' +
          'away miscompiles.',
        example: 'The loads fixture has 18 instructions and 28 dependence edges, most of them ' +
          'ordering constraints on memory rather than on values.'
      },
      {
        term: 'The critical path is the priority',
        plain: 'Issue the ready instruction with the most work waiting behind it.',
        formal: 'height of a node is its latency plus the largest height among its successors',
        detail: 'List scheduling is greedy, so the whole quality of the result is in the choice ' +
          'of which ready instruction to take. The standard answer is the one whose ' +
          'latency-weighted path to the end of the block is longest, because everything on ' +
          'that path is waiting for it and delaying it delays the block. Choosing by source ' +
          'order instead produces a legal schedule and a worse one, which the demo makes a ' +
          'switch.',
        example: 'On the loads fixture the deepest instruction has a height of 32, which is the ' +
          'length of the whole block in cycles.'
      },
      {
        term: 'A load is the expensive one',
        plain: 'Arithmetic is a cycle or two, a cache hit is a handful, a miss is hundreds.',
        formal: 'latency of a load dominates every other latency in the model',
        detail: 'That asymmetry is why every instruction scheduler is mostly a load scheduler: ' +
          'hoisting a load early so its result has arrived by the time anything wants it is ' +
          'most of what the pass buys. It is also why the same pass matters far more on a ' +
          'machine with slow memory than on one with fast memory, and why the aggressiveness ' +
          'is tuned per target rather than fixed.',
        example: 'Sweeping the load latency from 1 to 16 takes the scheduled block from 23 ' +
          'cycles to 68 while the number of instructions never changes.'
      },
      {
        term: 'Scheduling raises register pressure',
        plain: 'A value moved earlier is live for longer, and longer lives interfere more.',
        formal: 'peak pressure is the largest number of values live at any point of the order',
        detail: 'This is the cost side and it is easy to leave out of a report. Hoisting a load ' +
          'extends its result\'s live range across everything the scheduler put in the gap, so ' +
          'the allocator in 30.4 is handed a higher peak. Past the register count that becomes ' +
          'a spill, a spill is a store and a load, and the pass has then bought stall cycles ' +
          'with memory traffic — sometimes at a loss.',
        example: 'The loads fixture removes 2 stall cycles and raises the peak from 2 live ' +
          'values to 3.'
      },
      {
        term: 'The two passes fight',
        plain: 'Schedule first and the allocator suffers; allocate first and the scheduler does.',
        formal: 'neither ordering dominates, so real compilers do both and then schedule again',
        detail: 'Scheduling before allocation hands the allocator higher pressure. Allocating ' +
          'before scheduling hands the scheduler false dependences through reused registers, ' +
          'because two unrelated values now share a name. There is no way to decide locally: ' +
          'the scheduler cannot see the spill it will cause and the allocator cannot see the ' +
          'stall it would have removed, which is why the usual answer is to schedule, ' +
          'allocate, then schedule the spill code.',
        example: 'M29.6 measured 3 of 5 fixtures giving different code under two pass orders; ' +
          'this is the same problem at the machine level.'
      },
      {
        term: 'Legality is checkable and worth checking',
        plain: 'A schedule is correct exactly when every dependence edge still points forwards.',
        formal: 'for every edge, the source appears before the target in the new order',
        detail: 'That is one loop over the edges and it is the difference between a scheduler ' +
          'and a shuffler. A reordering that violates one edge produces a program that reads a ' +
          'value before it is computed, which on a real machine is whatever was in the ' +
          'register — a wrong answer that depends on what ran previously, and therefore one ' +
          'that reproduces only sometimes.',
        example: 'Across the fixture set every scheduled block is checked and 0 violate a ' +
          'dependence.'
      },
      {
        term: 'Block layout is scheduling at a larger grain',
        plain: 'Put the likely successor of a branch immediately after it.',
        formal: 'lay out the hot path contiguously so the common branch is not taken',
        detail: 'A not-taken branch costs less than a taken one and keeps the instruction ' +
          'cache full of code that will run, so arranging blocks by likelihood is worth real ' +
          'time on a large program. It needs a profile to know which successor is likely, ' +
          'which is why profile-guided optimisation appears both here and in the JIT: the same ' +
          'information answers a layout question and a speculation question.',
        example: 'The scheduler here works within a block; the layout question is between them, ' +
          'and both need the profile the JIT collects in 30.7.'
      }
    ],

    'targeting-webassembly': [
      {
        term: 'A module is bytes with a fixed section order',
        plain: 'A magic number, a version, then types, functions, globals, exports and code.',
        formal: 'each section is an id, a byte length, and a vector of entries',
        detail: 'There is nothing to interpret about the format: every integer is LEB128, ' +
          'every float is eight little-endian bytes, and every vector is a count followed by ' +
          'its elements. That regularity is what lets a validator make one pass and decide ' +
          'whether the module is well formed, which is the property the whole design is ' +
          'arranged around — a browser has to accept code from strangers.',
        example: 'The loop fixture compiles to 237 bytes across 5 sections, of which 168 are ' +
          'the code.'
      },
      {
        term: 'wasm has no jumps',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a CFG has arbitrary edges"] --> B["wasm has nested blocks<br/>and loops"]',
            '    B --> C["a branch targets an<br/>ENCLOSING label only"]',
            '    C --> D["so arbitrary control flow has to be<br/>restructured before it can be emitted"]',
            '    D --> E["which is a real pass,<br/>not a formatting detail"]'
          ].join('\n'),
          caption: 'Structured control flow is what makes wasm verifiable in one pass. The cost lands on the compiler, which must turn a graph back into nested blocks.'
        },
        plain: 'Control flow is nested blocks and loops, with a branch to an enclosing label.',
        formal: 'br N leaves the Nth enclosing construct; there is no branch to an arbitrary address',
        detail: 'That single restriction is what makes a module cheap to validate and cheap to ' +
          'compile, because the control-flow graph is recoverable from the syntax. It is also ' +
          'why a compiler targeting wasm has to undo the work of every earlier phase: the ' +
          'front end built a graph, the optimiser reasoned about paths, and the back end has ' +
          'to turn the graph back into structure before it can emit anything.',
        example: 'The loop fixture becomes 1 loop and 3 blocks emitted inline, all read off the ' +
          'dominator tree.'
      },
      {
        term: 'The stackifier reads its answer off the dominator tree',
        plain: 'Back-edge targets become loops, merge points become blocks, everything else is inline.',
        formal: 'a block with several predecessors opens at its immediate dominator and closes before it',
        detail: 'Two boolean questions per block decide the whole nesting: is it the target of ' +
          'a back edge, and does it have more than one predecessor. Anything else is emitted ' +
          'where its dominator left off, because its source dominates it and there is no other ' +
          'way in. That is Ramsey\'s recursive translation, and it is why M29.3 had to build ' +
          'the dominator tree before this section could exist.',
        example: 'The 4 blocks of the loop fixture answer those two questions and produce one ' +
          'loop, with 3 of them emitted inline.'
      },
      {
        term: 'An irreducible graph has no structured form',
        plain: 'A loop with two entries cannot be written as nested blocks at all.',
        formal: 'refuse it rather than emitting a module that fails validation somewhere else',
        detail: 'M29 measured that no Berugo program produces an irreducible graph and ' +
          'reported it as a curiosity. Here the same fact is load-bearing: reducible means the ' +
          'stackifier always succeeds and irreducible means there is nothing to emit. Real ' +
          'compilers from languages with unrestricted jumps either duplicate blocks until the ' +
          'graph becomes reducible, which can grow the code badly, or emit a dispatch loop, ' +
          'which defeats the engine on the hottest code in the program.',
        example: 'The hand-built irreducible graph from M29.2 is the shape this compiler ' +
          'refuses, and 0 conformance programs produce one.'
      },
      {
        term: 'A subset stated is not a subset hidden',
        plain: 'Say which programs compile and why the rest do not.',
        formal: 'report a reason per program point rather than a verdict per program',
        detail: 'This back end handles the numeric part of the language, because everything in ' +
          'a wasm module is a number and a record, an array, a string or a closure over ' +
          'captured values needs a heap. Reporting which programs are outside and why is what ' +
          'makes the agreement column mean anything — a compiler that silently skipped the ' +
          'hard programs would show a perfect score and have demonstrated nothing.',
        example: '8 of 17 conformance programs are in the subset and all 8 agree; the other 9 ' +
          'each carry the reason they are not.'
      },
      {
        term: 'Erasing types costs the observables',
        plain: 'If everything is a number, a Bool comes back as 1 and a polymorphic result comes back as nothing.',
        formal: 'each reported binding needs a type the encoding can print back',
        detail: 'A Bool survives if the compiler carries its declared type across, and a value ' +
          'whose type the checker could not pin down does not survive at all, because there is ' +
          'nothing to print it as. That is the honest edge of a machine-type lowering, and it ' +
          'is why a real wasm back end for a dynamic language either boxes every value with a ' +
          'tag or specialises the code per call site.',
        example: 'The polymorphic fixture is outside the subset for exactly this reason: one of ' +
          'its bindings has no single numeric type.'
      },
      {
        term: 'Semantics that differ have to be reconciled',
        plain: 'Berugo faults on a division by zero; wasm produces an infinity.',
        formal: 'guard the divisor and trap, at the cost of five instructions per division',
        detail: 'A target rarely matches a language exactly, and every mismatch is either a ' +
          'wrong answer or a tax. Here the tax is a comparison and a conditional trap on every ' +
          'division, emitted whether or not the divisor could be zero, because proving it ' +
          'could not needs an analysis this back end does not run. That is the general shape ' +
          'of the problem: languages pay for the semantics their target does not share.',
        example: 'The division fixture traps in wasm and faults in the interpreter, and both ' +
          'report the same 3 partial bindings.'
      },
      {
        term: 'The observable has to be reachable from the host',
        plain: 'Export the top-level bindings as globals and read them after the call.',
        formal: 'a mutable global per slot, exported, read back once main returns',
        detail: 'A compiled module is a black box unless something inside it is visible, and ' +
          'the comparison against the interpreter is on the top-level bindings. Making them ' +
          'exported globals means the host reads exactly the values the interpreter reports, ' +
          'with no translation step to get wrong — and it keeps working after a trap, which is ' +
          'how a faulting program reports the same partial state both ways.',
        example: 'The loop fixture exports 3 globals and the host reads both bindings back to ' +
          'compare them against the interpreter.'
      }
    ],

    'jit-compilation': [
      {
        term: 'Compiling costs time the program is not running',
        plain: 'So compile only what is hot, and decide hot by counting.',
        formal: 'a counter per function on entries and on loop back edges, with a threshold',
        detail: 'Every millisecond in the compiler is a millisecond the user waits, so a JIT ' +
          'starts by interpreting and compiles only what has proved it will run again. The ' +
          'counters are the whole policy and there is no right threshold: too low and the ' +
          'runtime compiles functions that never repay it, too high and the hot loop is ' +
          'interpreted for longer than it needed to be.',
        example: 'Sweeping the threshold from 5 to 200 takes the share of the run that happens ' +
          'in compiled code from 96.2% to 0%.'
      },
      {
        term: 'Tiering',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a fast compiler"] --> B["starts running almost immediately,<br/>produces mediocre code"]',
            '    C["a good compiler"] --> D["produces excellent code,<br/>after a delay"]',
            '    B --> E["use it for everything"]',
            '    D --> F["use it only for what<br/>proved to be hot"]',
            '    E --> G["and promote between them<br/>by counting"]',
            '    F --> G'
          ].join('\n'),
          caption: 'No single compiler can be both quick to start and quick at the end, so the design is to have both and let measurement decide which code gets which.'
        },
        plain: 'One compiler cannot be both quick to run and quick to produce, so have two.',
        formal: 'a baseline tier that assumes nothing and an optimising tier that speculates',
        detail: 'The baseline compiles in one pass and makes no assumptions, so it is nearly ' +
          'free and can never be wrong. The optimising tier is slower and speculates on what ' +
          'the profile saw. Most functions never leave the first, a few reach the second, and ' +
          'the counters are what sorts them — which also means the profile has to exist before ' +
          'the second tier can, so warm-up is structural rather than accidental.',
        example: 'The hot fixture reaches the optimising tier after 2 compilations and 4 ' +
          'transitions, both entered through a loop back edge.'
      },
      {
        term: 'A profile records what a site actually saw',
        plain: 'One kind of operand at a site means it can be specialised; several means it cannot.',
        formal: 'a site is monomorphic when every observation has been the same kind',
        detail: 'The profile is the evidence, and it is evidence rather than proof: a site that ' +
          'has only ever seen numbers may see a string on the next call. What makes it usable ' +
          'is that speculation is guarded — the compiler emits the fast path plus a check, and ' +
          'the check is what turns an unsound assumption into a safe one. A site that has seen ' +
          'two kinds is worth far less than half a site that has seen one.',
        example: 'The hot fixture profiles 4 sites, all 4 monomorphic on numbers, and each ' +
          'becomes a guarded fast path.'
      },
      {
        term: 'Speculation with guards',
        plain: 'Emit the fast path the profile suggests, behind a check that it still applies.',
        formal: 'if the operands are not what was assumed, leave the compiled code',
        detail: 'The fast path for adding two numbers is a machine addition rather than a ' +
          'dispatch through an arithmetic table, and it is only correct while both operands ' +
          'really are numbers. The guard is one comparison and it is what the whole approach ' +
          'rests on: without it the compiler would be assuming something it cannot prove, and ' +
          'with it the assumption is free to be wrong.',
        example: 'The hot fixture emits 4 guarded fast paths and every guard holds for the ' +
          'whole run.'
      },
      {
        term: 'Deoptimisation, and the rule that makes it safe',
        plain: 'A failed guard returns to the interpreter at the same instruction.',
        formal: 'check the guard before the instruction has changed anything, then rewind the program counter',
        detail: 'The frame is the same object either way, so the transfer is simply switching ' +
          'which code drives it. What makes it correct is ordering: the guard runs before the ' +
          'operands are consumed, so rewinding lands on an instruction that has not started. ' +
          'Get that wrong — pop first, check second — and a deopt resumes something half-done, ' +
          'which is a miscompilation that only fires on the rare input the guard rejects.',
        example: 'The deopt fixture speculates on numbers 300 times, is called with two ' +
          'strings, deoptimises 1 time, and still computes the same answer.'
      },
      {
        term: 'On-stack replacement',
        plain: 'A program in one long loop never re-enters anything, so compile at the back edge.',
        formal: 'transfer the executing frame into compiled code without waiting for a call',
        detail: 'An entry counter never crosses for a function that is called once and then ' +
          'loops a million times, so the hottest code in the program would stay interpreted ' +
          'forever. Counting back edges and transferring the running frame fixes it. Here that ' +
          'is nearly free because the compiled code operates on the same frame object; on a ' +
          'real machine it means reconstructing a compiled frame from an interpreter one, ' +
          'which needs the same metadata deoptimisation does.',
        example: 'Both compilations of the hot fixture are entered through a back edge, because ' +
          'the top level is entered exactly once.'
      },
      {
        term: 'A function that deoptimises repeatedly stops being speculated on',
        plain: 'Otherwise it recompiles and falls back forever, getting slower as it runs.',
        formal: 'after a small number of deoptimisations, stop emitting guards for that function',
        detail: 'A genuinely polymorphic function will fail its guard on every pass through the ' +
          'loop, and each failure costs a fall back plus a recompilation. Without a rule to ' +
          'stop, the runtime pays that repeatedly and ends up slower than the interpreter it ' +
          'was trying to beat. Every production engine has some form of this blacklist, and ' +
          'the symptom of not having one is a program that degrades the longer it runs.',
        example: 'The threshold here is 2 deoptimisations from one function, after which it is ' +
          'compiled without speculation.'
      },
      {
        term: 'The JIT has to compute what the interpreter computes',
        plain: 'Run it with every tier and with none, and compare the results.',
        formal: 'compare value, output, outcome and every binding against a never-compiled run',
        detail: 'Speculation is the one place in a compiler where the code deliberately assumes ' +
          'something unproven, so it is the place most in need of a differential gate. ' +
          'Reporting the deoptimisation count beside the agreement is what stops that gate ' +
          'passing vacuously: an agreement with zero guards emitted has demonstrated that ' +
          'nothing was speculated on, not that the speculation was right.',
        example: '17 of 17 conformance programs agree between the JIT and a run with every ' +
          'tier disabled.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
