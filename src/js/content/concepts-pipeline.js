/** Concepts for pipelining, structural hazards and forwarding (M35.1-M35.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'pipelining-fundamentals': [
      {
        term: 'Pipelining overlaps instructions; it makes none of them faster',
        diagram: {
          definition: [
            'flowchart LR',
            '    subgraph one["cycle 3"]',
            '        A["i1: execute"]',
            '        B["i2: decode"]',
            '        C["i3: fetch"]',
            '    end',
            '    one --> T["throughput: one instruction finishes per cycle"]',
            '    one --> L["latency: five cycles, each with a register delay"]'
          ].join('\n'),
          caption: 'The same picture read two ways. Down a column is one cycle with five '
            + 'instructions in it; across a row is one instruction taking five cycles.'
        },
        plain: 'Five instructions in flight, one finishing per cycle, each taking five cycles.',
        formal: 'throughput approaches one instruction per cycle; latency is the stage count',
        detail: [
          'The instruction itself takes longer than it did on the single-cycle machine, because '
            + 'every stage boundary costs a register\'s setup and clock-to-output time.',
          'What improved is the rate at which instructions finish when there are many of them.',
          'That is only an improvement if there are many of them.',
          'The distinction is the whole of the section, and it reappears in every system that '
            + 'overlaps work.'
        ],
        example: 'One instruction end to end takes 755 gate delays here against 178 on the '
          + 'single-cycle machine; the throughput is 0.827 instructions per cycle.'
      },
      {
        term: 'An unbalanced pipeline gains almost nothing, and this one is unbalanced',
        plain: 'The period is the longest stage, so one fat stage sets it.',
        formal: 'the ALU is 148 of the datapath\'s 175 gate delays',
        detail: [
          'Cutting a datapath into five stages only shortens the clock if the work divides '
            + 'evenly.',
          'This one does not. The ALU is a 32-bit ripple-carry design and holds 85% of the logic '
            + 'delay, so a five-stage split gives a period of 151 against the single-cycle 178.',
          'That is a 15% saving bought with fill, stalls and flushes, and on these programs it '
            + 'comes out slower overall.',
          'Pipelining is not a technique that can be applied to an arbitrary design. It is a '
            + 'technique that pays after the stages have been balanced.'
        ],
        example: 'The sum program: 7 654 gate delays single-cycle, 7 852 pipelined as built, '
          + 'and 1 976 with the logic divided evenly at 38 delays a stage.'
      },
      {
        term: 'A pipeline register carries everything a later stage will need',
        plain: 'Nothing can be looked up later, because by then the instruction is gone.',
        formal: 'the destination register number is read in decode and used in write-back, four stages later',
        detail: [
          'The register file is being read by a different instruction by the time this one '
            + 'reaches execute, and the ALU is computing something else in the next cycle.',
          'The instruction word itself has long since been overwritten in the fetch latch.',
          'So every field an instruction still needs has to travel with it.',
          'That is why the destination register number appears in three of the four pipeline '
            + 'registers, and why the latches are wider than a first sketch suggests.'
        ],
        example: 'ID/EX carries both source values, the immediate, the destination number and '
          + 'the whole control vector — everything the last three stages will ask for.'
      },
      {
        term: 'The ideal speed-up is the stage count and nobody gets it',
        plain: 'Fill, stalls and flushes are the difference.',
        formal: 'cycles = instructions + fill + stalls + flushes, and the totals reconcile exactly',
        detail: [
          'Filling the pipeline costs four cycles at the start and again after every trap. A '
            + 'stall costs one, and a redirect costs two.',
          'Attributing every cycle to one of those causes is what turns "pipelining has '
            + 'overheads" into a number.',
          'The attribution has to be exact. A model whose cycles do not add up is measuring '
            + 'something it has not described.',
          'The demo charges every empty write-back cycle to whatever created the bubble that '
            + 'arrived there, which is exact by construction.'
        ],
        example: 'The sum program: 52 cycles = 43 retired + 1 trap + 4 of fill + 4 of flush, '
          + 'with no stalls at all.'
      },
      {
        term: 'IPC and clock period are two factors and only their product is a result',
        plain: 'Instructions per cycle says how full the pipeline is; the period says how long a cycle is.',
        formal: 'time = instructions x CPI x clock period',
        detail: [
          'This is the same equation M34.6 used to reject the multi-cycle machine, and it applies '
            + 'with equal force here.',
          'A pipeline with a wonderful IPC and a period that barely moved is not faster.',
          'A pipeline with a short period and an IPC of 0.3 is not either.',
          'Quoting one factor is how a design gets approved and then disappoints. It is why every '
            + 'comparison in this milestone is reported in gate delays rather than in cycles.'
        ],
        example: 'IPC 0.827 at a period of 151 is 7 852 gate delays; the same IPC at a balanced '
          + '38 would be 1 976.'
      },
      {
        term: 'Latency gets worse, and nobody advertises it',
        plain: 'Five short stages take longer end to end than one long one.',
        formal: 'each stage boundary adds the flip-flop overhead to the total path',
        detail: [
          'A single instruction, alone in the machine, is slower on a pipelined processor than on '
            + 'an unpipelined one.',
          'It takes five periods instead of one, and each period includes a register delay the '
            + 'unpipelined machine never paid.',
          'For a stream of instructions that is irrelevant, because they overlap.',
          'For a workload that cares about one operation finishing quickly it is a real '
            + 'regression. It is why a deeply pipelined machine can feel worse on '
            + 'latency-sensitive work than a shallower one.'
        ],
        example: '5 x 151 = 755 gate delays for one instruction, against 178 unpipelined.'
      },
      {
        term: 'Overlap creates hazards, and they are the rest of the milestone',
        plain: 'Three ways an instruction can be unable to proceed.',
        formal: 'structural, data and control hazards — none of which exist one instruction at a time',
        detail: [
          'A structural hazard is two stages wanting one resource.',
          'A data hazard is an instruction reading a register an instruction still in flight has '
            + 'not written, and a control hazard is not knowing what to fetch next.',
          'Every one of them is created by the overlap, and none of them existed in M34.',
          'That is the pattern. A technique that improves one thing usually creates a new class '
            + 'of problem, and the honest accounting is the improvement minus the new problems '
            + 'rather than the improvement alone.'
        ],
        example: 'On the array-maximum program the hazards cost 16 of 62 cycles — 5 stalls and '
          + '10 flushes plus the fill.'
      },
      {
        term: 'The throughput-for-latency trade appears everywhere work is overlapped',
        plain: 'Every pipeline anywhere makes the individual unit slower.',
        formal: 'batching, request pipelining and wide parallelism are all this trade',
        detail: [
          'HTTP request pipelining raises the requests a connection can carry, and makes one slow '
            + 'response block everything behind it.',
          'Batching raises a queue\'s throughput and delays every message arriving just after a '
            + 'batch closes.',
          'A GPU runs thousands of threads to hide memory latency, and each thread is far slower '
            + 'than a CPU thread would be.',
          'In every case the question is not "is this faster" but "which of throughput and '
            + 'latency does this workload actually pay for".',
          'A trading system and a batch job want opposite answers from the same hardware.'
        ],
        example: 'Head-of-line blocking in HTTP/1.1 pipelining is precisely this section\'s '
          + 'latency cost, which is why HTTP/2 multiplexes and QUIC goes further.'
      }
    ],

    'structural-hazards': [
      {
        term: 'A structural hazard is two stages wanting one resource',
        diagram: {
          definition: [
            'flowchart TB',
            '    IF["fetch: wants an instruction"] --> P{"one memory port"}',
            '    MEM["memory stage: wants a word"] --> P',
            '    P -->|"the older instruction wins"| G["the data access proceeds"]',
            '    P -->|"the younger one waits"| S["a bubble enters behind the fetch"]'
          ].join('\n'),
          caption: 'Nothing about the program is wrong and no value is missing. The machine '
            + 'simply does not have enough of something.'
        },
        plain: 'Not a missing value — a missing resource.',
        formal: 'the fetch stage cannot read while the memory stage is using the only port',
        detail: [
          'This is the easiest hazard to reason about and the most expensive to remove, because '
            + 'the removal is more hardware rather than more wiring.',
          'It is also the one that is entirely a property of the design rather than of the '
            + 'program.',
          'The same instructions on a machine with two memory ports have no structural hazard at '
            + 'all.',
          'That is not true of a data or control hazard.'
        ],
        example: 'On the factorial, one memory costs 16 cycles of 161 — about 10% — and two '
          + 'memories cost a whole extra memory.'
      },
      {
        term: 'The older instruction wins, and that rule is not optional',
        plain: 'Priority goes to whichever instruction is further down the pipeline.',
        formal: 'an in-order machine that lets a younger instruction finish first is not in-order',
        detail: [
          'Giving the port to the fetch stage instead would let a younger instruction proceed '
            + 'while an older one waited.',
          'That breaks the ordering the whole machine depends on, and which the precise-exception '
            + 'guarantee of 35.7 is built from.',
          'Every arbiter in every system needs a rule like this.',
          'Most of them state it far less clearly than a pipeline does.'
        ],
        example: 'The fetch stage is the one that stalls, always, and the bubble it creates '
          + 'travels down behind the instruction that took the port.'
      },
      {
        term: 'There are exactly three resolutions, and a fourth that looks like cheating',
        plain: 'Duplicate the resource, pipeline it, stall for it — or split it in time.',
        formal: 'area, complexity or cycles: something is always paid',
        detail: [
          'Duplicating costs a whole second copy.',
          'Pipelining the resource lets it accept a request per cycle even though each takes '
            + 'several, at the cost of latency and real design work.',
          'Stalling costs cycles and is free to build.',
          'The fourth is what a register file actually does: write in one half of the cycle and '
            + 'read in the other. That gets three ports of work out of fewer, at the cost of '
            + 'timing margin.',
          'Which one is right depends entirely on how often the conflict happens.'
        ],
        example: 'Multipliers are pipelined and dividers are not, because divisions are rare '
          + 'enough that stalling for them is cheaper than the hardware would be.'
      },
      {
        term: 'The Harvard split is this fix applied where it is affordable',
        plain: 'Separate instruction and data caches over one unified memory below.',
        formal: 'the conflict is frequent at the first level and rare below it',
        detail: [
          'The M34 single-cycle machine had separate instruction and data memories because it had '
            + 'no choice. It fetches and accesses data in the same cycle.',
          'Real machines make that split real at the first cache level, where the conflict '
            + 'happens every few cycles.',
          'They drop it below, where it happens rarely enough that one port is fine.',
          'That is the general principle: duplicate where the contention is, not everywhere.'
        ],
        example: 'M37 builds the caches that make this split real; the split at the top is why '
          + 'self-modifying code needs an explicit instruction-cache flush.'
      },
      {
        term: 'The cost is a property of the workload, not of the machine',
        plain: 'A program that never touches memory pays nothing for sharing the port.',
        formal: 'the stall count tracks the count of memory instructions, not the program length',
        detail: [
          'That is what makes the duplicate-or-stall decision a measurement rather than an '
            + 'opinion.',
          'Two programs on the same machine can disagree completely about whether the second port '
            + 'was worth building.',
          'It also means a benchmark chosen to justify the hardware will justify it.',
          'That is why the demo runs four programs, including one with no memory instructions at '
            + 'all.'
        ],
        example: 'The sum loop has 0 memory instructions and pays 0 cycles; the factorial has '
          + '19 and pays 16.'
      },
      {
        term: 'A multi-cycle functional unit is the same hazard in slower motion',
        plain: 'An unpipelined divider blocks every later division.',
        formal: 'a unit with a latency of n and no pipelining accepts one request every n cycles',
        detail: [
          'The conflict is the same shape: one resource, several claimants.',
          'But it lasts for many cycles instead of one, so the stall it produces is much larger '
            + 'and much rarer.',
          'That combination is exactly what makes stalling the right answer.',
          'The expected cost is the frequency times the duration, and a rare long stall can be '
            + 'cheaper than a permanent doubling of area.'
        ],
        example: 'Integer divide is typically 20 to 40 cycles and unpipelined on real machines; '
          + 'multiply is 3 to 5 cycles and fully pipelined.'
      },
      {
        term: 'This is a queueing problem, and it has a whole milestone later',
        plain: 'A resource, a stream of requests, a service time, and how many servers to build.',
        formal: 'arrival rate against service rate — the same question M58 answers with maths',
        detail: [
          'The pipeline version has an advantage the software version almost never has.',
          'The contention is counted for you, the stalls are visible, and the cost of the fix is '
            + 'known in advance.',
          'Connection pools, thread pools, service replicas and topic partitions are all the same '
            + 'decision.',
          'Almost all of them are made by intuition, because nobody measured the queue.'
        ],
        example: 'The same "duplicate or wait" question, with the same arrival-rate and '
          + 'service-time inputs, at four completely different scales.'
      },
      {
        term: 'A structural stall is invisible in the answer and visible in the cycle count',
        plain: 'The program computes exactly the same thing, more slowly.',
        formal: 'no architectural state depends on whether the port was shared',
        detail: [
          'That is what makes it a performance problem rather than a correctness one, and it is '
            + 'why it can survive in a design for a long time.',
          'Nothing fails. A benchmark is a few per cent slower than the model predicted, and the '
            + 'model was probably wrong about something else too.',
          'Attributing the cycles is the only way it becomes visible.',
          'That is why the demo\'s attribution table has a row for it.'
        ],
        example: 'The array-maximum program computes 37 with one memory and with two; only the '
          + 'cycle count moves, from 65 to 62.'
      }
    ],

    'data-hazards-and-forwarding': [
      {
        term: 'A data hazard is reading a register that has not been written yet',
        diagram: {
          definition: [
            'flowchart LR',
            '    P["producer: computes at the end of execute"] --> EXM["EX/MEM latch"]',
            '    EXM --> MWB["MEM/WB latch"]',
            '    MWB --> RF["register file: written here, two stages later"]',
            '    EXM -->|"forward, priority 1"| C["consumer in execute"]',
            '    MWB -->|"forward, priority 2"| C',
            '    RF --> C'
          ].join('\n'),
          caption: 'The value exists two stages before it reaches the place the consumer would '
            + 'normally look. Forwarding sends it from where it is.'
        },
        plain: 'The value exists; it is just not in the register file yet.',
        formal: 'a result is computed at the end of execute and written back two stages later',
        detail: 'A machine that only reads the register file gets a stale value for any '
          + 'instruction whose producer is still in flight, which on a five-stage pipeline '
          + 'means the two instructions ahead of it. There are only two possible fixes: wait '
          + 'until the value arrives, or fetch it from the latch it is currently sitting in. '
          + 'The second is forwarding, it costs two multiplexers and some comparators, and it '
          + 'removes almost every stall a dependency chain would otherwise pay.',
        example: 'Without forwarding a four-instruction dependency chain takes 15 cycles; with '
          + 'it, 9.'
      },
      {
        term: 'Read-after-write is the only kind that can happen in order',
        plain: 'The other two need instructions to finish out of order.',
        formal: 'WAR needs a later write before an earlier read; WAW needs out-of-order completion',
        detail: 'Write-after-read cannot happen because reads happen in program order and '
          + 'before any later instruction\'s write; write-after-write cannot happen because '
          + 'write-back is in order. Both reappear the moment M36 lets instructions complete '
          + 'out of order, and register renaming exists precisely to remove them — they are not '
          + 'real dependences on data, only on the reuse of a register name.',
        example: 'Three of the four dependence kinds are impossible here, and all three become '
          + 'hardware structures in the next milestone.'
      },
      {
        term: 'The most recent producer wins, and getting that backwards is the classic bug',
        plain: 'Check the EX/MEM latch before the MEM/WB one.',
        formal: 'two instructions ahead may both write the register you are reading',
        detail: 'When two instructions in a row write the same register, the value you want is '
          + 'the newer one — the instruction one ahead, in EX/MEM — not the one two ahead in '
          + 'MEM/WB. A unit that checks the latches in the other order produces a machine that '
          + 'is correct on almost every program, because it needs two back-to-back writes to '
          + 'the same register and then a read. Hand-written test programs rarely contain that '
          + 'shape; register allocators produce it constantly.',
        example: 'The naive order gets 4 instead of 14 on the double-hazard fixture, and 59 049 '
          + '235 instead of 37 on the array-maximum program.'
      },
      {
        term: 'One hazard cannot be forwarded away at all',
        plain: 'A load\'s value does not exist until the end of the memory stage.',
        formal: 'load-use: the consumer stalls one cycle whatever the wiring',
        detail: 'There is no wire to draw, because the value has not been produced when the '
          + 'consumer needs it. That single unavoidable bubble is the reason instruction '
          + 'scheduling exists as a compiler pass: the hardware cannot remove it, so software '
          + 'fills it with something useful. Every load followed immediately by a use of what '
          + 'it loaded costs a cycle on every in-order machine ever built.',
        example: 'The load-use fixture takes 12 cycles with full forwarding and would take 11 '
          + 'if the stall could be removed.'
      },
      {
        term: 'A compiler removes the stall by filling the slot, not by eliminating it',
        plain: 'Move an unrelated instruction between the load and its use.',
        formal: 'the same 12 cycles, retiring 8 instructions instead of 7',
        detail: 'That is the honest version of what scheduling buys: the bubble is replaced by '
          + 'work rather than deleted. It pays exactly when there is genuinely something else '
          + 'to do, which is why scheduling gets harder in tight loops with short dependency '
          + 'chains and why unrolling helps — it creates independent work to fill slots with.',
        example: 'The scheduled fixture is one instruction longer than the load-use one and '
          + 'takes the same number of cycles.'
      },
      {
        term: 'Forwarding is invisible in the answer and visible in the cycle count',
        plain: 'The program computes the same value either way.',
        formal: 'stalling and forwarding are both correct; only one is fast',
        detail: 'That is what makes the double-hazard bug dangerous: an incorrect forwarding '
          + 'unit is also invisible in the cycle count, and only wrong in the answer, and only '
          + 'on programs with a particular shape. So the check that catches it cannot be a '
          + 'performance measurement or a hand-written test — it has to be a differential '
          + 'against a machine that computes the answer a different way.',
        example: 'All three forwarding units produce 30 on the chain fixture; only the naive '
          + 'one is wrong on the double hazard.'
      },
      {
        term: 'The provenance of an operand is worth displaying',
        plain: 'Register file, EX/MEM forward, MEM/WB forward, or a stall.',
        formal: 'each source operand has exactly one origin per execution',
        detail: 'Forwarding is one of the few mechanisms that is genuinely hard to believe '
          + 'until you can see an operand arriving from somewhere other than the register file. '
          + 'Printing the origin per instruction turns it from a diagram into an observation, '
          + 'and it also makes the load-use case obvious: it is the one where no origin is '
          + 'available and the machine waits instead.',
        example: 'In the double-hazard fixture, four of the operands come from a latch and one '
          + 'from the register file.'
      },
      {
        term: 'A register file that writes early and reads late needs one path fewer',
        plain: 'Write in the first half of the cycle, read in the second.',
        formal: 'the MEM/WB case is then handled by the storage rather than by a forwarding path',
        detail: 'That is why textbook diagrams disagree about whether the second forwarding '
          + 'path exists: it depends on a timing decision inside the register file rather than '
          + 'on the pipeline structure. It is the same trick as the split memory access in the '
          + 'structural-hazard section — pipelining a resource in time instead of duplicating '
          + 'it — and it costs timing margin rather than area.',
        example: 'Both designs are correct and they differ only in where the multiplexer lives, '
          + 'which is a good reminder that a block diagram is not a specification.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
