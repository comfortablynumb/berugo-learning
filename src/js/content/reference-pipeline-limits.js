/** Reference entries for precise exceptions, depth and pipeline-friendly code (M35.7-M35.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'precise-exceptions-pipelined': {
      summary: 'Five fault classes raised by programs that run, with the architectural state at '
        + 'the handler compared against the M34 behavioural simulator at the same retire count '
        + '— five instructions in flight producing exactly the state of a machine with one.',
      intuition: 'The squash is immediate so nothing younger has an effect; the trap commits at '
        + 'write-back so everything older finishes.',
      formulation: {
        equations: [
          {
            label: 'Every fault class, and the stage that detects it',
            expr: 'class . stage . cause . mepc',
            terms: [
              { sym: 'environment call', meaning: 'execute . 11 . the ecall itself' },
              { sym: 'illegal instruction', meaning: 'decode . 2 . mtval holds the offending word' },
              { sym: 'misaligned load', meaning: 'memory . 4 . mtval holds 0x10000001' },
              { sym: 'misaligned store', meaning: 'memory . 6 . mtval holds 0x10000002' },
              { sym: 'unmapped load', meaning: 'memory . 5 . mtval holds 0x40000000' }
            ]
          },
          {
            label: 'One misaligned load, cycle by cycle',
            expr: 'what happens and when',
            terms: [
              { sym: 'cycle 5', meaning: 'detected in the memory stage; everything younger squashed' },
              { sym: 'cycle 6', meaning: 'the trap commits at write-back' },
              { sym: 'instructions squashed', meaning: '5, none of which committed anything' },
              { sym: 'registers against the reference', meaning: '0 differences' }
            ]
          },
          {
            label: 'The four requirements, and how they are kept',
            expr: 'requirement . mechanism',
            terms: [
              { sym: 'everything older completed', meaning: 'the trap commits at write-back' },
              { sym: 'nothing younger had an effect', meaning: 'squash at detection, not at commit' },
              { sym: 'mepc names the faulting instruction', meaning: 'the address travels with it from fetch' },
              { sym: 'a wrong-path fault never commits', meaning: 'the flag is squashed with its instruction' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The state at the handler matches a strictly in-order machine',
          why: 'That is the definition of precise, and it is checkable rather than argued.',
          breaks: 'Zero register differences on all five classes at the same retire count.'
        },
        {
          name: 'A speculative instruction carries a speculative exception',
          why: 'Fetch runs past the end of mispredicted branches and decodes zeros.',
          breaks: 'Acting on those flags freezes the machine at the first mispredicted loop exit.'
        },
        {
          name: 'mret and control-register writes drain the pipeline',
          why: 'There is no forwarding path from a control register.',
          breaks: 'A six-instruction handler drains the machine twice.'
        }
      ],
      complexity: [
        { operation: 'trap entry', average: '4 register writes and a redirect', worst: 'plus the drain, which is the larger cost' },
        { operation: 'detection to commit', average: '1 cycle for a memory fault', worst: 'up to 4, for a fault detected at fetch' },
        { operation: 'squashing', average: 'every stage younger than the fault', worst: 'the whole machine, on a deep pipeline' },
        { operation: 'a serialising instruction', average: 'a full pipeline drain', worst: '2 drains per trap handler here' },
        { operation: 'precision, out of order', average: 'a reorder buffer entry per instruction', worst: 'plus a rename map and a store buffer — the whole of M36' }
      ],
      failureModes: [
        {
          symptom: 'The machine executes two instructions and stops.',
          cause: 'A wrong-path fetch raised an illegal-instruction flag and nothing unfroze it.',
          fix: 'Clear the freeze when the redirect squashes the instruction carrying the fault.'
        },
        {
          symptom: 'A handler sees a register that a younger instruction wrote.',
          cause: 'The squash waited for the commit point instead of happening at detection.',
          fix: 'Squash immediately; commit late. Both halves, and neither alone.'
        },
        {
          symptom: 'A trap handler loops forever on the same instruction.',
          cause: 'mepc was not advanced, or mret read a stale mepc.',
          fix: 'Advance it for a fault the handler cannot repair, and serialise around the write.'
        },
        {
          symptom: 'A handler reads mcause and gets zero.',
          cause: 'The control register was read at write-back, so the next instruction forwarded a zero.',
          fix: 'Read the CSR in execute and write it at commit. This bug made the demo trap 17 times.'
        },
        {
          symptom: 'A page-fault handler cannot restart the access it fixed.',
          cause: 'mepc pointed at the following instruction.',
          fix: 'Save the faulting address; that is why mepc is not pc + 4.'
        }
      ],
      inTheWild: [
        'Every debugger, which assumes the state it is shown could have existed.',
        'Page-fault handlers, which fix a mapping and re-run the instruction at mepc.',
        'Reorder buffers, which exist so out-of-order machines can keep this promise.',
        'The syscall cost that io_uring and friends were designed to amortise.'
      ],
      sources: [
        { title: 'Smith and Pleszkun — Implementing precise interrupts in pipelined processors (1988)', note: 'the paper that named the problem and the solutions' },
        { title: 'Patterson and Hennessy — Computer Organization and Design, chapter 4', note: 'exceptions in the five-stage pipeline' },
        { title: 'The RISC-V Privileged Architecture specification', note: 'the exact CSR semantics this machine implements' },
        { title: 'Hennessy and Patterson — A Quantitative Approach, chapter 3', note: 'precision under speculation, which is M36' }
      ]
    },

    'pipeline-depth-limits': {
      summary: 'A four-line model of depth, evaluated over a whole curve rather than at a '
        + 'point: the clock period falls, the register overhead and the branch penalty both '
        + 'rise, and the result has a bottom in the mid thirties for performance and around '
        + 'eighteen for performance per watt.',
      intuition: 'The logic divides; the overhead per stage and the penalty in stages do not.',
      formulation: {
        equations: [
          {
            label: 'The model',
            expr: 'period(k) = ceil(logic / k) + overhead',
            readAs: 'the clock period at depth k is the logic divided by k, rounded up, plus '
              + 'the register overhead',
            terms: [
              { sym: 'penalty(k)', meaning: 'the stages between fetch and branch resolution' },
              { sym: 'CPI(k)', meaning: '1 + hazard stalls + branch rate x mispredict rate x penalty(k)' },
              { sym: 'time', meaning: 'instructions x CPI(k) x period(k)' },
              { sym: 'the defaults', meaning: '175 gate delays of logic and 3 of overhead, measured in M34.4' }
            ]
          },
          {
            label: 'The curve, on a branch-heavy workload',
            expr: 'depth . period . CPI . time',
            terms: [
              { sym: '1', meaning: '178 . 1.238 . 220 275' },
              { sym: '5', meaning: '38 . 1.350 . 51 300' },
              { sym: '20', meaning: '12 . 1.800 . 21 600' },
              { sym: '36', meaning: '8 . 2.287 . 18 300' },
              { sym: '40', meaning: '8 . 2.400 . 19 200 — the curve has turned' }
            ]
          },
          {
            label: 'Where the optimum moves as the overhead becomes realistic',
            expr: 'overhead . fastest depth . most efficient depth',
            terms: [
              { sym: '3 (measured here)', meaning: '35 . 18' },
              { sym: '10', meaning: '25 . 13' },
              { sym: '17 (about ten to one)', meaning: '25 . 8' },
              { sym: 'what was actually built', meaning: 'roughly 14 to 20 stages' }
            ]
          },
          {
            label: 'The industry experiment',
            expr: 'machine . depth . outcome',
            terms: [
              { sym: 'Pentium III / Pentium M', meaning: '10-12 . the line Core was built from' },
              { sym: 'Pentium 4 Willamette', meaning: '20 . high clocks, disappointing work per cycle' },
              { sym: 'Pentium 4 Prescott', meaning: '31 . a thermal ceiling it never got past' },
              { sym: 'everything since', meaning: '14-20 . depth settled and width grew instead' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The whole curve is reported, not only the optimum',
          why: 'The shape is the lesson: steep left, flat right.',
          breaks: 'Undershooting the optimum costs far more than overshooting it.'
        },
        {
          name: 'The efficiency metric is performance cubed per watt',
          why: 'Performance per watt alone is maximised by an arbitrarily slow machine.',
          breaks: 'Every curve would peak at one stage under the simpler ratio.'
        },
        {
          name: 'The defaults are the measured ones, and their unrealism is stated',
          why: 'A model tuned to give a familiar answer proves nothing.',
          breaks: '175 to 3 is a ratio no shipped design has; the overhead is a control.'
        },
        {
          name: 'Power figures are relative, never absolute',
          why: 'Watts need a process and a capacitance this model does not have.',
          breaks: 'Ratios between depths are meaningful; the numbers are not watts.'
        }
      ],
      complexity: [
        { operation: 'period', average: 'ceil(logic / k) + overhead', worst: 'approaches the overhead alone as k grows' },
        { operation: 'branch penalty', average: 'about 0.8k stages here', worst: 'it grows with exactly the thing that shortened the clock' },
        { operation: 'CPI', average: '1 + stalls + branch cost', worst: '2.4 at forty stages on a branchy workload' },
        { operation: 'the optimum', average: 'one pass over the depth range', worst: 'it moves with the workload, so there is no single answer' },
        { operation: 'overshooting the optimum', average: 'a few per cent', worst: 'far cheaper than undershooting it' }
      ],
      failureModes: [
        {
          symptom: 'A deeper pipeline with a higher clock that is slower on real work.',
          cause: 'CPI rose faster than the period fell.',
          fix: 'Evaluate the product. This is the Pentium 4, and it cost a great deal to learn.'
        },
        {
          symptom: 'A model that recommends a depth nobody ever built.',
          cause: 'The logic-to-overhead ratio is unrealistic, or power is not modelled.',
          fix: 'State the ratio, expose it as a control, and report the efficiency optimum too.'
        },
        {
          symptom: 'A performance-per-watt metric that prefers doing nothing.',
          cause: 'Power falls faster than speed, so the ratio rewards slowness.',
          fix: 'Cube the performance term, which is what the literature does.'
        },
        {
          symptom: 'One pipeline that suits neither of two important workloads.',
          cause: 'The optimum depth is a property of the workload, and only one machine gets built.',
          fix: 'Nothing clean — this is the central compromise of general-purpose design.'
        },
        {
          symptom: 'A service split into stages that is slower than the monolith.',
          cause: 'The same overhead-per-stage argument, with a network hop as the register.',
          fix: 'Measure the boundary cost before deciding how many boundaries to have.'
        }
      ],
      inTheWild: [
        'The Pentium 4 and the Pentium M, which is this model run as a public experiment.',
        'The end of frequency scaling, and the turn to width and core count instead.',
        'Hartstein and Puzak\'s optimum-depth result, which this model reproduces in shape.',
        'Microservice decomposition, which is the same arithmetic with far more expensive boundaries.'
      ],
      sources: [
        { title: 'Hartstein and Puzak — The optimum pipeline depth for a microprocessor (ISCA 2002)', note: 'the performance optimum, derived' },
        { title: 'Hartstein and Puzak — Optimum power/performance pipeline depth (MICRO 2003)', note: 'and why the power-aware answer is about half of it' },
        { title: 'Hennessy and Patterson — A Quantitative Approach, chapter 3', note: 'depth against width, with the history' },
        { title: 'Sprangle and Carmean — Increasing processor performance by implementing deeper pipelines (ISCA 2002)', note: 'the case for depth, argued by the people who built the Pentium 4' }
      ]
    },

    'pipeline-friendly-code': {
      summary: 'The sorted-versus-shuffled result reproduced with mispredict counts rather than '
        + 'only timings, plus a branchless variant that is insensitive to data order, is 16% '
        + 'slower on this machine, and would be nearly twice as fast on a deep one — with the '
        + 'break-even penalty computed rather than asserted.',
      intuition: 'A branch costs nothing when predictable; branchless code costs its extra '
        + 'instructions always.',
      formulation: {
        equations: [
          {
            label: 'The branch laboratory: 64 values, one threshold, one answer',
            expr: 'shape . order . instructions . mispredicts . cycles',
            terms: [
              { sym: 'branchy, sorted', meaning: '424 . 4 . 503' },
              { sym: 'branchy, shuffled', meaning: '424 . 34 . 563' },
              { sym: 'branchless, sorted', meaning: '581 . 1 . 654' },
              { sym: 'branchless, shuffled', meaning: '581 . 1 . 654' },
              { sym: 'the answer', meaning: '6 947 in all four' }
            ]
          },
          {
            label: 'Where the 60 cycles went',
            expr: 'sorted against shuffled, branchy',
            terms: [
              { sym: 'extra mispredicts', meaning: '34 - 4 = 30' },
              { sym: 'at 2 cycles each', meaning: '60 cycles' },
              { sym: 'measured difference', meaning: '563 - 503 = 60 — the whole of it' }
            ]
          },
          {
            label: 'The same code on four machines',
            expr: 'penalty . branchy shuffled . branchless . winner',
            terms: [
              { sym: '2 cycles (this pipeline)', meaning: '563 . 654 . branchy' },
              { sym: '5 cycles', meaning: '665 . 657 . branchless' },
              { sym: '10 cycles', meaning: '835 . 662 . branchless' },
              { sym: '20 cycles', meaning: '1 175 . 672 . branchless' },
              { sym: 'break-even', meaning: 'about 4.8 cycles of penalty' }
            ]
          },
          {
            label: 'The two inner loops',
            expr: 'branchy . branchless',
            terms: [
              { sym: 'the load', meaning: 'lw a4, 0(a0) . the same' },
              { sym: 'the test', meaning: 'blt a4, a2, skip . slt a5, a4, a2' },
              { sym: 'the mask', meaning: '— . addi a5, a5, -1 then and a6, a4, a5' },
              { sym: 'the add', meaning: 'add a3, a3, a4, conditionally . add a3, a3, a6, always' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'All four runs compute the same answer',
          why: 'A performance comparison between programs that compute different things is nothing.',
          breaks: '6 947 in every configuration, from the same 64 values.'
        },
        {
          name: 'The sorted and shuffled runs execute the same instructions',
          why: 'It rules out the loop doing different work.',
          breaks: '424 instructions in both; only the mispredict count differs.'
        },
        {
          name: 'Mispredicts are counted, not inferred from timing',
          why: 'A timing difference admits a dozen explanations and a counter admits one.',
          breaks: '30 extra mispredicts at 2 cycles is exactly the 60-cycle difference.'
        },
        {
          name: 'The break-even penalty is computed from the measurements',
          why: 'It turns a machine-dependent recommendation into a number.',
          breaks: '91 extra cycles over 33 avoided mispredicts gives about 4.8.'
        }
      ],
      complexity: [
        { operation: 'a predicted branch', average: 'free', worst: 'free' },
        { operation: 'a mispredicted branch', average: 'the penalty — 2 cycles here', worst: '15 to 20 on a deep core' },
        { operation: 'the branchless mask', average: '3 extra instructions per element, always', worst: 'the same; it is unconditional' },
        { operation: 'sorting the data first', average: 'n log n, amortised over the passes', worst: 'impossible when the data cannot be reordered' },
        { operation: 'measuring which case you are in', average: 'one profiler run', worst: 'free; every processor counts branch misses' }
      ],
      failureModes: [
        {
          symptom: 'A branchless rewrite that made the code slower.',
          cause: 'The branch was predictable, so the extra instructions bought nothing.',
          fix: 'Read the mispredict counter before rewriting; it answers the question directly.'
        },
        {
          symptom: 'A benchmark that shows a large win and production that shows none.',
          cause: 'The test data was sorted, or otherwise more predictable than the real thing.',
          fix: 'Benchmark on representative data, and report mispredicts as well as time.'
        },
        {
          symptom: 'Advice that contradicts itself between two articles.',
          cause: 'They assumed different misprediction penalties and neither said so.',
          fix: 'The break-even is about 5 cycles; state the machine and the advice stops conflicting.'
        },
        {
          symptom: 'Loop unrolling that does not fix the branch problem.',
          cause: 'It removes loop-control branches, which were predictable anyway.',
          fix: 'Unroll for the other reasons; the data-dependent branch needs a different fix.'
        },
        {
          symptom: 'A hot loop dominated by a virtual call.',
          cause: 'An indirect target, which is far harder to predict than a direction.',
          fix: 'Devirtualise or hoist it out; this is what profile-guided optimisation targets.'
        }
      ],
      inTheWild: [
        'The most-upvoted question on Stack Overflow, which is this measurement without the counter.',
        'perf stat branch-misses, and the per-address reports every profiler can produce.',
        'Branchless binary search and sorting networks, which win exactly where the branch is unpredictable.',
        'Conditional move instructions, and the compiler heuristics that decide when to emit them.'
      ],
      sources: [
        { title: 'Hennessy and Patterson — A Quantitative Approach, chapter 3', note: 'branch behaviour in real workloads' },
        { title: 'Intel 64 and IA-32 Optimization Reference Manual', note: 'misprediction penalties and conditional-move guidance' },
        { title: 'Agner Fog — Optimizing subroutines in assembly language', note: 'the branchless techniques, with measured caveats' },
        { title: 'Brodal and Moruz — Tradeoffs between branch mispredictions and comparisons (2005)', note: 'the theory behind the crossover this section measures' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
