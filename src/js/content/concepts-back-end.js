/** Concepts for bytecode, the interpreter, selection and allocation (M30.1-M30.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'bytecode-design': [
      {
        term: 'Stack machine against register machine',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["stack: operands are implicit"] --> B["push, push, add —<br/>short instructions, more of them"]',
            '    C["register: operands are named"] --> D["add r3, r1, r2 —<br/>longer instructions, fewer of them"]',
            '    B --> E["more trips through<br/>the dispatch loop"]',
            '    D --> F["fewer dispatches,<br/>bigger bytecode"]'
          ].join('\n'),
          caption: 'The choice is not about elegance. It sets how many times the interpreter goes round its loop, and dispatch is what an interpreter actually spends its time on.'
        },
        plain: 'Either the operands are implicit or they are named, and everything follows.',
        formal: 'a stack instruction pops what it needs; a register instruction names its inputs and its output',
        detail: 'On a stack machine an instruction takes its operands from the top of the ' +
          'operand stack, so it carries no operand fields at all and the encoding is tiny. On ' +
          'a register machine every instruction names where it reads and where it writes, so ' +
          'it is larger and there are fewer of them, because a whole expression collapses into ' +
          'one instruction rather than a sequence of pushes. That single choice decides the ' +
          'instruction count, the encoded size, the shape of the interpreter loop and how easy ' +
          'the bytecode is to verify.',
        example: 'The same suite is 383 stack instructions against 262 register ones — 1.46x ' +
          'the count for a smaller encoding per instruction.'
      },
      {
        term: 'Dispatch, not instruction count',
        plain: 'What the interpreter pays is trips through the loop, not bytes of code.',
        formal: 'a dispatch is the switch, the operand decode and the branch back to the top',
        detail: 'Each turn of the interpreter loop reads an opcode, jumps to its handler, ' +
          'decodes the operands and branches back. On a modern processor that jump is an ' +
          'indirect branch the predictor frequently gets wrong, so a dispatch costs far more ' +
          'than the arithmetic it performs. This is why halving the number of instructions is ' +
          'worth more than halving their size, and why a register bytecode wins despite being ' +
          'bigger.',
        example: 'The same suite executes 503 stack dispatches against 319 register ones, and ' +
          'on a single hot loop the ratio is 2.00x.'
      },
      {
        term: 'A named local is a slot, a temporary is a register',
        plain: 'Values that cross a block go through memory; values inside one do not.',
        formal: 'before SSA, every non-parameter register is defined and used in one block',
        detail: 'M29 lowered the language so that anything crossing a block boundary is a ' +
          'named local, read and written with load and store. What is left in registers is ' +
          'block-local by construction, which is why a virtual register can be freed at its ' +
          'last use in the block and handed to the next value. That invariant is what makes ' +
          'this code generator\'s allocator twenty lines rather than the graph colouring of ' +
          '30.4, and it is checked rather than assumed.',
        example: 'Across the conformance suite, 138 non-parameter registers were checked and 0 ' +
          'of them were read outside the block that defined them.'
      },
      {
        term: 'A stack machine still needs scratch slots',
        plain: 'A three-address form flattened onto a stack leaves values with nowhere to sit.',
        formal: 'a value with a later reader is stored to a scratch slot and loaded back',
        detail: 'The IR is three-address, so a value computed by one instruction may be read by ' +
          'another several instructions later. On a stack machine there is no name for it, so ' +
          'the generator stores it to a per-frame scratch array and loads it back at the use. ' +
          'The one rewrite every real generator has is to skip that pair when the only reader ' +
          'is the very next instruction — which is what makes the stack expansion look ' +
          'reasonable rather than absurd.',
        example: 'Turning that rewrite off takes the loop sample from 383 instructions to 517, ' +
          'so a third of the apparent stack/register gap is one missing peephole.'
      },
      {
        term: 'The constant pool',
        plain: 'Every literal is stored once and referred to by index.',
        formal: 'intern each literal, operator name, field list and closure descriptor',
        detail: 'Instructions carry small indices instead of values, so the code stream stays ' +
          'compact and a string appearing twenty times costs one copy. Deduplicating matters ' +
          'for more than size: it makes the encoded-size comparison between two instruction ' +
          'sets meaningful, because otherwise the set that inlines more literals looks larger ' +
          'for a reason that has nothing to do with its design. The pool is also where a ' +
          'runtime puts things too big for an operand field.',
        example: 'The loop sample interns 9 constants for 74 stack instructions, and the pool ' +
          'is counted in the 204-byte encoded size.'
      },
      {
        term: 'Fixed width against variable width',
        plain: 'Pad every instruction to the widest, or spend only what each operand needs.',
        formal: 'fixed width can be indexed; variable width has to be decoded from the start',
        detail: 'A fixed encoding makes the byte at a known offset an opcode, so a jump target ' +
          'is an index and a disassembler can start anywhere. A variable encoding spends one ' +
          'byte on an operand below 128 and two above it, which is smaller and can only be ' +
          'walked forwards. Both ship in production: CPython moved to fixed 16-bit pairs and ' +
          'V8 uses variable width with prefix bytes, and neither is wrong.',
        example: 'The loop sample is 204 bytes variable-width and larger fixed-width, because ' +
          'the register set pads to four operands and mostly uses two.'
      },
      {
        term: 'Superinstructions',
        plain: 'Give the commonest adjacent pair one opcode and pay one dispatch instead of two.',
        formal: 'count adjacent pairs, fuse the top few, and the dispatch happens once',
        detail: 'It is the cheapest speed-up a bytecode VM has and it costs opcode space: each ' +
          'fused pair is another case in the switch, another entry in any dispatch table, and ' +
          'another thing a verifier has to understand. So the decision is which handful to ' +
          'fuse, and the answer comes from counting rather than from intuition — a pair that ' +
          'looks common in the source may be rare after the code generator has finished with ' +
          'it.',
        example: 'The loop sample has 20 distinct adjacent pairs, and the two commonest account ' +
          'for 18 of its 74 dispatches.'
      },
      {
        term: 'A smaller number is not automatically a better one',
        plain: 'A generator that drops an instruction wins every column except correctness.',
        formal: 'gate every measurement on a differential run against the reference',
        detail: 'Instruction count, encoded size and dispatch count all go down when the code ' +
          'generator emits too little, and none of them notices. The only column that does is ' +
          'the one comparing the program\'s result against the reference interpreter on value, ' +
          'output, outcome and every binding — which is the same gate M29 put on every ' +
          'optimisation pass, applied one representation lower.',
        example: '17 of 17 conformance programs agree with the IR interpreter under both ' +
          'instruction sets, which is what makes the other five columns readable.'
      }
    ],

    'building-the-interpreter': [
      {
        term: 'The dispatch loop',
        plain: 'Fetch, advance, look up, run — and everything else is a table.',
        formal: 'read the instruction at the program counter, then apply the rule for its opcode',
        detail: 'The loop is four lines and the instruction set is a table of handlers, which ' +
          'is what keeps a VM maintainable: adding an opcode is one entry rather than an edit ' +
          'to a switch nobody can see the end of. The interesting variation is how the jump to ' +
          'the handler is made — a switch, a table of function pointers, or computed goto, ' +
          'which gives each opcode its own copy of the branch so the predictor can learn them ' +
          'apart.',
        example: 'The whole suite runs in 503 stack dispatches or 319 register ones through one ' +
          'loop with two instruction-set tables.'
      },
      {
        term: 'An explicit frame stack',
        plain: 'Keep the frames in an array rather than on the host language stack.',
        formal: 'a call pushes a frame and a return pops it; the loop never recurses',
        detail: 'Writing the machine as a step function over an explicit stack costs nothing ' +
          'and pays for three later sections. A debugger has to stop between instructions, ' +
          'on-stack replacement has to lift a running frame into compiled code, and a stack ' +
          'map has to enumerate the frames that exist at this instant. A recursive interpreter ' +
          'keeps all of that on the host stack, where none of it can be reached or inspected.',
        example: 'The closure fixture reaches a depth of 3 frames, and each one is an object ' +
          'the demo prints rather than a host stack frame.'
      },
      {
        term: 'The calling convention',
        plain: 'Who allocates the frame, where the arguments are, where the result lands.',
        formal: 'arguments are captures then parameters; the callee allocates; the caller reserves the result',
        detail: 'None of this is discoverable from the code — it is an agreement both sides ' +
          'honour. The callee allocates because only it knows how many registers and slots it ' +
          'needs, and that number changes when it is recompiled. The result goes wherever the ' +
          'caller said, which on a register machine is a destination register recorded on the ' +
          'frame and on a stack machine is a push. Getting any of it wrong is a wrong answer ' +
          'rather than a crash.',
        example: 'A closure is called with `captures.concat(arguments)`, so one call path ' +
          'serves both a plain function and a closure over 1 captured value.'
      },
      {
        term: 'A closure is a function plus its captured values',
        plain: 'The captures travel with the function and arrive as leading parameters.',
        formal: 'makeClosure records the function and the values; a call prepends them',
        detail: 'M29 arranged the lowering so a closure\'s captures are ordinary leading ' +
          'parameters of the target function, which means the VM needs no special case for ' +
          'calling one. The consequence is that a closure is an allocation: it is the values, ' +
          'copied, in a heap object that outlives the frame that made it. That is why closures ' +
          'are the first thing a garbage collector in M31 will have to trace.',
        example: 'The counter-factory fixture allocates one closure over 1 value and calls it ' +
          'through the same path as every other function.'
      },
      {
        term: 'Upvalues, open and closed',
        plain: 'Either the closure points at the variable or it holds a copy of it.',
        formal: 'an open upvalue points at the defining frame\'s slot; closing copies the value into the cell',
        detail: 'While the defining frame is alive, a by-reference capture can point straight ' +
          'at its slot, so writes through the closure and writes through the variable are the ' +
          'same write. When that frame returns the slot is gone, so the value is copied into ' +
          'the cell and the pointer dropped — which is what Lua calls closing an upvalue. A ' +
          'runtime that forgets to close reads a dead frame, which on a machine with a real ' +
          'stack is a use-after-free.',
        example: 'Berugo captures by value, so 0 of its upvalues are ever open — and the ' +
          'demo\'s switch runs the same program the other way.'
      },
      {
        term: 'The loop-capture question is decided here',
        plain: 'Whether closures made in a loop share one variable is a frame-layout choice.',
        formal: 'point at the slot and they share it; take a copy and they do not',
        detail: 'Every language answers this and the answers disagree, which makes it look ' +
          'like a design debate. It is an implementation detail that leaked: by-reference ' +
          'capture makes every closure created in one loop see the last value, and by-value ' +
          'capture makes each see its own. JavaScript shipped both, with `var` pointing at the ' +
          'slot and `let` re-declaring the slot each iteration so the pointer is to a fresh ' +
          'one.',
        example: 'The demo lists 3 answers to that question and names the languages that chose ' +
          'each, including two that shipped inside one language.'
      },
      {
        term: 'A fault unwinds, and the frames go with it',
        plain: 'The stack trace has to be captured before the unwinding, not after.',
        formal: 'the frames that exist at the fault are the trace; a moment later they are gone',
        detail: 'An error message names what went wrong; a stack trace names where, and where ' +
          'is a property of frames that only exist at the instant of the fault. So a runtime ' +
          'that wants a usable trace captures the frame list at the throw rather than ' +
          'reconstructing it at the catch. The same walk, asked a slightly different question, ' +
          'is what a garbage collector needs for its root set in 30.9.',
        example: 'The out-of-range fixture faults 2 calls deep and the demo prints all 3 frames ' +
          'with the source line each was executing.'
      },
      {
        term: 'A debugger is the loop with a stopping condition',
        plain: 'Breakpoints are a set of program counters and a step is one turn.',
        formal: 'run until the program counter is in the breakpoint set, then stop and expose the frame',
        detail: 'Nothing about stepping requires a second implementation of anything: the ' +
          'frame is already an object, the program counter is already a field, and "inspect" ' +
          'is reading what is there. That is why a bytecode VM gets a step-debugger almost for ' +
          'free and an optimising compiler does not — the compiler has deleted the state the ' +
          'debugger wants to show, and has to reconstruct it from metadata, which is exactly ' +
          'the problem 30.7 and 30.9 are about.',
        example: 'The demo stops the machine at instruction 6 of `main` with 1 frame live and ' +
          'the operand stack printed.'
      }
    ],

    'instruction-selection': [
      {
        term: 'Selection is a covering problem',
        plain: 'Choose a set of target instructions that covers every node of the expression.',
        formal: 'each tile matches a shape and leaves holes; a cover fills every node exactly once',
        detail: 'Framing it this way is what makes it tractable. The IR is a forest of ' +
          'expression trees and the target is a set of tiles, each matching a shape at some ' +
          'cost. Selecting instructions is choosing tiles that cover the tree, and the best ' +
          'selection is the cheapest cover. Everything else in the section — dynamic ' +
          'programming, complex instructions, retargeting — is a consequence of that one ' +
          'framing.',
        example: 'The loop sample is 7 maximal trees covered by 17 tiles at a total of 24 ' +
          'cycles on the modelled target.'
      },
      {
        term: 'Dynamic programming is optimal on a tree',
        plain: 'The cheapest cover of a node is the cheapest tile plus the cheapest covers below it.',
        formal: 'cost(node) = min over matching tiles of tile cost plus the cost of each hole',
        detail: 'Memoise that recurrence on the node and the whole tree is linear in the ' +
          'number of node-and-tile pairs. It is genuinely optimal, which is unusual in a ' +
          'compiler and is the reason expression trees are cut out of the DAG first: on a DAG, ' +
          'where a value has several readers, the same problem is NP-hard and every real ' +
          'selector falls back to a heuristic.',
        example: 'All 7 trees in the sample agree with an exhaustive search of every possible ' +
          'cover, with 0 disagreements.'
      },
      {
        term: 'A tree region ends where a value has two readers',
        plain: 'A value read twice has to live in a register, so it is a leaf of both trees.',
        formal: 'a value with more than one use is a root of its own tree and a leaf of its consumers',
        detail: 'Duplicating the computation into both consumers would compute it twice, which ' +
          'is why the region stops there. The consequence is that the number of trees is not ' +
          'the number of instructions, and that a pass which removes a redundant computation ' +
          'in M29 changes the shape of this problem — common subexpressions create exactly the ' +
          'multi-use values that break trees apart.',
        example: 'The sample has 7 trees over 3 blocks, the largest being 7 nodes under 6 tiles.'
      },
      {
        term: 'A complex instruction is a bigger tile',
        plain: 'Multiply-add is a row whose pattern is deeper, not a special case.',
        formal: 'a tile covering three nodes wins when its cost is below the sum of the tiles it replaces',
        detail: 'Treating a fused operation as an ordinary table row is what keeps the selector ' +
          'general. It fires exactly when the arithmetic says it should, which means changing ' +
          'its price changes whether it is used, with no code touched. That is the whole ' +
          'argument for a data-driven cost model, and it is why the same selector can serve a ' +
          'target with a multiply-add and one without.',
        example: 'The multiply-add tile fires while it is priced at 4 or less and stops at 5, ' +
          'where two separate instructions become cheaper.'
      },
      {
        term: 'Commutativity has to be in the table',
        plain: 'The matcher compares shapes, and two shapes that mean the same thing are two rows.',
        formal: 'a plus b times c and b times c plus a are different trees',
        detail: 'A pattern matcher knows nothing about algebra, so a tile written with the ' +
          'multiply on the left will not fire on a tree with the multiply on the right. The ' +
          'two options are to write both rows or to canonicalise the tree before matching, and ' +
          'real selectors do both in different places. The failure mode is silent: the tile is ' +
          'in the table, it is never chosen, and the target looks as though it has no better ' +
          'option.',
        example: 'The table carries 2 multiply-add rows, and on this program the left-operand ' +
          'form fires 0 times while the right-operand form fires 1.'
      },
      {
        term: 'An unmatched operator is a crash, and should be',
        plain: 'A missing row is a hole in the target description, found at build time.',
        formal: 'refuse a node no tile matches rather than substituting something generic',
        detail: 'A selector that quietly falls back for an unrecognised node ships a target ' +
          'description with a gap, and the gap surfaces as a mysteriously slow instruction ' +
          'sequence somewhere. Refusing turns it into a failure at the moment a program uses ' +
          'the operator, which is when somebody can fix it. The tile table here gained a row ' +
          'for equality only when a conformance program needed one.',
        example: 'The table is 25 tiles covering every operator the IR can emit, of which 7 are ' +
          'chosen on the loop sample.'
      },
      {
        term: 'The cost model is where the target lives',
        plain: 'Cycles per tile, in a table a retarget replaces.',
        formal: 'the selector reads costs; it does not contain them',
        detail: 'Encoding target knowledge as conditionals inside the selector is shorter for ' +
          'one machine and unmaintainable for three: the second target forks the selector and ' +
          'the third makes it impossible to tell which branch belongs to which processor. ' +
          'Keeping it as data means retargeting is a new table and tuning is a changed number, ' +
          'which is why LLVM and GCC both describe their targets in a language a tool compiles.',
        example: 'Sweeping one tile\'s cost from 1 to 10 changes the selection with nothing ' +
          'recompiled, and the total moves from 22 to 24 cycles.'
      },
      {
        term: 'Selection, scheduling and allocation all want to go first',
        plain: 'Each pass constrains the next, and no order is right everywhere.',
        formal: 'a chosen complex instruction constrains the schedule; a schedule changes pressure; spilling adds instructions',
        detail: 'Choosing a fused instruction fixes two operations together and removes a ' +
          'reordering the scheduler might have wanted. Scheduling changes how long values are ' +
          'live and therefore how much the allocator has to fit. Spilling introduces loads and ' +
          'stores the selector never saw and the scheduler never scheduled. This is the same ' +
          'phase-ordering problem M29.6 measured, one representation lower and with the same ' +
          'answer: pick an order by measurement and run some passes twice.',
        example: 'M29 measured 3 of 5 fixtures giving different code under two pass orders, and ' +
          'the back end has the same property for the same reason.'
      }
    ],

    'register-allocation': [
      {
        term: 'Live ranges and interference',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["value a is live from here to here"] --> C{"do the two ranges overlap<br/>at any instruction?"}',
            '    B["value b is live from here to here"] --> C',
            '    C -->|yes| D["they interfere —<br/>they cannot share a register"]',
            '    C -->|no| E["one register can hold both,<br/>at different times"]',
            '    D --> F["draw that as a graph and the<br/>problem is graph colouring"]'
          ].join('\n'),
          caption: 'Turning register allocation into colouring is the whole reduction, and the reason it is tractable in practice is that spilling gives the colourer an escape hatch.'
        },
        plain: 'Two values live at the same moment cannot share a register.',
        formal: 'a live range runs from a definition to its last use; two overlapping ranges interfere',
        detail: 'Every value the program computes needs somewhere to sit between being ' +
          'produced and being read, and the machine has a fixed number of registers. Two ' +
          'values whose ranges overlap need two registers; two whose ranges do not can share ' +
          'one. Collecting those relations gives a graph, and allocating registers is ' +
          'colouring it — a reduction that is exact, which means the problem is NP-complete ' +
          'and every allocator is a heuristic.',
        example: 'The pressure fixture has 11 live ranges and 25 interference edges, with the ' +
          'most contended value interfering with 9 others.'
      },
      {
        term: 'Simplify and select',
        plain: 'Remove anything with fewer neighbours than there are registers, then colour backwards.',
        formal: 'a node of degree below k can always be coloured once its neighbours have been',
        detail: 'That observation is Chaitin\'s and it is the whole algorithm. Repeatedly ' +
          'remove a low-degree node and push it on a stack; when none is left, everything ' +
          'remaining is a spill candidate. Then pop the stack, giving each node a colour none ' +
          'of its neighbours took — which always succeeds for the nodes removed by the rule, ' +
          'because they had fewer neighbours than colours.',
        example: 'At 4 registers the fixture spills 2 of its 11 values; at 6 it spills none.'
      },
      {
        term: 'Optimistic colouring',
        plain: 'When stuck, push the worst node anyway and hope its neighbours share colours.',
        formal: 'Briggs: spill at the select phase, not at the simplify phase',
        detail: 'Chaitin\'s original spilled as soon as no low-degree node remained, which ' +
          'gives up quality it did not have to: a node with many neighbours often finds that ' +
          'those neighbours end up sharing a handful of colours between them, leaving one ' +
          'free. Pushing it optimistically and only spilling if the colour really is ' +
          'unavailable is a two-line change that measurably reduces spilling on real code.',
        example: 'The fixture\'s highest-degree value interferes with 9 others at 4 registers ' +
          'and is still coloured rather than spilled.'
      },
      {
        term: 'Coalescing, and why it must be conservative',
        plain: 'Remove a move by giving both ends the same register — unless that makes things worse.',
        formal: 'merge two non-interfering values connected by a move, if the merged degree stays low',
        detail: 'A move between two values that are never live together is pure overhead, and ' +
          'giving both the same register deletes it. The catch is that merging produces a node ' +
          'with the union of both neighbour sets, and a node with too many neighbours is a ' +
          'spill. Aggressive coalescing famously made programs spill that would otherwise have ' +
          'coloured, which is why Briggs\'s test refuses any merge whose combined degree is too ' +
          'high.',
        example: 'Coalescing is a switch in the demo, and the spill column is what moves when ' +
          'it is turned off on a function with 11 values.'
      },
      {
        term: 'Linear scan',
        plain: 'Sort the intervals by start, walk once, and spill the one that ends last.',
        formal: 'expire the intervals that have ended, take a free register, otherwise spill the furthest-ending',
        detail: 'No graph is built at all, which is the point: the whole allocation is one pass ' +
          'over a sorted list. Spilling the interval that ends last is the right greedy choice ' +
          'because it frees the register for the longest time. It produces worse code than ' +
          'colouring and produces it far faster, which is exactly the trade a JIT wants when ' +
          'the user is waiting for the program the allocator is compiling.',
        example: 'On the same function at 4 registers, linear scan spills 5 where colouring ' +
          'spills 2.'
      },
      {
        term: 'Interval splitting',
        plain: 'Cut a spilled interval at the point of the spill and re-queue the tail.',
        formal: 'a range flattened to one interval covers holes where the value is not live',
        detail: 'Linear scan treats a value as live for one contiguous span, which is a ' +
          'conservative approximation of a range with gaps in it. Splitting recovers most of ' +
          'the difference: the first half of a value\'s life may have no register while the ' +
          'second half does, and the only cost is a reload at the split point. It is the ' +
          'single most valuable refinement to the algorithm and is why production JITs bothered ' +
          'implementing it.',
        example: 'The demo\'s splitting switch changes the spill count on the pressure fixture, ' +
          'which reports 3 splits at 4 registers.'
      },
      {
        term: 'Precoloured ranges and the calling convention',
        plain: 'Some registers are chosen for you, and the rest are allocated around them.',
        formal: 'an argument arrives in a fixed register and a result leaves in one; those ranges start coloured',
        detail: 'A calling convention fixes where arguments and results live, so those live ' +
          'ranges are not free to be placed — they enter the allocator already assigned. ' +
          'Everything else has to fit around them, which is why a function with many arguments ' +
          'starts under pressure before it has computed anything. Caller-saved against ' +
          'callee-saved is the same constraint expressed differently: which ranges are allowed ' +
          'to survive a call.',
        example: 'The demo allocates functions with 1 to 4 parameters, and the parameter ranges ' +
          'start at position 0 and are live to their last use.'
      },
      {
        term: 'The allocation has to be verified',
        plain: 'At every point, no two live values may share a register.',
        formal: 'recompute liveness independently and check the assignment against it',
        detail: 'An allocator that is subtly wrong produces code that runs, produces the right ' +
          'answer on most inputs, and is occasionally wrong — which is the worst failure a ' +
          'compiler has, because it is attributed to the program. Checking the assignment ' +
          'against a liveness pass the allocator did not produce is one loop over the program ' +
          'points, and it is the only thing standing between a heuristic and a miscompilation.',
        example: '17 of 17 conformance programs allocate soundly under both algorithms at 4 ' +
          'registers, checked at every program point.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
