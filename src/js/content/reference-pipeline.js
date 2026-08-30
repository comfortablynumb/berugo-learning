/** Reference entries for pipelining, structural hazards and forwarding (M35.1-M35.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'pipelining-fundamentals': {
      summary: 'The M34 datapath cut into five stages and run against itself: a stage-by-cycle '
        + 'diagram built from the simulator\'s own cycle log, every cycle attributed to '
        + 'retiring, filling, stalling or flushing with the totals reconciling exactly, and the '
        + 'uncomfortable result that pipelining this particular datapath is slower than not '
        + 'pipelining it.',
      intuition: 'Pipelining raises throughput by making every individual instruction slower, '
        + 'and it only pays once the stages are balanced.',
      formulation: {
        equations: [
          {
            label: 'The sum program on four machines, in gate delays',
            expr: 'machine . cycles . period . total',
            terms: [
              { sym: 'single cycle (M34.4)', meaning: '43 . 178 . 7 654' },
              { sym: 'pipelined, stages as built', meaning: '52 . 151 . 7 852 — 1.03x SLOWER' },
              { sym: 'pipelined, stages balanced', meaning: '52 . 38 . 1 976 — 3.87x faster' },
              { sym: 'balanced and hazard-free', meaning: '47 . 38 . 1 786 — 4.29x faster' }
            ]
          },
          {
            label: 'Why the period barely moved',
            expr: 'the period is the longest stage',
            terms: [
              { sym: 'the ALU', meaning: '148 gate delays of the datapath\'s 175 — 85%' },
              { sym: 'five stages of it', meaning: '148 + 3 = 151, against a single-cycle 178' },
              { sym: 'balanced', meaning: '175 / 5 + 3 = 38' },
              { sym: 'the fix', meaning: 'a carry-lookahead adder from 33.6, not a pipeline change' }
            ]
          },
          {
            label: 'Every cycle accounted for, on the sum program',
            expr: 'cycles = retired + traps + bubbles, charged at write-back',
            terms: [
              { sym: 'instructions retired', meaning: '43' },
              { sym: 'trap committed', meaning: '1 — the closing ecall' },
              { sym: 'filling the pipeline', meaning: '4' },
              { sym: 'flushes', meaning: '4 — two redirects at two cycles each' },
              { sym: 'total', meaning: '52, which is the cycle count exactly' }
            ]
          },
          {
            label: 'What each pipeline register carries',
            expr: 'boundary . contents',
            terms: [
              { sym: 'IF/ID', meaning: 'the instruction word and the address it came from' },
              { sym: 'ID/EX', meaning: 'both source values, the immediate, rd and the control vector' },
              { sym: 'EX/MEM', meaning: 'the ALU result, the store data and rd' },
              { sym: 'MEM/WB', meaning: 'the value to write back and rd' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The pipelined machine agrees with the M34 behavioural simulator',
          why: 'It has its own register file and operand selection, so agreement is evidence.',
          breaks: 'Checked at the same retire count on every program and every configuration.'
        },
        {
          name: 'Every cycle is attributed, and the totals reconcile',
          why: 'A model whose cycles do not add up is measuring something it has not described.',
          breaks: 'Each empty write-back cycle is charged to the bubble that arrived there.'
        },
        {
          name: 'Both machines are compared in gate delays',
          why: 'Cycles are not comparable when the cycle lengths differ.',
          breaks: '52 cycles at 151 against 43 at 178.'
        },
        {
          name: 'The stage diagram comes from the cycle log, not a second walk',
          why: 'A picture derived separately from the numbers can disagree with them.',
          breaks: 'Rows and cells are read out of the same log the summary counts.'
        }
      ],
      complexity: [
        { operation: 'one instruction, throughput', average: 'one cycle once the pipeline is full', worst: 'plus stalls and flushes' },
        { operation: 'one instruction, latency', average: '5 periods — 755 gate delays here', worst: 'worse than the 178 an unpipelined machine took' },
        { operation: 'filling the pipeline', average: '4 cycles', worst: 'paid again after every trap' },
        { operation: 'a stall', average: '1 cycle', worst: '2 without forwarding' },
        { operation: 'a redirect', average: '2 cycles resolving in execute', worst: 'grows with depth — 16 at twenty stages' }
      ],
      failureModes: [
        {
          symptom: 'A pipelined design is no faster than the machine it replaced.',
          cause: 'The stages are unbalanced, so the period is set by one fat stage.',
          fix: 'Balance first. Here the ALU is 85% of the logic delay and the fix is a better adder.'
        },
        {
          symptom: 'A latency-sensitive workload gets worse after a throughput optimisation.',
          cause: 'Overlap raises throughput by making each unit of work take longer.',
          fix: 'Decide which the workload pays for before optimising either.'
        },
        {
          symptom: 'A cycle-count model that is nearly right.',
          cause: 'The attribution was derived from events rather than charged at the commit point.',
          fix: 'Charge each empty cycle to the bubble that reached write-back; it is exact.'
        },
        {
          symptom: 'A stage reads a value that has been overwritten.',
          cause: 'A field was not carried in the pipeline register and was looked up later.',
          fix: 'Everything a later stage needs must travel; there is nowhere to look it up.'
        },
        {
          symptom: 'IPC improves and the program gets slower.',
          cause: 'The clock period moved the other way and only one factor was quoted.',
          fix: 'Report the product. This is the M34.6 lesson, unchanged.'
        }
      ],
      inTheWild: [
        'Every RISC processor since the early 1980s, and the classic five-stage teaching model.',
        'HTTP request pipelining, and the head-of-line blocking that made HTTP/2 multiplex.',
        'Batching in message queues: throughput up, tail latency up with it.',
        'GPU warps, which hide memory latency by making every individual thread much slower.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, chapter 4', note: 'the five-stage pipeline, at length' },
        { title: 'Hennessy and Patterson — Computer Architecture: A Quantitative Approach, appendix C', note: 'the same machine with the quantitative treatment' },
        { title: 'Kogge — The Architecture of Pipelined Computers (1981)', note: 'the general theory, before it was only about processors' },
        { title: 'Hartstein and Puzak — The optimum pipeline depth for a microprocessor (ISCA 2002)', note: 'where balance and overhead stop paying' }
      ]
    },

    'structural-hazards': {
      summary: 'The same four programs run with one memory and with two, so the cost of sharing '
        + 'a port is measured per workload rather than assumed: nothing on a program with no '
        + 'loads, and about ten per cent on the load-heavy ones.',
      intuition: 'Two stages want one resource; duplicate it, pipeline it, or wait for it.',
      formulation: {
        equations: [
          {
            label: 'One memory or two, measured',
            expr: 'program . memory instructions . unified . split . cost',
            terms: [
              { sym: 'sum', meaning: '0 . 52 . 52 . nothing' },
              { sym: 'arrayMax', meaning: '6 . 65 . 62 . 3 cycles (4.8%)' },
              { sym: 'strlen', meaning: '6 . 51 . 46 . 5 cycles (10.9%)' },
              { sym: 'factorial', meaning: '19 . 177 . 161 . 16 cycles (9.9%)' }
            ]
          },
          {
            label: 'The four resolutions',
            expr: 'resolution . cost . where it is right',
            terms: [
              { sym: 'duplicate', meaning: 'area and power . when the conflict is frequent' },
              { sym: 'pipeline the resource', meaning: 'latency and complexity . a multiplier' },
              { sym: 'stall', meaning: 'cycles . when the conflict is rare — a divider' },
              { sym: 'split in time', meaning: 'timing margin . a register file writing early and reading late' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The older instruction always wins the resource',
          why: 'Letting the younger one proceed would break in-order completion.',
          breaks: 'The fetch stage is the one that stalls, without exception.'
        },
        {
          name: 'The answer is identical either way',
          why: 'A structural hazard is a performance problem, never a correctness one.',
          breaks: 'Both configurations match the behavioural simulator with zero differences.'
        },
        {
          name: 'The cost tracks the memory-instruction count, not the program length',
          why: 'It makes the decision a property of the workload.',
          breaks: 'The sum loop has none and pays nothing; the factorial has 19 and pays 16 cycles.'
        }
      ],
      complexity: [
        { operation: 'unified memory, per data access', average: '1 stall cycle', worst: 'one per load or store, always' },
        { operation: 'split memories', average: 'no stall', worst: 'the area and power of a second memory' },
        { operation: 'single-ported register file', average: 'resolved by splitting the cycle', worst: 'a stall, on a design without that trick' },
        { operation: 'unpipelined divider', average: 'no stall when divisions are rare', worst: 'the whole latency, blocking every later division' },
        { operation: 'deciding between them', average: 'one measurement of the workload', worst: 'a benchmark chosen to prove the answer you wanted' }
      ],
      failureModes: [
        {
          symptom: 'A benchmark is a few per cent slower than the model predicted.',
          cause: 'Contention for a shared resource, invisible in the results.',
          fix: 'Attribute the cycles. Nothing else will surface it.'
        },
        {
          symptom: 'Hardware duplicated to remove a conflict that never happened.',
          cause: 'The decision was made from the architecture rather than from a workload.',
          fix: 'Count the accesses first; a program with none pays nothing for sharing.'
        },
        {
          symptom: 'A younger instruction finishes before an older one.',
          cause: 'The arbiter gave priority to the wrong stage.',
          fix: 'Priority to the older instruction, always; the ordering is load-bearing.'
        },
        {
          symptom: 'Self-modifying code executes the old instructions.',
          cause: 'The Harvard split is real at the first cache level.',
          fix: 'An explicit instruction-cache flush; this is the split, met in software.'
        },
        {
          symptom: 'A thread pool sized by intuition and permanently wrong.',
          cause: 'The same duplicate-or-queue decision, made without measuring the queue.',
          fix: 'Measure arrival rate and service time; M58 does this with the maths.'
        }
      ],
      inTheWild: [
        'Split first-level instruction and data caches in every modern processor.',
        'Pipelined multipliers and unpipelined dividers, on the same argument.',
        'Register files that write in one half of the cycle and read in the other.',
        'Connection pools, thread pools and partition counts, which are the same decision.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, chapter 4', note: 'structural hazards and the Harvard split' },
        { title: 'Hennessy and Patterson — A Quantitative Approach, appendix C', note: 'the resource-conflict treatment with numbers' },
        { title: 'Kleinrock — Queueing Systems, volume 1', note: 'the general form of duplicate-or-wait' },
        { title: 'Jouppi — Cache write policies and performance (1993)', note: 'ports, banking and where contention actually appears' }
      ]
    },

    'data-hazards-and-forwarding': {
      summary: 'Five dependency shapes and three forwarding units, with every answer checked '
        + 'against the M34 behavioural simulator — including a naive unit that checks the '
        + 'pipeline latches in the wrong order and is correct on four fixtures out of five and '
        + 'wrong on a real program.',
      intuition: 'The value exists two stages before it reaches the register file; forwarding '
        + 'sends it from where it is.',
      formulation: {
        equations: [
          {
            label: 'Five fixtures, three forwarding units',
            expr: 'fixture . full . naive . none',
            terms: [
              { sym: 'chain', meaning: '9 cycles, 30 . 9 cycles, 30 . 15 cycles, 30' },
              { sym: 'double hazard', meaning: '10 cycles, 14 . 10 cycles, 4 (WRONG) . 16 cycles, 14' },
              { sym: 'load-use', meaning: '12 cycles, 43 . 12 cycles, 43 . 17 cycles, 43' },
              { sym: 'scheduled', meaning: '12 cycles, 43 . 12 cycles, 43 . 17 cycles, 43' },
              { sym: 'independent', meaning: '9 cycles, 4 . 9 cycles, 4 . 9 cycles, 4' }
            ]
          },
          {
            label: 'The naive unit on a real program',
            expr: 'array maximum, which contains the double-hazard shape',
            terms: [
              { sym: 'correct forwarding', meaning: '37, which is the answer' },
              { sym: 'MEM/WB checked first', meaning: '59 049 235' },
              { sym: 'why it survives testing', meaning: 'the shape needs a register allocator to produce it' }
            ]
          },
          {
            label: 'Which dependences can occur in an in-order pipeline',
            expr: 'kind . possible here . where it does happen',
            terms: [
              { sym: 'read after write', meaning: 'yes — the only one, and forwarding answers it' },
              { sym: 'write after read', meaning: 'no — reads happen in order' },
              { sym: 'write after write', meaning: 'no — write-back is in order' },
              { sym: 'both of the above', meaning: 'M36, where renaming exists to remove them' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The most recent producer wins',
          why: 'EX/MEM holds a newer value than MEM/WB when both wrote the same register.',
          breaks: 'Reversing the order gives 4 instead of 14 on the double-hazard fixture.'
        },
        {
          name: 'A load in the memory stage is not a forwarding source',
          why: 'The value does not exist yet; that is the load-use hazard.',
          breaks: 'The detection unit arranges a stall rather than the forwarding unit lying.'
        },
        {
          name: 'Every answer is checked against a machine that shares no code',
          why: 'A wrong forwarding unit is invisible in the cycle count and in most tests.',
          breaks: 'The fixtures pass with the naive unit; the real program does not.'
        },
        {
          name: 'Correctness is independent of forwarding',
          why: 'Stalling is also correct — only the cycle count differs.',
          breaks: 'The no-forwarding column computes every fixture correctly and more slowly.'
        }
      ],
      complexity: [
        { operation: 'arithmetic to arithmetic', average: 'forwarded, no stall', worst: 'unchanged' },
        { operation: 'load to the next instruction', average: '1 stall, unavoidable', worst: '1 — no wiring removes it' },
        { operation: 'any dependence, no forwarding', average: '2 stalls if adjacent, 1 if two apart', worst: '6 cycles on a four-instruction chain' },
        { operation: 'the forwarding unit', average: 'two comparators and a multiplexer per operand', worst: 'plus one per extra pipeline stage' },
        { operation: 'instruction scheduling', average: 'fills the slot with useful work', worst: 'nothing to fill it with, in a tight loop' }
      ],
      failureModes: [
        {
          symptom: 'A machine passes every hand-written test and fails on compiler output.',
          cause: 'The double hazard: two back-to-back writes to one register, then a read.',
          fix: 'Check EX/MEM before MEM/WB, and test against a differential oracle.'
        },
        {
          symptom: 'A dependency chain runs at a third of the expected speed.',
          cause: 'No forwarding: every dependent instruction waits for write-back.',
          fix: 'The two forwarding paths; they are the difference between 15 cycles and 9.'
        },
        {
          symptom: 'A stall that no amount of forwarding removes.',
          cause: 'Load-use — the value does not exist until the memory stage ends.',
          fix: 'Schedule an unrelated instruction into the slot; the hardware cannot help.'
        },
        {
          symptom: 'The hazard detection unit never fires, and the machine is still correct.',
          cause: 'The latch mapping is off by one, and forwarding hides it.',
          fix: 'The instruction ahead of decode is in EXECUTE, not memory. Count the stalls.'
        },
        {
          symptom: 'Reordering that looks obviously legal is rejected by the compiler.',
          cause: 'A dependence through a register name rather than through data.',
          fix: 'Nothing here — that is what M36 renames away.'
        }
      ],
      inTheWild: [
        'Every in-order pipeline ever built, and the forwarding networks that grow with depth.',
        'Instruction scheduling in every optimising compiler, and why its output looks reordered.',
        'The load-use latency published in every processor optimisation manual.',
        'Register renaming in M36, which exists to remove the two dependence kinds this machine cannot have.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, chapter 4', note: 'the forwarding unit and the hazard detection unit' },
        { title: 'Hennessy and Patterson — A Quantitative Approach, appendix C', note: 'the dependence taxonomy and what each costs' },
        { title: 'Intel 64 and IA-32 Optimization Reference Manual', note: 'the load-use latencies that instruction scheduling is written against' },
        { title: 'Muchnick — Advanced Compiler Design and Implementation, chapter 17', note: 'instruction scheduling, which is the software half of this section' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
