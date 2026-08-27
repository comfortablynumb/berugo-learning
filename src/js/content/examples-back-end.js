/** Worked examples for bytecode, the VM, selection and allocation (M30.1-M30.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'bytecode-design': [
      {
        title: 'Two instruction sets, one IR, and the column that decides it',
        goal: 'Turn "register bytecode is faster" into a table with two numbers in it.',
        setup: 'The same lowered IR is put through two code generators and both results are ' +
          'run, so the static size and the dynamic cost are measured on the same program.',
        steps: [
          { do: 'Read the instruction counts on the loop sample.',
            why: 'The static size, which is what a file on disk pays.',
            work: '74 stack against 43 register' },
          { do: 'Read the dispatch counts for the same run.',
            why: 'The dynamic cost, which is what the interpreter loop pays.',
            work: '244 against 125 — the register set executes 1.95× fewer' },
          { do: 'Read the encoded sizes.',
            why: 'The register set is meant to pay for its speed in bytes.',
            work: '204 bytes against 196 — it is slightly SMALLER here, not larger' },
          { do: 'Sum both columns across the whole conformance suite.',
            why: 'One program is an anecdote.',
            work: '383 against 262 instructions and 503 against 319 dispatches' },
          { do: 'Check the agreement column before believing any of it.',
            why: 'Every number falls if the generator emits too little.',
            work: '17 of 17 programs give the same answer under both sets' }
        ],
        answer: 'The register set is 1.46× fewer instructions and 1.58× fewer dispatches across ' +
          'the suite, and on a single hot loop the dispatch ratio reaches 2.00×. The size ' +
          'column is the surprise: it was supposed to be the price, and on this language the ' +
          'register encoding comes out slightly smaller, because the stack set spends so many ' +
          'instructions moving values in and out of scratch slots that its one-byte opcodes ' +
          'add up. That is exactly why the comparison is a measurement — the argument predicts ' +
          'a trade and the trade is not always there.'
      },
      {
        title: 'The peephole that decides how big the gap really is',
        goal: 'Separate the instruction set from one missing rewrite.',
        setup: 'The stack generator stores every computed value into a scratch slot and loads ' +
          'it back at the use. The one rewrite every real generator has is to skip that pair ' +
          'when the only reader is the next instruction, and the demo turns it off.',
        steps: [
          { do: 'Read the suite instruction count with the rewrite on.',
            why: 'The number a real stack generator would produce.',
            work: '383 stack instructions' },
          { do: 'Turn it off and read it again.',
            why: 'The naive expansion of a three-address form onto a stack.',
            work: '517 — 35% more, from one missing rewrite' },
          { do: 'Compare both against the register set.',
            why: 'The gap being attributed to the instruction set.',
            work: '262 register instructions, so the ratio is 1.46× or 1.97×' },
          { do: 'Say which of those two is the honest comparison.',
            why: 'The looser one flatters the conclusion.',
            work: '1.46×, because a real stack compiler has the rewrite' },
          { do: 'Count the scratch pairs the rewrite could not remove.',
            why: 'A value with two readers still needs somewhere to live.',
            work: 'the top adjacent pair on the loop sample is LOAD_TEMP+LOAD_TEMP, 10 times' }
        ],
        answer: 'A third of the apparent difference between the two instruction sets is one ' +
          'peephole, and leaving it out would have supported the conclusion more strongly ' +
          'while being wrong about why. The pairs table shows what is left: 20 distinct ' +
          'adjacent pairs on this function, of which the two commonest account for 18 of its ' +
          '74 dispatches — which is what a superinstruction would fuse, at the price of two ' +
          'more opcodes in the switch.'
      }
    ],

    'building-the-interpreter': [
      {
        title: 'A machine stopped between two instructions',
        goal: 'Look at the state a running program is made of.',
        setup: 'The VM is a step function over an explicit frame stack, so the operand stack, ' +
          'the named locals, the upvalues and the call chain are all objects rather than host ' +
          'stack frames.',
        steps: [
          { do: 'Step the closure program forward and read where it stopped.',
            why: 'The program counter is a field, not a position in a host call stack.',
            work: 'main:6, 1 frame live, 6 dispatches so far' },
          { do: 'Read the operand stack at that point.',
            why: 'On a stack machine the operands are here rather than in the instruction.',
            work: 'the pieces the next instruction will consume — 0 of them between statements' },
          { do: 'Read the deepest frame stack the same program reaches.',
            why: 'A closure call goes through the same path as any other call.',
            work: '3 frames on the closure fixture' },
          { do: 'Run the whole conformance suite and compare against the reference.',
            why: 'A VM that is fast and wrong is not a VM.',
            work: '17 of 17 agree on value, output, outcome and every binding' },
          { do: 'Read the native-call column.',
            why: 'Not every call is a frame this machine pushed.',
            work: '4 on the for program, 3 on match, 2 on modules, 0 everywhere else' }
        ],
        answer: 'Writing the machine as a step function costs nothing and makes the state ' +
          'inspectable, which is what a debugger, on-stack replacement and a stack map all ' +
          'need. The native column is the honest footnote: a builtin like `len` or `print` is ' +
          'called through the reference runtime rather than reimplemented, so those 9 calls ' +
          'across the suite are correct by construction and are not dispatches this machine ' +
          'paid for.'
      },
      {
        title: 'One switch, and the loop-capture question every language answers differently',
        goal: 'Show that a language-design debate is a frame-layout decision.',
        setup: 'A closure captures either the value or the slot. Berugo captures the value, so ' +
          'the demo has a switch that runs the same program the other way.',
        steps: [
          { do: 'Count the answers the table lists.',
            why: 'Every language you have used picked one of them.',
            work: '3 — by value, by reference, and by reference with a fresh slot each iteration' },
          { do: 'Say what by-reference capture means in a loop.',
            why: 'This is the classic bug.',
            work: 'all the closures share 1 variable, so every one sees the last value' },
          { do: 'Say what by-value capture costs in exchange.',
            why: 'The trade is not free.',
            work: 'a counter closure becomes impossible — 0 ways to mutate through it' },
          { do: 'Name the language that shipped two of the three.',
            why: 'Both answers in one language is the clearest evidence it is a choice.',
            work: 'JavaScript, with 2 of the 3: `var` points at the slot, `let` makes a fresh one' },
          { do: 'Say when an open upvalue has to be closed.',
            why: 'A pointer into a dead frame is a use-after-free.',
            work: 'when the defining frame returns — 1 copy into the cell, and the pointer dropped' }
        ],
        answer: 'The question looks like syntax and is decided by three lines of the VM. Berugo ' +
          'captures by value, so 0 of its upvalues are ever open and the "all my callbacks ' +
          'printed the last value" bug cannot occur in it — and neither can a counter, which ' +
          'is what the choice costs. Neither answer is wrong; they trade cost, mutability and ' +
          'least surprise differently, and knowing that the trade lives in the frame layout is ' +
          'what turns the argument into an engineering decision.'
      }
    ],

    'instruction-selection': [
      {
        title: 'One number moves and the selection follows',
        goal: 'Show that the cost model is data rather than code.',
        setup: 'The multiply-add tile is priced by a slider. Nothing is recompiled between ' +
          'settings; the tile table is read by the same dynamic-programming cover each time.',
        steps: [
          { do: 'Read the selection at the shipped price.',
            why: 'The baseline.',
            work: '7 trees, 17 tiles, 24 cycles, with multiply-add chosen 1 time' },
          { do: 'Lower the multiply-add price to 2.',
            why: 'A cheaper fused instruction should be chosen more readily.',
            work: '22 cycles, still 17 tiles and 1 use — cheaper, not more often' },
          { do: 'Raise it to 5.',
            why: 'There is a price at which two instructions are cheaper than one.',
            work: '24 cycles, 18 tiles, and 0 uses — the tile stops being selected' },
          { do: 'Now change a different tile: price the plain multiply at 1.',
            why: 'The fused tile competes against the pieces it replaces.',
            work: '20 cycles, 18 tiles, and multiply chosen 2 times instead of 1' },
          { do: 'Check every cover against exhaustive search.',
            why: 'A wrong recurrence returns a valid cover at a worse cost.',
            work: '7 of 7 trees agree, with 0 disagreements' }
        ],
        answer: 'The fused instruction is chosen while it is priced at 4 or less and abandoned ' +
          'at 5, which is exactly where the two instructions it replaces become cheaper — and ' +
          'making the plain multiply cheap has the same effect from the other side. No code ' +
          'was touched for any of that. The exhaustive check is what makes the numbers ' +
          'trustworthy: the tiler is not merely finding a good cover, it is finding the ' +
          'cheapest one, on every tree small enough to enumerate.'
      },
      {
        title: 'Two rows for one instruction, and the row that never fired',
        goal: 'Show why commutativity has to be written into the table.',
        setup: 'A pattern matcher compares shapes and knows nothing about algebra, so a tile ' +
          'written with the multiply on the left will not match a tree with it on the right.',
        steps: [
          { do: 'Count the multiply-add rows in the table.',
            why: 'One instruction, two shapes.',
            work: '2 — one with the multiply on the left and one on the right' },
          { do: 'Read how often each fires on the sample.',
            why: 'The source wrote the multiply on the right.',
            work: 'the left form fires 0 times and the right form fires 1' },
          { do: 'Say what a single-row table would have shown.',
            why: 'This is the failure the second row exists to prevent.',
            work: '0 uses, 25 cycles, and a target that looks as if it has no better option' },
          { do: 'Count the tiles in the table and how many are used here.',
            why: 'A row that fires nowhere is dead weight in the description.',
            work: '25 tiles, of which 7 are chosen on this program' },
          { do: 'Find the addressing-mode tile that fires zero times and say why.',
            why: 'Not every unused row is a bug.',
            work: 'the constant-offset load, 0 uses, because the index here is a loop counter' }
        ],
        answer: 'One instruction needed two rows, and the version with one row was silently ' +
          'worse rather than broken — the tile sat in the table, was never selected, and the ' +
          'cost came out 1 cycle higher with no indication why. Real selectors either write ' +
          'both patterns or canonicalise the tree before matching. The zero-use rows at the ' +
          'end of the table are the same shape of question asked honestly: one is a genuine ' +
          'gap and one is simply an addressing mode this program has no use for.'
      }
    ],

    'register-allocation': [
      {
        title: 'Two allocators, one function, and the measure that compares them',
        goal: 'Price the difference between colouring and linear scan properly.',
        setup: 'The pressure fixture keeps many values live at once. Both allocators run on it ' +
          'at each register count, and both allocations are checked at every program point ' +
          'against a liveness pass neither produced.',
        steps: [
          { do: 'Read both allocators at four registers.',
            why: 'The headline comparison.',
            work: '13 points in memory for colouring against 9 for linear scan' },
          { do: 'Read the spilled-interval counts instead.',
            why: 'This is the number that is usually reported and it is not comparable.',
            work: 'colouring spills 2 intervals and linear scan spills 0, after 6 splits' },
          { do: 'Turn interval splitting off and read the points again.',
            why: 'Splitting is the whole of what linear scan gains here.',
            work: '15 points instead of 9, and 3 spilled intervals instead of 0' },
          { do: 'Drop to one register and read both.',
            why: 'The comparison only means anything under pressure.',
            work: '25 points for colouring against 30 for linear scan' },
          { do: 'Check that both allocations are sound.',
            why: 'An allocator that spills nothing by sharing a register wins every column.',
            work: '17 of 17 conformance programs verify at every program point' }
        ],
        answer: 'With splitting on, linear scan BEATS graph colouring at three and four ' +
          'registers on this function and loses at one and two — which is not what the ' +
          'textbook claim predicts, and is what the sweep shows. Splitting expresses ' +
          'something an interference graph built from whole live ranges cannot: a value that ' +
          'holds a register for part of its life and sits in memory for the rest. Colouring ' +
          'is ahead only where the pressure is tightest, which is where its global view of ' +
          'interference is worth its cost. And the reported unit is what makes any of this ' +
          'readable: a spill COUNT goes up when splitting is enabled, because one interval ' +
          'becomes two, so that column alone would say the feature made things worse.'
      },
      {
        title: 'A spill count that went the wrong way',
        goal: 'Show how a decorative feature survives a plausible metric.',
        setup: 'The first version of this allocator kept one register per value and re-queued ' +
          'a spilled interval\'s tail under an invented name. The split counter went up and ' +
          'nothing consulted the tail.',
        steps: [
          { do: 'Read what that version reported at four registers.',
            why: 'It looked like a working feature.',
            work: '3 splits, 5 spilled intervals, and 28 points in memory' },
          { do: 'Compare against the same allocator with splitting turned off.',
            why: 'A feature that helps should not lose to its own absence.',
            work: '0 splits, 3 spilled intervals, and 18 points in memory' },
          { do: 'Say what the tail was actually doing.',
            why: 'The name is the clue.',
            work: 'it was queued under a register the program never mentions, so 0 uses read it' },
          { do: 'Fix the placements and read it again, resuming the tail one point later.',
            why: 'A real split truncates the first placement and re-queues the rest.',
            work: '13 points — better than 18, and still worse than the interval it split' },
          { do: 'Resume the tail at the first point an active interval ends instead.',
            why: 'One point later is a position where nothing has expired.',
            work: '9 points, from 6 splits and 0 spilled intervals' }
        ],
        answer: 'The feature was decorative twice over, and each time the fix was smaller than ' +
          'the diagnosis. First the tail was queued under a register nothing read, so the ' +
          'split counter rose and the code was unchanged. Then the tail resumed one point ' +
          'later, at a position where nothing had expired, so it spilled again immediately ' +
          'for the rest of its life and saved 5 points instead of 9. Resuming where a register ' +
          'actually frees up is what makes it work. Both versions reported a plausible split ' +
          'count throughout — only the unit a spill is paid in, program points in memory, ' +
          'moved in a direction that could be argued with.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
