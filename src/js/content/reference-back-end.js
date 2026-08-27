/** Reference entries for bytecode, the VM, selection and allocation (M30.1-M30.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'bytecode-design': {
      summary: 'Two code generators over one IR — a stack set and a register set — with a ' +
        'constant pool, two encodings, superinstruction analysis, and a differential run ' +
        'against the reference interpreter beside every count.',
      intuition: 'A stack instruction is small and there are many; a register instruction is ' +
        'larger and there are few, and which wins is decided by what a trip through the ' +
        'interpreter loop costs rather than by what a byte costs.',
      formulation: {
        equations: [
          {
            label: 'The conformance suite, both sets',
            expr: 'measure · stack · register',
            terms: [
              { sym: 'instructions', meaning: '383 · 262 — 1.46 times' },
              { sym: 'dispatches', meaning: '503 · 319 — 1.58 times' },
              { sym: 'agreement with the IR interpreter', meaning: '17 of 17 · 17 of 17' },
              { sym: 'the loop sample alone', meaning: '74 · 43 instructions, 244 · 125 dispatches' }
            ]
          },
          {
            label: 'What one missing peephole is worth',
            expr: 'setting · stack instructions',
            terms: [
              { sym: 'values kept on the stack', meaning: '383' },
              { sym: 'every value stored and reloaded', meaning: '517, which is 35 per cent more' },
              { sym: 'the register set, for comparison', meaning: '262' },
              { sym: 'the honest ratio', meaning: '1.46, not 1.97' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every non-parameter register is defined and used inside one block',
          why: 'The virtual register allocator recycles at each value\'s last use in the block, which is only sound if nothing reads it later.',
          breaks: 'The compiler refuses to compile a function where it does not hold, naming the register that crosses.'
        },
        {
          name: 'A call\'s arguments occupy consecutive registers',
          why: 'The register calling convention names a base and a count, so the generator has to move each argument into place.',
          breaks: 'Scratch registers live in a region strictly above the permanent ones and are dropped after each IR instruction.'
        },
        {
          name: 'Both instruction sets compute what the IR interpreter computed',
          why: 'Instruction count, encoded size and dispatch count all improve when a generator emits too little.',
          breaks: 'The suite reports agreement per program, and a NO makes the other five columns unreadable.'
        }
      ],
      complexity: [
        { operation: 'stack code generation', average: 'O(instructions) plus one peephole pass per block', worst: 'O(instructions)' },
        { operation: 'register allocation within a block', average: 'O(instructions) with a free list', worst: 'O(instructions)' },
        { operation: 'encoding', average: 'O(instructions) for either width', worst: 'plus the constant pool' },
        { operation: 'superinstruction analysis', average: 'O(instructions) to count adjacent pairs', worst: 'O(pairs log pairs) to rank them' }
      ],
      failureModes: [
        {
          symptom: 'A call invokes its own first argument.',
          cause: 'A scratch register holding the callee was released before the arguments were laid out, so the first argument reused it.',
          fix: 'Keep scratch registers in a region above the permanent ones and drop them only after the whole instruction is emitted.'
        },
        {
          symptom: 'The stack set looks twice the size of the register set.',
          cause: 'The generator stores every value into a scratch slot and loads it straight back.',
          fix: 'Leave a value on the stack when its only reader is the next instruction, which is what a real generator does.'
        },
        {
          symptom: 'Every number improves and the program is wrong.',
          cause: 'A code generator that emits too little is smaller and faster by every static measure.',
          fix: 'Report the differential against the reference interpreter in the same table as the counts.'
        },
        {
          symptom: 'Encoded sizes are not comparable between two instruction sets.',
          cause: 'One of them inlines literals the other interns, so the difference is the pool rather than the design.',
          fix: 'Deduplicate constants in both and count the pool in the total.'
        }
      ],
      inTheWild: [
        'The JVM, a stack bytecode whose static stack shape is what makes its verifier possible.',
        'CPython, a stack bytecode on fixed 16-bit pairs since 3.6, with adaptive specialisation layered on since 3.11.',
        'Lua 5.0, whose move from a stack to a register bytecode is the canonical measurement of this trade.',
        'V8 Ignition, a register bytecode designed to be a compact input for the optimising tier rather than only to run fast.'
      ],
      sources: [
        { title: 'Nystrom — Crafting Interpreters', note: 'the bytecode VM half, and the clearest treatment of the stack design' },
        { title: 'Ierusalimschy, de Figueiredo, Celes — The implementation of Lua 5.0', note: 'why the register machine was worth the rewrite' },
        { title: 'Smith and Nair — Virtual Machines', note: 'the taxonomy of instruction-set choices and what each buys' },
        { title: 'Ertl and Gregg — The structure and performance of efficient interpreters', note: 'where the dispatch cost actually goes' }
      ]
    },

    'building-the-interpreter': {
      summary: 'A resumable step machine over an explicit frame stack, with closures, upvalues ' +
        'open and closed, a step debugger, a stack trace captured at the fault, and both ' +
        'instruction sets driven by one loop.',
      intuition: 'The interpreter is a loop and a table; writing it as a step function rather ' +
        'than a recursion is what makes the state inspectable, and every later section — ' +
        'debugging, on-stack replacement, stack maps — needs exactly that.',
      formulation: {
        equations: [
          {
            label: 'The conformance suite through the VM',
            expr: 'measure · value',
            terms: [
              { sym: 'programs agreeing with the reference', meaning: '17 of 17' },
              { sym: 'dispatches, stack set', meaning: '503' },
              { sym: 'deepest frame stack', meaning: '3, on the closure fixture' },
              { sym: 'calls delegated to the reference runtime', meaning: '9 across the suite' }
            ]
          },
          {
            label: 'Three answers to the loop-capture question',
            expr: 'strategy · what a closure holds · what a loop gives',
            terms: [
              { sym: 'by value', meaning: 'a copy · each closure sees its own value' },
              { sym: 'by reference', meaning: 'a cell pointing at the slot · every closure sees the last value' },
              { sym: 'by reference, fresh slot', meaning: 'a cell per iteration · each closure sees its own value' },
              { sym: 'Berugo', meaning: 'by value, so 0 upvalues are ever open' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The observable is identical to the reference interpreter\'s',
          why: 'A back end is correct exactly when it computes what the front end computed, so one comparison should serve both.',
          breaks: 'Value, output, outcome and every binding are compared, and the suite reports agreement per program.'
        },
        {
          name: 'A guard on a frame is checked before the frame is modified',
          why: 'Every inspection point — a breakpoint, a fault, a safepoint — has to see a frame in a state the machine could resume from.',
          breaks: 'The step function advances the program counter and then applies exactly one rule, so a frame is never half-updated.'
        },
        {
          name: 'An open upvalue is closed when its frame returns',
          why: 'A cell pointing into a dead frame is a use-after-free on any machine with a real stack.',
          breaks: 'Leaving a frame copies each open cell\'s value in and drops the pointer.'
        }
      ],
      complexity: [
        { operation: 'one dispatch', average: 'O(1) — a table lookup and one rule', worst: 'O(operands) for a call' },
        { operation: 'a call', average: 'O(arguments) to gather, plus a frame allocation', worst: 'bounded by a depth limit of 400' },
        { operation: 'a stack trace', average: 'O(frames) — a walk of the frame array', worst: 'O(frames × slots) with locals included' },
        { operation: 'stepping to instruction n', average: 'O(n) — the session is replayed from the start', worst: 'which is what makes the slider a position rather than a history' }
      ],
      failureModes: [
        {
          symptom: 'A closure reads a parameter where a capture should be.',
          cause: 'The captures were appended rather than prepended to the argument list.',
          fix: 'Fix the convention in one place and write it down; it is invisible on both sides otherwise.'
        },
        {
          symptom: 'Closures made in a loop all see the last value.',
          cause: 'By-reference capture, which is a correct implementation of a different language.',
          fix: 'Decide which semantics you want and make the frame layout match it, per iteration if necessary.'
        },
        {
          symptom: 'The error message is useful and the stack trace is empty.',
          cause: 'The frames were captured at the catch rather than at the throw.',
          fix: 'Snapshot the frame list at the fault, before anything unwinds.'
        },
        {
          symptom: 'The debugger works and on-stack replacement is impossible.',
          cause: 'The interpreter recurses, so the running state lives on the host stack.',
          fix: 'Make the machine a step function over an explicit frame stack from the start; retrofitting it is a rewrite.'
        }
      ],
      inTheWild: [
        'Lua\'s upvalue mechanism, which is where "closing an upvalue" is named and specified.',
        'JavaScript\'s `var` and `let`, which ship both answers to the loop-capture question in one language.',
        'The JVM\'s `invokedynamic` and the way HotSpot keeps interpreter frames deoptimisable.',
        'CPython\'s frame objects, which are first-class values precisely so that tracebacks and debuggers can read them.'
      ],
      sources: [
        { title: 'Nystrom — Crafting Interpreters', note: 'closures and upvalues, built up from nothing' },
        { title: 'Ierusalimschy — Programming in Lua, and the Lua 5 sources', note: 'the open and closed upvalue design' },
        { title: 'Smith and Nair — Virtual Machines', note: 'frames, calling conventions and the runtime boundary' },
        { title: 'Ertl and Gregg — The behaviour of efficient virtual machine interpreters on modern architectures', note: 'why dispatch is the cost' }
      ]
    },

    'instruction-selection': {
      summary: 'Tree tiling by dynamic programming over a data-driven cost model, checked ' +
        'against an exhaustive search of every possible cover, with a cost slider that moves ' +
        'the selection and a table that is the whole target description.',
      intuition: 'The target is a set of shapes with prices; selecting instructions is covering ' +
        'the expression with them as cheaply as possible, and keeping the prices as data is ' +
        'what makes a second target a second table rather than a second compiler.',
      formulation: {
        equations: [
          {
            label: 'The loop sample, selected',
            expr: 'measure · value',
            terms: [
              { sym: 'maximal trees', meaning: '7' },
              { sym: 'tiles in the cover', meaning: '17' },
              { sym: 'total cost', meaning: '24 cycles on the modelled target' },
              { sym: 'agreement with exhaustive search', meaning: '7 of 7, 0 disagreements' }
            ]
          },
          {
            label: 'One tile repriced',
            expr: 'multiply-add price · total cost · times chosen',
            terms: [
              { sym: '2', meaning: '22 · 1' },
              { sym: '4', meaning: '24 · 1' },
              { sym: '5', meaning: '24 · 0 — abandoned' },
              { sym: 'and the plain multiply at 1', meaning: '20 · 2 multiplies instead' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The cover is the minimum-cost one, not merely a good one',
          why: 'A tiler with a wrong recurrence returns a valid cover slightly more expensive, which reads as a target with no better option.',
          breaks: 'Every tree small enough is checked against an enumeration of all covers, and disagreements are a reported column.'
        },
        {
          name: 'Every operator the IR can emit has a tile',
          why: 'A selector that falls back for an unmatched node ships a target description with a silent hole in it.',
          breaks: 'An unmatched node throws by name, so the gap is found the first time a program uses the operator.'
        },
        {
          name: 'The cost model is read, never embedded',
          why: 'A cost written into the selector cannot be retargeted or tuned, and forks the selector at the second target.',
          breaks: 'Changing one number in the table changes the selection with nothing recompiled.'
        }
      ],
      complexity: [
        { operation: 'the dynamic-programming cover', average: 'O(nodes × tiles) with memoisation', worst: 'linear in the tree for a fixed table' },
        { operation: 'exhaustive search', average: 'exponential in the tree', worst: 'only ever run on trees below a size limit' },
        { operation: 'building the tree regions', average: 'O(instructions) — one use count per value', worst: 'a value with two readers splits the region' },
        { operation: 'a cost sweep', average: 'O(settings × nodes × tiles)', worst: 'nothing is recompiled between settings' }
      ],
      failureModes: [
        {
          symptom: 'A complex instruction is in the table and never selected.',
          cause: 'Its pattern matches one operand order and the source wrote the other.',
          fix: 'Write both rows or canonicalise the tree; the symptom is a slightly worse cost with no explanation.'
        },
        {
          symptom: 'The selector produces a valid cover that is not the cheapest.',
          cause: 'A recurrence that takes the first matching tile rather than the minimum over all of them.',
          fix: 'Check against an exhaustive cover on small trees; nothing else distinguishes the two.'
        },
        {
          symptom: 'The second target forks the selector.',
          cause: 'Target knowledge encoded as conditionals rather than as a table.',
          fix: 'Move every cost and pattern into data before the second target arrives, not after.'
        },
        {
          symptom: 'Selection looks good and the schedule is worse.',
          cause: 'A fused instruction ties two operations together and removes a reordering the scheduler wanted.',
          fix: 'Accept it as a phase-ordering trade and measure both orders rather than arguing about them.'
        }
      ],
      inTheWild: [
        'LLVM\'s TableGen, where the whole target is a description a tool compiles into a selector.',
        'GCC\'s machine description files, which are the same idea with a different syntax and thirty more years of accretion.',
        'The BURS and iburg generators, which produced optimal tilers from a grammar with costs.',
        'Cranelift\'s ISLE, a recent instruction-selection DSL built for exactly the retargeting reason.'
      ],
      sources: [
        { title: 'Aho, Ganapathi, Tjiang — Code generation using tree matching and dynamic programming', note: 'the algorithm this section implements' },
        { title: 'Fraser, Hanson, Proebsting — Engineering a simple, efficient code generator generator', note: 'iburg, and why the description is data' },
        { title: 'Cooper and Torczon — Engineering a Compiler', note: 'the instruction-selection chapter and the DAG caveat' },
        { title: 'Muchnick — Advanced Compiler Design and Implementation', note: 'selection in the context of the whole back end' }
      ]
    },

    'register-allocation': {
      summary: 'Chaitin-Briggs graph colouring and Poletto-Sarkar linear scan over the same ' +
        'post-destruction function, with conservative coalescing, real interval splitting, and ' +
        'both allocations verified at every program point against an independent liveness pass.',
      intuition: 'Two values live at once cannot share a register, so allocation is graph ' +
        'colouring — and the two algorithms differ not in what they are trying to do but in ' +
        'how much time they are allowed to spend doing it.',
      formulation: {
        equations: [
          {
            label: 'The pressure fixture at four registers',
            expr: 'allocator · points in memory · spilled intervals · splits',
            terms: [
              { sym: 'graph colouring', meaning: '13 · 2 · 0' },
              { sym: 'linear scan, splitting on', meaning: '13 · 2 · 3' },
              { sym: 'linear scan, splitting off', meaning: '15 · 3 · 0' },
              { sym: 'live ranges to place', meaning: '11, with a highest degree of 9' }
            ]
          },
          {
            label: 'Points in memory against the register count',
            expr: 'registers · colouring · linear scan',
            terms: [
              { sym: '1', meaning: '25 · 30' },
              { sym: '2', meaning: '22 · 23' },
              { sym: '4', meaning: '13 · 13' },
              { sym: '6', meaning: '0 · 1 — and 0 · 0 from 8 registers on' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'At every program point, live values hold distinct registers',
          why: 'An allocator that is subtly wrong produces code that runs, is usually right, and is occasionally not — which gets blamed on the program.',
          breaks: 'A second liveness pass the allocator did not produce is walked over every point and every clash is reported.'
        },
        {
          name: 'Coalescing is conservative',
          why: 'Merging two values raises the merged node\'s degree, and aggressive coalescing made programs spill that would otherwise have coloured.',
          breaks: 'A merge is refused when the combined neighbour set is as large as the register count.'
        },
        {
          name: 'A split truncates the first placement rather than adding a second name',
          why: 'A tail queued under an invented register is consulted by nothing, so the split counter rises and the code is unchanged.',
          breaks: 'The allocator returns placements — register, span, colour — and the verifier reads the colour at each point.'
        }
      ],
      complexity: [
        { operation: 'building the interference graph', average: 'O(points × live values squared)', worst: 'from the point sets, which is the precise definition' },
        { operation: 'simplify and select', average: 'O(nodes × degree)', worst: 'NP-complete in general, so this is a heuristic' },
        { operation: 'linear scan', average: 'O(intervals log intervals) to sort, then one pass', worst: 'plus one re-queue per split' },
        { operation: 'verification', average: 'O(points × live values)', worst: 'plus a placement lookup per live value' }
      ],
      failureModes: [
        {
          symptom: 'Interval splitting raises the spill count.',
          cause: 'A spill COUNT is not comparable across splitting, because one interval becomes two.',
          fix: 'Report points spent in memory, which is what a spill is actually paid in.'
        },
        {
          symptom: 'The split counter rises and the generated code is identical.',
          cause: 'The tail was re-queued under a register name the program never mentions, so nothing read it.',
          fix: 'Make the allocation a list of placements over spans, and have the verifier read the colour at a point.'
        },
        {
          symptom: 'Coalescing makes a function spill that used to colour.',
          cause: 'Aggressive coalescing, merging without checking the combined degree.',
          fix: 'Use Briggs\'s conservative test, or George and Appel\'s iterated coalescing.'
        },
        {
          symptom: 'An allocator with an excellent spill count produces wrong answers.',
          cause: 'Two simultaneously live values were given the same register.',
          fix: 'Verify against an independent liveness pass; no self-consistent check can find this.'
        }
      ],
      inTheWild: [
        'GCC and LLVM, which both use graph-colouring-family allocators for ahead-of-time compilation.',
        'HotSpot\'s C1 and most JavaScript engines, which use linear scan with splitting because compile time is on the critical path.',
        'LLVM\'s greedy allocator, which is linear-scan-shaped with splitting and eviction rather than a colouring.',
        'Any calling convention, which is precolouring: the argument and result registers are chosen before allocation starts.'
      ],
      sources: [
        { title: 'Chaitin — Register allocation and spilling via graph coloring (1982)', note: 'the reduction and the simplify phase' },
        { title: 'Briggs, Cooper, Torczon — Improvements to graph coloring register allocation', note: 'optimistic colouring and conservative coalescing' },
        { title: 'Poletto and Sarkar — Linear scan register allocation', note: 'the algorithm JITs use, and why' },
        { title: 'Traub, Holloway, Smith — Quality and speed in linear-scan register allocation', note: 'splitting, and how much of the gap it closes' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
