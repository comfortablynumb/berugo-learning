/** Reference entries for ILP, dynamic scheduling and the reorder buffer (M36.1-M36.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'instruction-level-parallelism': {
      summary: 'The dependence graph of an executed trace, its critical path, and the '
        + 'instructions-per-cycle ceiling that follows. The analysis knows nothing about the '
        + 'processor, which is what lets it serve as the independent oracle for every timing '
        + 'claim in the rest of the milestone: the measured IPC is asserted never to exceed '
        + 'the bound, on every program at every issue width.',
      intuition: 'A program takes as long as its longest chain of real dependences; '
        + 'everything else is a question about the machine.',
      formulation: {
        equations: [
          {
            label: 'The bound, and the two fixtures that bracket it',
            expr: 'ILP bound = instructions / critical path',
            terms: [
              { sym: 'chain', meaning: '33 instructions, critical path 33, bound 1.00' },
              { sym: 'independent', meaning: '32 instructions, critical path 1, bound 32.00' },
              { sym: 'factorial', meaning: '124 instructions, critical path 19, bound 6.53' },
              { sym: 'chase', meaning: '133 instructions, critical path 66, bound 2.02' }
            ]
          },
          {
            label: 'Headroom: bound divided by the measurement at width 4',
            expr: 'headroom = bound / measured IPC',
            terms: [
              { sym: 'chain', meaning: '1.00 / 0.868 = 1.15x - nothing left to win' },
              { sym: 'independent', meaning: '32.00 / 1.524 = 21.00x - the machine is the limit' },
              { sym: 'arrayMax', meaning: '4.67 / 0.808 = 5.78x' },
              { sym: 'the reading', meaning: 'small headroom means change the code; large means change the machine' }
            ]
          },
          {
            label: 'The three dependence models, on the independent trace',
            expr: 'which edges a machine must obey',
            terms: [
              { sym: 'renamed', meaning: 'read-after-write and real memory conflicts: bound 32.00' },
              { sym: 'unrenamed', meaning: 'plus write-after-read and write-after-write: bound 4.00' },
              { sym: 'conservative memory', meaning: 'renamed, but every load waits for every older store' },
              { sym: 'the gap', meaning: '8.0x, and all 28 constraints removed are about names' }
            ]
          },
          {
            label: 'The parallelism profile of factorial',
            expr: 'instructions that could start in each cycle',
            terms: [
              { sym: 'cycle 0', meaning: '26 instructions ready' },
              { sym: 'cycles 1 to 18', meaning: 'between 1 and 10' },
              { sym: 'mean', meaning: '124 / 19 = 6.5' },
              { sym: 'the consequence', meaning: 'hardware is built for the peak and paid for every cycle' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The measured IPC never exceeds the bound',
          why: 'A timing bug leaves the architectural state perfect, so no differential can see it.',
          breaks: 'Asserted for every program at every width, under unit and machine latencies.'
        },
        {
          name: 'The graph is built over the trace, not the source',
          why: 'A loop executed forty times has a chain forty long.',
          breaks: 'One node per executed instruction, from the M34 behavioural simulator.'
        },
        {
          name: 'Memory edges use the addresses the run produced',
          why: 'Whether two accesses conflict is not visible in the instruction text.',
          breaks: 'The trace records the address of every load and store.'
        },
        {
          name: 'Every edge runs from a lower id to a higher one',
          why: 'It is what lets the critical path be one forward pass rather than a sort.',
          breaks: 'The trace is in program order and dependences point forwards in it.'
        }
      ],
      complexity: [
        { operation: 'building the graph', average: 'linear in the trace length', worst: 'the memory-order edges are reduced to a chain to keep it linear' },
        { operation: 'critical path', average: 'one forward pass over nodes and edges', worst: 'the same - the trace is already topologically ordered' },
        { operation: 'the bound itself', average: 'one division', worst: 'one division' },
        { operation: 'the parallelism profile', average: 'one pass over the start times', worst: 'buckets equal to the critical path length' }
      ],
      failureModes: [
        {
          symptom: 'A simulator reports an IPC no machine could reach.',
          cause: 'A timing bug that leaves every architectural value correct.',
          fix: 'Compute the dependence bound independently and assert the measurement is under it.'
        },
        {
          symptom: 'An analysis says a loop is parallel and the machine serialises it.',
          cause: 'The graph was drawn over the source, so name dependences were invisible.',
          fix: 'Draw it over the trace and count write-after-write edges separately.'
        },
        {
          symptom: 'Widening the machine does not help and nobody knows why.',
          cause: 'The bound was never computed, so it is unknown whether there is anything to get.',
          fix: 'Compute headroom first; it decides which of the two conversations to have.'
        },
        {
          symptom: 'The bound is exceeded because a latency was assumed too low.',
          cause: 'Unit latency is optimistic, which is safe; assuming a latency lower than the machine\'s is not.',
          fix: 'Report both bounds, and never assume less than the machine\'s own hit latency.'
        }
      ],
      inTheWild: [
        'The ILP limit studies of the late 1980s, whose small numbers shaped a decade of design.',
        'Compiler loop-carried dependence analysis, which is the same graph drawn statically.',
        'Roofline analysis, which is the same move in a different unit: compute the ceiling first.',
        'Critical-path analysis in build systems and in project scheduling.'
      ],
      sources: [
        { title: 'Hennessy and Patterson - Computer Architecture: A Quantitative Approach, chapter 3', note: 'the ILP chapter, including the limit studies' },
        { title: 'Wall - Limits of Instruction-Level Parallelism (1991)', note: 'the study whose conclusions the profile explains' },
        { title: 'Lam and Wilson - Limits of Control Flow on Parallelism (1992)', note: 'what removing the branch constraints would be worth' },
        { title: 'Austin and Sohi - Dynamic Dependency Analysis of Ordinary Programs (1992)', note: 'critical paths measured over real traces' }
      ]
    },

    'dynamic-scheduling': {
      summary: 'Register renaming as it is actually built: an alias table, a physical file, a '
        + 'free list and branch checkpoints, with the depth of renaming swept as a control so '
        + 'the benefit is measured rather than asserted. The scoreboard is present as the '
        + 'dependence model that has to respect name dependences, which is what puts a number '
        + 'on what Tomasulo removed.',
      intuition: 'A register name is a pointer; give each write its own storage and two of '
        + 'the three hazards stop existing.',
      formulation: {
        equations: [
          {
            label: 'The physical register file as a depth limit, on stride',
            expr: 'physical registers . spare . cycles',
            terms: [
              { sym: '34', meaning: '2 spare, 530 cycles' },
              { sym: '40', meaning: '8 spare, 362 cycles' },
              { sym: '48', meaning: '16 spare, 190 cycles' },
              { sym: '64 and above', meaning: '32 spare or more, 126 cycles - the curve is flat' }
            ]
          },
          {
            label: 'What renaming removes, counted on the independent trace',
            expr: 'dependence kind . count . removable',
            terms: [
              { sym: 'read after write', meaning: '0, and it would not be removable' },
              { sym: 'write after write', meaning: '28, all removed by renaming' },
              { sym: 'write after read', meaning: '0 on this trace' },
              { sym: 'the effect on the bound', meaning: '4.00 unrenamed against 32.00 renamed' }
            ]
          },
          {
            label: 'Wakeup and select, and why width stopped rising',
            expr: 'cost per cycle',
            terms: [
              { sym: 'wakeup', meaning: 'one tag compared against every window entry' },
              { sym: 'select', meaning: 'a priority encoder picking width entries from the ready set' },
              { sym: 'at window 32, width 4', meaning: '128 comparisons' },
              { sym: 'at width 8', meaning: '256, and a select network roughly four times larger' }
            ]
          },
          {
            label: 'The two recovery mechanisms',
            expr: 'mechanism . cost . where it is available',
            terms: [
              { sym: 'checkpoint restore', meaning: 'one copy, at branches and jumps' },
              { sym: 'unwind', meaning: 'one step per squashed instruction, anywhere' },
              { sym: 'why both', meaning: 'a checkpoint exists only where somebody took one' },
              { sym: 'consequence', meaning: 'the checkpoint count is a published design parameter' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A physical register is freed when the instruction that overwrote its name commits',
          why: 'Every possible reader of the old value was renamed earlier, so in-order commit means they have retired.',
          breaks: 'Freeing earlier hands out a live value; freeing later exhausts the file.'
        },
        {
          name: 'A freed register is added to every outstanding checkpoint as well as the live list',
          why: 'A checkpoint taken before the free would otherwise discard it on restore.',
          breaks: 'The leak is silent: correct results, then a permanent stall with an empty pipeline.'
        },
        {
          name: 'An unwound register goes only on the live free list',
          why: 'Every checkpoint predates its allocation, so its snapshot already lists it as free.',
          breaks: 'Adding it to a checkpoint hands the same register out twice after a restore.'
        },
        {
          name: 'Physical register 0 is never allocated',
          why: 'It is what x0 means: reads short-circuit to zero and writes are dropped.',
          breaks: 'An instruction allocated it waits forever for a value that is never written.'
        },
        {
          name: 'Every branch and jump takes a checkpoint',
          why: 'A conditional branch writes no register and is the most likely thing to mispredict.',
          breaks: 'Checkpointing only where a destination was allocated leaves those with nothing to restore.'
        }
      ],
      complexity: [
        { operation: 'rename one instruction', average: 'two table lookups and one free-list pop', worst: 'a stall when the free list is empty' },
        { operation: 'wakeup', average: 'one comparison per window entry', worst: 'the same, every cycle, on the critical path' },
        { operation: 'select', average: 'a priority encoder over the ready set', worst: 'grows faster than the issue width' },
        { operation: 'checkpoint restore', average: 'one copy of the table and the free list', worst: 'independent of how deep the window is' },
        { operation: 'unwind', average: 'one step per squashed instruction', worst: 'the whole window, which is the cost a checkpoint avoids' }
      ],
      failureModes: [
        {
          symptom: 'The machine stalls forever with an empty reorder buffer and no free registers.',
          cause: 'A free-list leak: registers freed but never returned, or returned and then discarded.',
          fix: 'Free at commit, add to every outstanding checkpoint, and never exclude registers by number.'
        },
        {
          symptom: 'Correct at width 1 and wrong or stalled at width 2 and above.',
          cause: 'A recovery path that only works when nothing else is in flight.',
          fix: 'Sweep the width in the differential; a single-width test proves very little here.'
        },
        {
          symptom: 'Code that looks obviously parallel runs at one instruction per cycle.',
          cause: 'It reuses a small set of register names and the machine cannot rename.',
          fix: 'Compare the renamed and unrenamed dependence bounds; the gap is the diagnosis.'
        },
        {
          symptom: 'More physical registers stop helping well before the window is full.',
          cause: 'Some other structure is the binding limit.',
          fix: 'Size the file against the reorder buffer; beyond that it is silicon nobody uses.'
        },
        {
          symptom: 'A mispredicted branch restores a mapping for a path that was not taken.',
          cause: 'The checkpoint was taken at execute rather than at rename.',
          fix: 'Take it when the branch is renamed; by execute the state it needs is gone.'
        }
      ],
      inTheWild: [
        'Every out-of-order processor since the early 1990s, and IBM\'s 360/91 before them.',
        'Static single assignment form in compilers, which is renaming applied to a program text.',
        'Multi-version concurrency control in databases, which is renaming applied to rows.',
        'Copy-on-write in file systems and in memory managers.'
      ],
      sources: [
        { title: 'Tomasulo - An Efficient Algorithm for Exploiting Multiple Arithmetic Units (1967)', note: 'reservation stations, the common data bus and renaming' },
        { title: 'Thornton - Design of a Computer: the Control Data 6600 (1970)', note: 'the scoreboard, and what it has to stall on' },
        { title: 'Smith and Pleszkun - Implementing Precise Interrupts in Pipelined Processors (1988)', note: 'the reorder buffer and the reclamation rules' },
        { title: 'Sima - The Design Space of Register Renaming Techniques (2000)', note: 'the alternatives, and why physical files won' }
      ]
    },

    'reorder-buffer-and-precise-state': {
      summary: 'In-order commit as the mechanism behind precise exceptions on a machine with '
        + 'dozens of instructions in flight. Five fault classes are raised with the buffer '
        + 'full - which needs the faulting ADDRESS to depend on a chain, or the window drains '
        + 'before the fault arrives - and the resulting state is compared field by field '
        + 'against the M34 behavioural simulator.',
      intuition: 'Finish in any order, become real in program order, and the second order is '
        + 'the only one a program can observe.',
      formulation: {
        equations: [
          {
            label: 'Five faults reached through a chain, at a 32-entry buffer',
            expr: 'fault . mcause . mepc . in flight . squashed . differences',
            terms: [
              { sym: 'ecall', meaning: '11 . 0x2c . 32 . 39 . none' },
              { sym: 'illegal instruction', meaning: '2 . 0x2c . 2 . 0 . none' },
              { sym: 'misaligned load', meaning: '4 . 0x34 . 32 . 39 . none' },
              { sym: 'misaligned store', meaning: '6 . 0x34 . 32 . 39 . none' },
              { sym: 'unmapped load', meaning: '5 . 0x34 . 32 . 39 . none' }
            ]
          },
          {
            label: 'The window as a bound on running ahead',
            expr: 'buffer entries . stride cycles . chain cycles',
            terms: [
              { sym: '4', meaning: '463 . 38' },
              { sym: '16', meaning: '202 . 38' },
              { sym: '32', meaning: '126 . 38' },
              { sym: '64 and 128', meaning: '108 . 38' },
              { sym: 'the reading', meaning: '4.29x on the array walk and nothing on the chain' }
            ]
          },
          {
            label: 'Where a result lives at each stage of its life',
            expr: 'state . storage . visible',
            terms: [
              { sym: 'waiting', meaning: 'nowhere - the operands have not arrived . no' },
              { sym: 'executing', meaning: 'a functional unit . no' },
              { sym: 'complete', meaning: 'a physical register, or a queue entry for a store . no' },
              { sym: 'committed', meaning: 'the architectural mapping, and memory . yes, irrevocably' }
            ]
          },
          {
            label: 'A deeper window is not monotonically better',
            expr: 'arrayMax . entries . cycles . squashed',
            terms: [
              { sym: '16', meaning: '54 cycles, 82 squashed' },
              { sym: '32', meaning: '52 cycles, 92 squashed' },
              { sym: '64', meaning: '54 cycles, 140 squashed' },
              { sym: 'the reason', meaning: 'the extra depth was spent on a mispredicted path' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The state at any fault matches the in-order reference exactly',
          why: 'That guarantee is what every debugger and page-fault handler is built on.',
          breaks: 'Compared at the same retire count on all five fixtures, four of them with the buffer full.'
        },
        {
          name: 'No store reaches memory before it commits',
          why: 'A speculative write could not be taken back: memory has no free list.',
          breaks: 'The store holds its address and data in the queue; forwarding serves younger loads.'
        },
        {
          name: 'A fault is detected without being taken',
          why: 'Attempting the access to find out whether it is legal is the thing precise exceptions forbid.',
          breaks: 'The address check reports without performing; checking by attempting made misaligned stores never fault.'
        },
        {
          name: 'A fault on the wrong path never becomes a trap',
          why: 'Fetch runs far ahead and decodes bytes the program never executes.',
          breaks: 'A fault becomes a trap only when its instruction reaches the head of the buffer.'
        },
        {
          name: 'A squash on a frozen machine unfreezes it',
          why: 'Freezing on a wrong-path fault and not unfreezing stops the machine dead.',
          breaks: 'The freeze is re-evaluated after every squash against what is still in flight.'
        }
      ],
      complexity: [
        { operation: 'dispatch', average: 'one buffer entry per instruction', worst: 'stalls entirely when the buffer is full' },
        { operation: 'commit', average: 'up to the commit width per cycle, in order', worst: 'zero while the head is unfinished' },
        { operation: 'squash', average: 'one splice of the buffer, one cycle', worst: 'the whole window, still one cycle' },
        { operation: 'running past a cache miss', average: 'bounded by the buffer size', worst: 'zero when the buffer is already full' },
        { operation: 'a store', average: 'one queue entry from execute to commit', worst: 'the whole time the buffer head is stuck' }
      ],
      failureModes: [
        {
          symptom: 'A misaligned or unmapped store does not fault at all.',
          cause: 'Its legality was checked by attempting the write, which a speculative store may not do.',
          fix: 'A separate check that reports without performing, run when the address is computed.'
        },
        {
          symptom: 'The machine traps on an instruction the program never executed.',
          cause: 'A wrong-path fault was acted on instead of being discarded with the path.',
          fix: 'Only faults that reach the head of the buffer become traps.'
        },
        {
          symptom: 'The machine freezes and never restarts.',
          cause: 'A wrong-path fault froze fetch and the squash that removed it did not unfreeze.',
          fix: 'Re-evaluate the freeze after every squash against what is still in flight.'
        },
        {
          symptom: 'A register comparison passes on a machine that skipped a trap.',
          cause: 'The machine that skipped it retired MORE instructions, and both hold correct values.',
          fix: 'Compare the taken traps and the cause registers, not only the general registers.'
        },
        {
          symptom: 'A bigger reorder buffer makes the program slower.',
          cause: 'The extra depth was spent speculating down a mispredicted path.',
          fix: 'Report squashed work alongside cycles; window size is a trade, not a number to maximise.'
        }
      ],
      inTheWild: [
        'Every out-of-order processor, and the reason a debugger can stop one at an instruction.',
        'Write-ahead logging in databases: private work, an ordered record, one commit point.',
        'Copy-on-write file systems, where an atomic superblock update is the commit.',
        'Transactional memory, which exposes the same three-part structure to software.'
      ],
      sources: [
        { title: 'Smith and Pleszkun - Implementing Precise Interrupts in Pipelined Processors (1988)', note: 'the paper the reorder buffer comes from' },
        { title: 'Hennessy and Patterson - Computer Architecture: A Quantitative Approach, chapter 3', note: 'commit, speculation and recovery' },
        { title: 'Moudgill, Pingali and Vassiliadis - Register Renaming and Dynamic Speculation (1993)', note: 'reclamation rules and where they go wrong' },
        { title: 'The RISC-V privileged specification', note: 'mcause, mepc and mtval, which the fixtures assert on' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
