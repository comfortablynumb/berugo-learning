/** Reference entries for issue width, speculation and memory parallelism (M36.4-M36.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'superscalar-issue': {
      summary: 'The width curve for twelve programs with the reason each one stopped rising '
        + 'named rather than guessed: the code\'s own dependence bound, a port ceiling visible '
        + 'in the issue histogram, a front end that ran out, or a back end that refused. The '
        + 'classification is ordered so that the code\'s limit is checked before any question '
        + 'about the machine.',
      intuition: 'Width is permission to issue, not a speed-up, and four different situations '
        + 'produce the same flat graph.',
      formulation: {
        equations: [
          {
            label: 'Eight times the width, across the catalogue',
            expr: 'program . width 1 . width 8 . gain',
            terms: [
              { sym: 'chain', meaning: '38 . 38 . 1.00x - a dependence chain' },
              { sym: 'chase', meaning: '413 . 393 . 1.05x - memory serialisation' },
              { sym: 'independent', meaning: '37 . 21 . 1.76x - two integer ports' },
              { sym: 'alias', meaning: '64 . 27 . 2.37x - the best in the catalogue' }
            ]
          },
          {
            label: 'The issue histogram of independent at width 4',
            expr: 'instructions issued in a cycle . how many cycles',
            terms: [
              { sym: '0', meaning: '4 cycles' },
              { sym: '2', meaning: '17 cycles' },
              { sym: '3 or more', meaning: 'never, because there are two integer ports' },
              { sym: 'the average', meaning: 'IPC 1.524, which hides all of this' }
            ]
          },
          {
            label: 'What the width costs the hardware',
            expr: 'structure . at width 4 . at width 8',
            terms: [
              { sym: 'wakeup comparators', meaning: '128 . 256, at a 32-entry window' },
              { sym: 'select', meaning: 'pick 4 of 32 . pick 8 of 32, and deeper' },
              { sym: 'register file ports', meaning: '8 read and 4 write . 16 read and 8 write' },
              { sym: 'bypass paths', meaning: '16 . 64, growing with the square of the width' }
            ]
          },
          {
            label: 'Latency against initiation interval',
            expr: 'the two numbers a port has',
            terms: [
              { sym: 'latency', meaning: 'when the result appears: 2 cycles for a load here' },
              { sym: 'initiation interval', meaning: 'when the next may start: 1 cycle, pipelined' },
              { sym: 'conflating them', meaning: 'halves every port and caps the machine near IPC 1' },
              { sym: 'the tell', meaning: 'the saturation point stops depending on the program' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No port issues twice in one cycle',
          why: 'A port with an initiation interval of one accepts one operation per cycle.',
          breaks: 'The port records the cycle it is next free and select checks it.'
        },
        {
          name: 'The reported IPC matches an independent recount of the event log',
          why: 'A summary counter and the log it summarises can drift apart.',
          breaks: 'Commit events are counted from the log and compared with the retire counter.'
        },
        {
          name: 'Instructions issued in a cycle never exceed the issue width',
          why: 'It is the definition of the control.',
          breaks: 'Select stops at the width; the histogram shows the distribution underneath.'
        },
        {
          name: 'The limiting factor is decided in a fixed order',
          why: 'Nothing about the machine is interesting once the code\'s own bound is reached.',
          breaks: 'Bound first, then whether doubling still helps, then the machine\'s accounting.'
        }
      ],
      complexity: [
        { operation: 'issue one instruction', average: 'one port reservation and one queue removal', worst: 'a port conflict, which costs a cycle of waiting' },
        { operation: 'wakeup', average: 'one comparison per waiting entry', worst: 'the whole window, every cycle' },
        { operation: 'select', average: 'a scan of the queue in age order up to the width', worst: 'the whole queue when nothing is ready' },
        { operation: 'the width sweep', average: 'one run per width per program', worst: 'cached, because four sections quote it' }
      ],
      failureModes: [
        {
          symptom: 'A wider machine is no faster and the reason is not identified.',
          cause: 'The four possible causes were not distinguished, so the wrong one was fixed.',
          fix: 'Check the dependence bound, then the port histogram, then the stall reasons.'
        },
        {
          symptom: 'IPC saturates near 1.0 whatever the width and whatever the program.',
          cause: 'Result latency was used as the port occupancy, halving every unit.',
          fix: 'Separate latency from the initiation interval; a pipelined unit takes one per cycle.'
        },
        {
          symptom: 'A machine four wide behaves like one two wide.',
          cause: 'The instruction mix does not match the port mix.',
          fix: 'Read the per-port utilisation; a port busy in most cycles is the answer.'
        },
        {
          symptom: 'The average IPC looks acceptable and the program is slow.',
          cause: 'The distribution is bimodal: many cycles issue nothing and a few issue the width.',
          fix: 'Report the histogram; the average of a spiky distribution describes no cycle.'
        },
        {
          symptom: 'A width increase is quoted as a speed-up.',
          cause: 'One factor of a three-term product was reported alone.',
          fix: 'Report the product, as in M34.6; a wider machine usually has a longer clock.'
        }
      ],
      inTheWild: [
        'The four-to-six wide plateau in every mainstream core since the mid 1990s.',
        'Micro-operation caches and loop buffers, which exist to feed a wide back end past a branch.',
        'The move from wider cores to more cores once the select network stopped scaling.',
        'Thread pools and worker counts, where the same four questions apply in the same order.'
      ],
      sources: [
        { title: 'Palacharla, Jouppi and Smith - Complexity-Effective Superscalar Processors (1997)', note: 'why wakeup and select set the limit' },
        { title: 'Agner Fog - The Microarchitecture of Intel, AMD and VIA CPUs', note: 'port mixes and issue widths, generation by generation' },
        { title: 'Hennessy and Patterson - Computer Architecture: A Quantitative Approach, chapter 3', note: 'multiple issue and its limits' },
        { title: 'Smith and Sohi - The Microarchitecture of Superscalar Processors (1995)', note: 'the survey that names the structures' }
      ]
    },

    'speculation-and-recovery': {
      summary: 'The four things this machine guesses, the two recovery mechanisms they need, '
        + 'and the work thrown away when a guess is wrong. Memory dependence speculation is '
        + 'measured on a fixture pair built so the control can actually bite, because the '
        + 'obvious pair resolves its addresses too early to measure anything.',
      intuition: 'Speculation buys time with energy, and being wrong is cheap only because a '
        + 'predictor stops you being wrong twice.',
      formulation: {
        equations: [
          {
            label: 'Memory dependence speculation, on the pair that can show it',
            expr: 'program . conservative . speculative . gain',
            terms: [
              { sym: 'disjoint', meaning: '39 . 39 . 1.00x - both addresses ready in cycle 1' },
              { sym: 'alias', meaning: '28 . 28 . 1.00x - the same reason' },
              { sym: 'hiddenDisjoint', meaning: '59 . 43 . 1.37x - the store address arrives late' },
              { sym: 'hiddenAlias', meaning: '60 . 61 . 0.98x - wrong every iteration, and it costs one cycle' }
            ]
          },
          {
            label: 'Why being wrong is cheap: the store-set predictor',
            expr: 'hiddenAlias, speculating',
            terms: [
              { sym: 'iterations that alias', meaning: '8' },
              { sym: 'misspeculations', meaning: '2' },
              { sym: 'store sets learned', meaning: '1, after which that load waits' },
              { sym: 'the consequence', meaning: 'the cost is set by the learning rate, not the loop count' }
            ]
          },
          {
            label: 'Wasted work, per program at width 4',
            expr: 'program . retired . fetched . wasted',
            terms: [
              { sym: 'chain', meaning: '33 . 36 . 2.8%' },
              { sym: 'strlen', meaning: '31 . 49 . 32.7%' },
              { sym: 'factorial', meaning: '124 . 323 . 61.0%' },
              { sym: 'arrayMax', meaning: '42 . 136 . 67.6%' }
            ]
          },
          {
            label: 'A deeper window speculates further and throws more away',
            expr: 'arrayMax . entries . cycles . squashed',
            terms: [
              { sym: '8', meaning: '77 . 50' },
              { sym: '32', meaning: '52 . 92' },
              { sym: '64', meaning: '54 . 140' },
              { sym: 'the reading', meaning: 'slower and less efficient at the same time' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No load ever observes a value that violates the ordering rules',
          why: 'Speculation is only acceptable if a wrong guess is detected and undone.',
          breaks: 'A store searches the queue on resolving; a younger load that already read it is squashed.'
        },
        {
          name: 'A memory misspeculation squashes the load itself',
          why: 'The load is the instruction that was wrong; it has to run again.',
          breaks: 'Squashing from the entry before it fails when that entry has already committed.'
        },
        {
          name: 'Recovery without a checkpoint unwinds the renames',
          why: 'Otherwise every misspeculation and every trap leaks one register per squashed instruction.',
          breaks: 'The removed entries are walked youngest first and each rename undone.'
        },
        {
          name: 'The oldest mispredicting branch is the one recovered from',
          why: 'A younger branch may resolve first and redirect to a path an older one has invalidated.',
          breaks: 'Completions are sorted by instruction id and only the oldest is acted on.'
        },
        {
          name: 'Squashing clears the fetch buffer as well as the window',
          why: 'Instructions fetched but not dispatched are just as speculative.',
          breaks: 'Missing them let a mispredicted path dispatch after the recovery.'
        }
      ],
      complexity: [
        { operation: 'checkpoint restore', average: 'one copy, independent of window depth', worst: 'the same' },
        { operation: 'unwind', average: 'one step per squashed instruction', worst: 'the whole window' },
        { operation: 'a store resolving its address', average: 'a search of the younger queue entries', worst: 'the whole load/store queue' },
        { operation: 'a misprediction', average: 'the squash plus a refetch', worst: 'grows with front-end depth' },
        { operation: 'wasted energy', average: 'proportional to squashed instructions', worst: '68% of fetched work on arrayMax' }
      ],
      failureModes: [
        {
          symptom: 'A control for memory speculation changes nothing.',
          cause: 'The fixture resolves both addresses before the load is selected.',
          fix: 'Build a fixture where the store address comes from memory, then measure again.'
        },
        {
          symptom: 'The machine hangs after a memory misspeculation.',
          cause: 'The squash range was wrong, so the offending load stayed in the buffer.',
          fix: 'Squash the load itself and everything younger, then redirect fetch to it.'
        },
        {
          symptom: 'A program is fast and the battery is worse.',
          cause: 'Speculation converts energy into time and only the time was measured.',
          fix: 'Report squashed instructions alongside cycles; it is the unit energy is paid in.'
        },
        {
          symptom: 'A larger window makes a branchy program slower.',
          cause: 'The extra depth was spent on a mispredicted path.',
          fix: 'Treat window size as a workload-dependent trade, and measure both effects.'
        },
        {
          symptom: 'Recovery redirects to a path an older branch has already invalidated.',
          cause: 'A younger mispredicting branch resolved first and was acted on.',
          fix: 'Recover from the oldest misprediction; everything younger is about to be squashed anyway.'
        }
      ],
      inTheWild: [
        'Store-set predictors in every large core since the late 1990s.',
        'Efficiency cores that speculate less, because wasted work is a battery line item.',
        'Hedged and speculative retries in distributed systems, with the same accounting.',
        'Prefetching and eager evaluation, which have the same hit-rate arithmetic.'
      ],
      sources: [
        { title: 'Chrysos and Emer - Memory Dependence Prediction using Store Sets (1998)', note: 'the predictor the demo measures' },
        { title: 'Moshovos and Sohi - Streamlining Inter-operation Memory Communication (1997)', note: 'dependence prediction and speculative forwarding' },
        { title: 'Lipasti, Wilkerson and Shen - Value Locality and Load Value Prediction (1996)', note: 'the idea that worked and did not pay' },
        { title: 'Hennessy and Patterson - Computer Architecture: A Quantitative Approach, chapter 3', note: 'speculation, recovery and their costs' }
      ]
    },

    'memory-level-parallelism': {
      summary: 'An array walk and a pointer chase over the same cache lines with the same miss '
        + 'count, differing by 3.90x in cycles. The separating quantity is the number of misses '
        + 'in flight, measured per cycle out of the event log, and both the miss registers and '
        + 'the reorder buffer are swept to show that overlap needs each of them.',
      intuition: 'The miss count is the number everybody profiles, and it cannot tell an array '
        + 'from a linked list.',
      formulation: {
        equations: [
          {
            label: 'The same misses, on a 256-byte cache',
            expr: 'traversal . misses . cycles . misses in flight',
            terms: [
              { sym: 'stride', meaning: '32 . 174 . 3.86' },
              { sym: 'chase', meaning: '32 . 678 . 1.00' },
              { sym: 'the ratio', meaning: '678 / 174 = 3.90x on identical miss counts' },
              { sym: 'latencies paid', meaning: '32 / 3.86 = 8.3 against 32 / 1.00 = 32' }
            ]
          },
          {
            label: 'Sweeping the miss status holding registers',
            expr: 'registers . stride cycles and parallelism . chase cycles and parallelism',
            terms: [
              { sym: '1', meaning: '648 at 1.00 . 678 at 1.00' },
              { sym: '2', meaning: '332 at 1.98 . 678 at 1.00' },
              { sym: '4', meaning: '174 at 3.86 . 678 at 1.00' },
              { sym: '8 and 16', meaning: '128 at 5.41 . 678 at 1.00' }
            ]
          },
          {
            label: 'Overlap needs a window too',
            expr: 'reorder buffer entries . stride cycles',
            terms: [
              { sym: '8', meaning: '378 - it cannot run far enough ahead' },
              { sym: '16', meaning: '202' },
              { sym: '32 and above', meaning: '174, at which point the miss registers are the limit' },
              { sym: 'chase', meaning: '678 at every size' }
            ]
          },
          {
            label: 'Store-to-load forwarding, measured',
            expr: 'program . loads . forwarded . cache accesses',
            terms: [
              { sym: 'alias', meaning: '10 . 8 . 0 - the run never touches the cache' },
              { sym: 'disjoint', meaning: '22 . 0 . 10' },
              { sym: 'the consequence', meaning: 'a store then a load of the same address is nearly free' },
              { sym: 'why it is required', meaning: 'the store has not written memory yet' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The number of misses in flight never exceeds the miss register count',
          why: 'It is the definition of the structure.',
          breaks: 'A miss with no free register cannot start; the peak equals the configured count.'
        },
        {
          name: 'The parallelism figure is averaged over cycles when a miss was outstanding',
          why: 'Averaging over the whole run mostly measures how much of it was not memory.',
          breaks: 'A program that waits less would otherwise report less parallelism.'
        },
        {
          name: 'Outstanding misses are read from the log, not reconstructed',
          why: 'Reconstructing from starts and the miss latency restates the configuration.',
          breaks: 'The per-cycle count is recorded when the log entry is written.'
        },
        {
          name: 'A forwarded load never reaches the cache',
          why: 'The value comes from a store that has not written memory.',
          breaks: 'The alias fixture forwards every load and records zero cache accesses.'
        }
      ],
      complexity: [
        { operation: 'a cache hit', average: '1 cycle', worst: 'the same' },
        { operation: 'a cache miss', average: '20 cycles, overlapped with others if registers allow', worst: '20 cycles serialised, when they cannot overlap' },
        { operation: 'a forwarded load', average: 'no cache access at all', worst: 'an associative search of the store queue' },
        { operation: 'an array traversal of n lines', average: 'about n / parallelism memory latencies', worst: 'n when the parallelism is 1' },
        { operation: 'a pointer chase of n nodes', average: 'n memory latencies', worst: 'n, and no machine parameter changes it' }
      ],
      failureModes: [
        {
          symptom: 'Two programs have the same miss rate and very different run times.',
          cause: 'The miss count says nothing about whether the misses overlapped.',
          fix: 'Measure misses in flight; it is a different counter and most profilers hide it.'
        },
        {
          symptom: 'More outstanding-miss capacity buys nothing.',
          cause: 'The program has no second address to fetch.',
          fix: 'Change the data structure; no machine parameter helps a chase.'
        },
        {
          symptom: 'Miss registers are idle while the machine stalls.',
          cause: 'The window is too small to reach the instruction that would cause the next miss.',
          fix: 'Size the window and the miss registers together.'
        },
        {
          symptom: 'A linked list is blamed on locality and the fix does not help.',
          cause: 'The dominant effect was memory-level parallelism, which locality does not describe.',
          fix: 'Hold the miss counts equal and re-measure; the remaining gap is the parallelism.'
        },
        {
          symptom: 'A prefetcher helps one traversal and not the other.',
          cause: 'A stride is predictable and a chase is not, which is the same property again.',
          fix: 'Expect the two effects to compound rather than to substitute.'
        }
      ],
      inTheWild: [
        'The gap between arrays and linked lists on every machine built since the mid 1990s.',
        'B-trees with fat nodes, which beat binary trees by more than the node arithmetic predicts.',
        'Structure-of-arrays layouts in games and numerical code.',
        'Software prefetching in database scans, which manufactures the parallelism a chase lacks.'
      ],
      sources: [
        { title: 'Kroft - Lockup-Free Instruction Fetch/Prefetch Cache Organization (1981)', note: 'the paper that introduced miss status holding registers' },
        { title: 'Chou, Fahs and Abraham - Microarchitecture Optimizations for Exploiting Memory-Level Parallelism (2004)', note: 'what limits overlap in practice' },
        { title: 'Glew - MLP yes, ILP no (1998)', note: 'the position that named the quantity' },
        { title: 'Drepper - What Every Programmer Should Know About Memory (2007)', note: 'the practical version, with measurements' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
