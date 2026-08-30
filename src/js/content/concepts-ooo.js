/** Concepts for ILP, dynamic scheduling and the reorder buffer (M36.1-M36.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'instruction-level-parallelism': [
      {
        term: 'Instruction-level parallelism is a property of the code',
        diagram: {
          definition: [
            'flowchart LR',
            '    T["a run of the program"] --> G["dependence graph"]',
            '    G --> C["longest chain = critical path"]',
            '    C --> B["ILP bound = instructions / critical path"]',
            '    B --> M["no machine can exceed this"]'
          ].join('\n'),
          caption: 'The bound comes out of the code and knows nothing about the processor, '
            + 'which is exactly why it can be used to check one.'
        },
        plain: 'Divide the instruction count by the longest dependence chain and you have the ceiling.',
        formal: 'the highest IPC any machine could reach is instructions / critical path',
        detail: 'On a machine with unlimited width, an unlimited window and perfect '
          + 'prediction, a program takes exactly as long as its longest chain of real '
          + 'dependences. Everything else can happen in parallel. So the ratio of the '
          + 'instruction count to that chain is a hard ceiling on instructions per cycle, and '
          + 'it is computed from the program alone. That is what makes it useful as a check: '
          + 'a simulator reporting an IPC above it has a timing bug that no correctness test '
          + 'could find, because both machines still produce the right answer.',
        example: 'The `chain` fixture is 33 instructions with a critical path of 33, so its '
          + 'bound is 1.00 and the simulator measures 0.868.'
      },
      {
        term: 'Three dependence kinds, and only read-after-write is real',
        plain: 'The other two exist because there are only thirty-two register names.',
        formal: 'RAW is a dependence on a value; WAR and WAW are dependences on a name',
        detail: 'A read-after-write dependence means the second instruction needs the number '
          + 'the first produced, and no hardware can remove it. Write-after-read and '
          + 'write-after-write are different in kind: they exist only because the instruction '
          + 'set has a fixed, small set of register names that the compiler has to reuse. Give '
          + 'the two writers different physical registers and there is nothing left to '
          + 'conflict over. Recognising which of the three you are looking at is what decides '
          + 'whether a rewrite can help.',
        example: 'On the `independent` trace there are 0 read-after-write edges and 28 '
          + 'write-after-write ones, all of them removable.'
      },
      {
        term: 'The trace matters, not the source',
        plain: 'A loop run forty times has a chain forty long.',
        formal: 'the graph is built over the executed instructions, one node per execution',
        detail: 'A static analysis of a loop body sees a short chain and a back edge; the '
          + 'thing that decides the running time is the chain through the whole execution, '
          + 'which is the body repeated once per iteration. Building the graph over a trace '
          + 'also gives the memory addresses, which is the only way to know whether two memory '
          + 'accesses actually conflict. Both of those are reasons the analysis lives after '
          + 'the program has run rather than before.',
        example: 'The `stride` trace is 164 instructions from a 9-instruction loop body, and '
          + 'its critical path is 35.'
      },
      {
        term: 'Memory dependences cannot be read off the instruction text',
        plain: 'Whether a load depends on a store is a question about their addresses.',
        formal: 'two memory accesses conflict when their addresses overlap, which is a run-time fact',
        detail: 'Register dependences are visible in the encoding: the register numbers are '
          + 'right there in the instruction. Memory dependences are not, because the address '
          + 'is computed. A machine that will not let a load pass a store whose address is not '
          + 'yet known is correct and serialises heavily; one that lets it go is fast and '
          + 'occasionally wrong. That single unknowable is the reason memory dependence '
          + 'speculation exists, and it is why the memory model is the hardest part of an '
          + 'out-of-order design.',
        example: 'On `hiddenDisjoint` the conservative bound is 2.54 against 5.92 when the '
          + 'machine may guess.'
      },
      {
        term: 'Latency and resources give two different bounds, and both hold',
        plain: 'Unit latency is the classic figure; the machine\'s own latencies give a tighter one.',
        formal: 'the bound falls as the assumed latencies rise, and the measurement is under both',
        detail: 'Setting every operation to one cycle gives the "infinite resources" figure '
          + 'the classic studies reported. Using the simulator\'s own latencies - a load takes '
          + 'two cycles rather than one - lengthens the critical path and lowers the bound, '
          + 'and the real machine cannot beat that one either. A cache miss makes a real load '
          + 'slower still, which only moves the measurement further below both. Having two '
          + 'bounds that must both hold is a stronger check than having one.',
        example: 'On `stride` the unit-latency bound is 4.69 and the machine-latency bound '
          + '4.56; the measurement is 1.302.'
      },
      {
        term: 'The parallelism profile is spiky, and that is the economic problem',
        plain: 'A few very wide cycles, and a long flat stretch between them.',
        formal: 'the peak of the profile is far above its mean, and hardware is built for the peak',
        detail: 'Plotting how many instructions could start in each cycle of an unlimited '
          + 'machine produces a shape with a few tall spikes over a long plain. The spikes '
          + 'decide how wide a machine would have to be to exploit the parallelism; the mean '
          + 'decides how often that width is used. Since hardware is paid for in every cycle '
          + 'and used in few, the returns fall away long before the parallelism does. This is '
          + 'the shape behind the disappointing conclusions of the ILP studies of the late '
          + '1980s.',
        example: '`factorial` offers 26 instructions in its first cycle and between 1 and 10 '
          + 'in every cycle after it.'
      },
      {
        term: 'The gap between bound and measurement says what to change',
        plain: 'A small gap means fix the code; a large one means the machine is the limit.',
        formal: 'headroom = bound / measured IPC',
        detail: 'When the measurement is already close to the bound, the processor is doing '
          + 'nearly everything the code permits and no microarchitectural change will help; '
          + 'the only remaining move is to change the dependence structure, which means '
          + 'changing the program. When the gap is large the code has parallelism the machine '
          + 'is failing to use, and questions about width, window, ports and memory are the '
          + 'right ones. Most performance arguments that go in circles are ones where nobody '
          + 'computed this first.',
        example: '`chain` has a headroom of 1.15x and `independent` of 21.00x, and they want '
          + 'opposite responses.'
      },
      {
        term: 'A bound is an oracle a correctness test cannot be',
        plain: 'Two machines can both compute the right answer and one of them lie about the time.',
        formal: 'the differential checks values; the bound checks cycles',
        detail: 'Comparing an out-of-order simulator against an in-order reference catches '
          + 'every kind of wrong answer and no kind of wrong timing, because a timing bug '
          + 'leaves the architectural state perfect. An independently computed ceiling on IPC '
          + 'is the check that closes that hole: it is derived from the program rather than '
          + 'from the machine, so agreeing with it is evidence rather than a tautology. This '
          + 'is the same discipline as the published test vectors in M23 and the exact optimum '
          + 'in M10.',
        example: 'The test suite asserts the measured IPC is under both bounds for every '
          + 'program at every issue width.'
      }
    ],

    'dynamic-scheduling': [
      {
        term: 'Renaming: a register name is a pointer, not a place',
        diagram: {
          definition: [
            'flowchart LR',
            '    W1["addi t0, zero, 1"] -->|"allocate p32"| T1["t0 now means p32"]',
            '    W2["addi t0, zero, 2"] -->|"allocate p33"| T2["t0 now means p33"]',
            '    T1 -.->|"readers of the first value"| R1["still read p32"]',
            '    T2 -.->|"readers of the second"| R2["read p33"]'
          ].join('\n'),
          caption: 'Two writes to one name, two physical registers, and nothing to conflict '
            + 'over. That is the whole of it.'
        },
        plain: 'Writing a register allocates a new physical one and repoints the name.',
        formal: 'the alias table maps each of the 32 names to one of the physical registers',
        detail: 'Nothing is ever overwritten while anything might still read it. An '
          + 'instruction that writes takes a register off the free list, points the '
          + 'architectural name at it, and remembers what the name used to mean so commit can '
          + 'give the old one back. Reading a register becomes a lookup through the table. '
          + 'That one indirection removes both name dependences outright, because two writers '
          + 'to the same name were given different registers before either of them ran.',
        example: 'With 64 physical registers, 32 hold the architectural state and 32 are '
          + 'available to rename with.'
      },
      {
        term: 'A scoreboard stalls where Tomasulo does not',
        plain: 'The 6600 tracked conflicts; the 360/91 removed them.',
        formal: 'a scoreboard respects all three dependence kinds, a renaming machine only RAW',
        detail: 'CDC\'s scoreboard recorded which unit was writing which register and stopped '
          + 'anything that would conflict, which is correct and pays for every name collision '
          + 'the compiler left behind. Tomasulo\'s design three years later gave each '
          + 'in-flight write its own storage and tagged the waiting operands, so write-after-read '
          + 'and write-after-write stopped existing rather than being detected. The difference '
          + 'shows on any code that reuses registers, which is all code.',
        example: 'On `independent` the renamed bound is 32.00 and the unrenamed one 4.00 - a '
          + 'factor of eight from naming alone.'
      },
      {
        term: 'Wakeup and select, every cycle, and both on the critical path',
        plain: 'A finished result broadcasts its tag; the ready set is then picked from.',
        formal: 'wakeup compares one tag against every entry; select picks up to the width from the ready set',
        detail: 'Wakeup is a broadcast: a result appears with the name of the physical '
          + 'register it wrote, and every waiting entry compares. Select is a priority encoder '
          + 'over everything now ready, choosing as many as the ports can take, and the pick '
          + 'has to complete in time for the chosen instructions to read their operands in the '
          + 'same cycle. Both grow with the window and with the width, and their cost is the '
          + 'hardware reason issue width stopped rising.',
        example: 'At a window of 32 and a width of 4 that is 128 tag comparisons per '
          + 'broadcast; at width 8 it is 256.'
      },
      {
        term: 'Select oldest first, because the oldest is blocking commit',
        plain: 'Picking the youngest ready instruction is equally correct and much worse.',
        formal: 'the oldest ready instruction is the most likely to be at the head of the reorder buffer',
        detail: 'Any ready instruction may be issued without breaking correctness, so the '
          + 'choice is a pure performance decision. Choosing the oldest is right because the '
          + 'reorder buffer commits in order: the oldest unfinished instruction is the one '
          + 'holding up retirement, and retirement is what frees the entries and registers '
          + 'everything else is waiting for. Picking the youngest leaves the head unfinished '
          + 'while the window fills behind it.',
        example: 'The simulator scans the issue queue in dispatch order and takes the first '
          + 'ready entries with a free port.'
      },
      {
        term: 'The physical file size is how deep the machine may rename',
        plain: 'Thirty-two registers always hold the architectural state; the rest are the budget.',
        formal: 'spare registers = physical registers - 32, and dispatch stalls when they run out',
        detail: 'A machine with 34 physical registers can have exactly two renamed writes in '
          + 'flight; when a third instruction wants a register, dispatch stops until a commit '
          + 'frees one. That makes the file size a direct limit on how far ahead the machine '
          + 'can run, and it has to be matched to the reorder buffer - a window of 32 entries '
          + 'with 8 spare registers is a window that can never fill, and 200 spare registers '
          + 'behind a 32-entry window is silicon nobody uses.',
        example: 'On `stride`, 34 physical registers give 530 cycles and 64 give 126.'
      },
      {
        term: 'Reclaiming a register is where renaming goes wrong',
        plain: 'A register is free when the instruction that overwrote its name commits.',
        formal: 'at commit, the previous physical register of the destination name is dead',
        detail: 'Every instruction that could still read the old register was renamed before '
          + 'the instruction that overwrote the name, so in-order commit guarantees they have '
          + 'all retired. That makes commit the exactly-right moment to free it, and getting '
          + 'the moment wrong in either direction is fatal: too early and a live value is '
          + 'handed out twice, too late and the machine runs out of registers and stalls '
          + 'forever with an empty pipeline. Two separate leaks of the second kind lived in '
          + 'this simulator.',
        example: 'A run of `factorial` allocates 166 physical registers and gives back 77, '
          + 'with the rest recovered by checkpoint restores.'
      },
      {
        term: 'A checkpoint makes recovery a copy instead of an unwind',
        plain: 'Take a snapshot of the table at each branch; restore it if the branch was wrong.',
        formal: 'a restore is one copy whatever the window holds; an unwind is one step per squashed instruction',
        detail: 'The alternative to checkpointing is walking the reorder buffer backwards '
          + 'undoing renames one at a time, which is correct and slow. The difference between '
          + 'those two is most of the misprediction penalty on a modern machine, which is why '
          + 'the number of checkpoints a design supports is a published parameter and why '
          + 'running out of them makes the next branch stall rather than speculate. A '
          + 'checkpoint has to be taken at rename rather than at execute, because by execute '
          + 'the state it needs is gone.',
        example: 'Every branch and jump gets a checkpoint here; conditional branches that '
          + 'write no register need one just as much.'
      },
      {
        term: 'The same idea appears in SSA and in MVCC',
        plain: 'When contention is over a name rather than a value, make more names.',
        formal: 'renaming, static single assignment and multi-version concurrency control are one pattern',
        detail: 'Static single assignment in M29 gives every assignment its own name so the '
          + 'compiler stops reasoning about reuse. Multi-version concurrency control in M53 '
          + 'keeps old row versions so readers and writers stop contending. Both pay the same '
          + 'price as a physical register file: more storage, and bookkeeping to decide when '
          + 'an old version is unreachable. In all three, that bookkeeping is where the bugs '
          + 'live - garbage collection, vacuum and the free list are the same problem.',
        example: 'The register leak here and a database vacuum that falls behind produce the '
          + 'same symptom: work that stops for lack of names.'
      }
    ],

    'reorder-buffer-and-precise-state': [
      {
        term: 'Finish in any order, become real in program order',
        diagram: {
          definition: [
            'flowchart LR',
            '    E["execution: whenever operands allow"] --> B["reorder buffer, program order"]',
            '    B -->|"head, and finished"| C["commit: registers, memory, CSRs"]',
            '    B -->|"anything younger than a fault"| S["squashed, and it never happened"]'
          ].join('\n'),
          caption: 'One structure, two orders, and the second one is the only one a program '
            + 'can observe.'
        },
        plain: 'The buffer holds finished instructions until every older one has retired.',
        formal: 'commit is in program order and is the only place architectural state changes',
        detail: 'Execution finishes in whatever order operands allow, which is the whole point '
          + 'of the machine, and every result sits in a physical register or a queue entry '
          + 'until the oldest instruction in the buffer is finished. That single rule is what '
          + 'lets a machine with forty instructions in flight behave exactly like a machine '
          + 'with one, and it is why precise exceptions survive out-of-order execution at all.',
        example: 'A run of `sum` with 43 instructions fills the 32-entry buffer completely at '
          + 'its peak.'
      },
      {
        term: 'A result that exists is not a result that happened',
        plain: 'Between execute and commit, nothing the program can see has changed.',
        formal: 'speculative state lives in the physical file and the load/store queue only',
        detail: 'There is no undo operation anywhere in this machine, and there does not need '
          + 'to be. A squash deletes bookkeeping - queue entries, buffer entries, a mapping - '
          + 'because nothing outside the bookkeeping had been touched. That is why a '
          + 'misprediction costs work and time rather than correctness, and it is the reason '
          + 'the mitigation for a speculative side channel has to be about the access rather '
          + 'than about the rollback.',
        example: 'A squash of 28 in-flight entries takes one cycle and changes no register the '
          + 'program can read.'
      },
      {
        term: 'A store must not write memory until it commits',
        plain: 'Memory has no free list and no checkpoint.',
        formal: 'a store holds its address and data in the queue from execute until commit',
        detail: 'A speculative register can be reclaimed and a speculative queue entry can be '
          + 'deleted, but a speculative write to memory could not be taken back. So the store '
          + 'sits in the load/store queue holding the address and the value, and a younger '
          + 'load to the same address is given the value from the queue rather than from '
          + 'memory. That rule is what makes store-to-load forwarding necessary rather than '
          + 'merely clever.',
        example: 'The `alias` fixture forwards 8 of its loads out of the store queue and makes '
          + 'zero cache accesses in the whole run.'
      },
      {
        term: 'A precise exception is one an in-order machine could have produced',
        plain: 'Everything before the fault has committed; nothing after it has.',
        formal: 'the state at the handler is identical to the in-order machine at the same instruction',
        detail: 'That is the guarantee every debugger, every page-fault handler and every '
          + 'garbage collector safepoint is built on. It is also a strong claim to make about '
          + 'a machine with forty instructions in flight, which is why the demo raises five '
          + 'fault classes with the window full and compares every register and control '
          + 'register against the M34 behavioural simulator stepped the same number of times, '
          + 'rather than checking a few fields by hand.',
        example: 'All five fault fixtures report zero differences against the in-order '
          + 'reference, four of them with all 32 buffer entries occupied.'
      },
      {
        term: 'A fault has to be detected without being taken',
        plain: 'A store must know it will fault before it is allowed to write.',
        formal: 'the legality of an access is checked when the address is computed, not when the access happens',
        detail: 'An in-order machine can attempt an access and use the fault the attempt '
          + 'returns, because attempting it is safe. An out-of-order machine cannot: the '
          + 'attempt is the thing precise exceptions forbid. So the address check has to be a '
          + 'separate operation that reports without performing. This simulator checked a '
          + 'store by attempting the write, and the result was that a misaligned store never '
          + 'faulted at all while the in-order reference trapped on the same instruction.',
        example: 'The misalignedStore fixture reports cause 6 with mtval 0x10000002 once the '
          + 'check is separated from the write.'
      },
      {
        term: 'A fault on the wrong path is not a fault',
        plain: 'Fetch runs far ahead and reads past the end of programs constantly.',
        formal: 'a detected fault only becomes a trap if its instruction reaches the head of the buffer',
        detail: 'Speculative fetch decodes whatever bytes are there, including zeros past the '
          + 'end of an image, and reports illegal instructions and access faults for code the '
          + 'program never executes. Those are discarded with the rest of the wrong path. A '
          + 'machine that acted on them would trap on instructions it never ran, and a machine '
          + 'that froze on one without unfreezing when the redirect squashed it stops dead - '
          + 'which is a bug both M35 and M36 had.',
        example: 'A wrong-path illegal instruction appears in the window as a squashed row and '
          + 'never reaches commit.'
      },
      {
        term: 'The buffer size is a hard bound on how far ahead the machine may run',
        plain: 'When it is full nothing can be dispatched, however ready it is.',
        formal: 'dispatch stops when the buffer is full, whatever the issue width says',
        detail: 'The instruction at the head cannot commit until it finishes, and a load that '
          + 'misses in the cache sits there for the whole miss. Everything the machine can do '
          + 'in the meantime has to fit in the remaining entries, so the buffer size is '
          + 'directly the amount of work that can overlap with a memory access. Two hundred '
          + 'cycles of memory latency is why the number went from around forty entries in the '
          + 'mid 1990s to several hundred today.',
        example: 'On `stride` the buffer sweep runs 463 cycles at 4 entries and 108 at 64.'
      },
      {
        term: 'A bigger window is not monotonically better',
        plain: 'More depth means more speculation, and more of it wrong.',
        formal: 'window size buys memory-level parallelism and pays in squashed work',
        detail: 'Running further past an unresolved branch finds more independent work when '
          + 'the branch was predicted correctly and does more useless work when it was not. On '
          + 'a branchy program the second effect can win outright, so the cycle count goes up '
          + 'with the window rather than down. That makes window size a workload-dependent '
          + 'trade rather than a number to maximise, and it is the same shape as every other '
          + 'speculation decision in the milestone.',
        example: '`arrayMax` takes 52 cycles at 32 entries and 54 at 64, squashing 92 '
          + 'instructions against 140.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
