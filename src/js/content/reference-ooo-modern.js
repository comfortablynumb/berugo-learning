/** Reference entries for SMT, side channels and the modern core (M36.7-M36.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'simultaneous-multithreading': {
      summary: 'Two real out-of-order cores stepped in lockstep, sharing one array of '
        + 'execution ports, one cache and one budget for the reorder buffer and issue queue, '
        + 'with the front end serving one thread per cycle. Throughput and per-thread slowdown '
        + 'are reported together, and the starvation test is run over a fixed window because a '
        + 'starved thread finishes normally once the thread starving it has stopped.',
      intuition: 'A second thread fills the slots the first one could not use, and pays for '
        + 'them in its own latency.',
      formulation: {
        equations: [
          {
            label: 'Which pairs gain, and what each thread pays',
            expr: 'pair . sequential . together . speed-up . slowdowns',
            terms: [
              { sym: 'chase + chase', meaning: '1356 . 385 . 3.52x . 0.55x and 0.57x' },
              { sym: 'chain + chain', meaning: '76 . 48 . 1.58x . 1.03x and 1.26x' },
              { sym: 'chain + independent', meaning: '59 . 50 . 1.18x . 1.32x and 1.43x' },
              { sym: 'independent + independent', meaning: '42 . 42 . 1.00x . 1.62x and 2.00x' }
            ]
          },
          {
            label: 'Starvation over a fixed 150-cycle window',
            expr: 'policy . guard . thread 0 . thread 1 . throughput',
            terms: [
              { sym: 'strict priority', meaning: 'none . 30 . 0 . 0.200' },
              { sym: 'strict priority', meaning: '4 cycles . 30 . 33 . 0.420' },
              { sym: 'round robin', meaning: 'none . 30 . 32 . 0.413' },
              { sym: 'ICOUNT', meaning: 'none . 30 . 32 . 0.413' }
            ]
          },
          {
            label: 'The second failure: a shared window held by a stalled thread',
            expr: 'guard 8, chase and chain',
            terms: [
              { sym: 'shared window', meaning: 'thread 1 retires 20, throughput 0.310' },
              { sym: 'partitioned window', meaning: 'thread 1 retires 33, throughput 0.375' },
              { sym: 'what the guard did', meaning: 'gave thread 1 fetch slots it could not use' },
              { sym: 'the conclusion', meaning: 'both fixes are needed and neither covers the other' }
            ]
          },
          {
            label: 'What is shared and what is duplicated',
            expr: 'structure . in this model',
            terms: [
              { sym: 'execution ports', meaning: 'one array, held by both schedulers' },
              { sym: 'the cache', meaning: 'one object, and where most of the gain comes from' },
              { sym: 'window and issue queue', meaning: 'one budget, split or first-come' },
              { sym: 'program counter and register map', meaning: 'duplicated - the cheap part' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Both threads make progress under the starvation guard',
          why: 'A priority policy without one has a starvation case whether or not it has been found.',
          breaks: 'Measured over a fixed window against an adversarial thread that stalls constantly.'
        },
        {
          name: 'The threads step in lockstep, so a shared port means a real conflict',
          why: 'Two cores at different cycle counts would see stale port reservations.',
          breaks: 'Both cores are stepped once per SMT cycle, in a rotating order.'
        },
        {
          name: 'Issue arbitration rotates, so thread 0 is not permanently favoured',
          why: 'Whoever runs first in a cycle takes the ports first.',
          breaks: 'The step order rotates with the cycle number.'
        },
        {
          name: 'Both structures are shared the same way',
          why: 'The buffer and the queue fill for different reasons, so partitioning one leaves the other.',
          breaks: 'A partition control that changed almost nothing was the symptom of doing only one.'
        }
      ],
      complexity: [
        { operation: 'fetch arbitration', average: 'one thread served per cycle', worst: 'the starved thread waits for the guard threshold' },
        { operation: 'ICOUNT', average: 'a comparison of in-flight counts', worst: 'linear in the thread count' },
        { operation: 'shared window budget', average: 'total minus what the others hold', worst: 'one entry, when another thread holds the rest' },
        { operation: 'partitioned window', average: 'a fixed share whatever the others do', worst: 'the fixed share, even when the core is otherwise idle' },
        { operation: 'the area cost of SMT', average: 'a few per cent of the core', worst: 'the duplicated state is small; everything expensive is shared' }
      ],
      failureModes: [
        {
          symptom: 'A thread makes no progress at all and the benchmark does not show it.',
          cause: 'Completion time hides starvation: the starved thread finishes once the other stops.',
          fix: 'Measure per-thread progress over a fixed window of cycles.'
        },
        {
          symptom: 'SMT is enabled and the tail latency gets worse with no throughput gain.',
          cause: 'The core was already saturated, so the second thread only queues.',
          fix: 'Measure the pair speed-up and the per-thread slowdown; if the first is 1.00, disable it.'
        },
        {
          symptom: 'A thread wins fetch slots and still retires nothing.',
          cause: 'The other thread holds the shared window while it waits on memory.',
          fix: 'Partition the window and the issue queue; the fetch guard does not cover this.'
        },
        {
          symptom: 'A partitioning control appears to do nothing.',
          cause: 'Only one of the two structures that fill was actually being partitioned.',
          fix: 'Share and partition the reorder buffer and the issue queue together.'
        },
        {
          symptom: 'Two tenants on one core can observe each other.',
          cause: 'SMT shares the cache and the predictors by construction.',
          fix: 'Do not co-schedule across a trust boundary; this is an isolation decision, not a tuning one.'
        }
      ],
      inTheWild: [
        'Hyper-threading on Intel cores, and two-way and four-way SMT on POWER.',
        'Databases and low-latency trading systems that disable it, correctly, for their workload.',
        'Cloud providers that stopped co-scheduling different tenants on one core.',
        'GPU warps, which are the same idea taken much further: hide latency with more threads.'
      ],
      sources: [
        { title: 'Tullsen, Eggers and Levy - Simultaneous Multithreading: Maximizing On-Chip Parallelism (1995)', note: 'the paper, and the argument from empty issue slots' },
        { title: 'Tullsen et al. - Exploiting Choice: Instruction Fetch and Issue on an SMT Processor (1996)', note: 'ICOUNT and the fetch policies compared' },
        { title: 'Agner Fog - The Microarchitecture of Intel, AMD and VIA CPUs', note: 'which structures are partitioned on which generation' },
        { title: 'Percival - Cache Missing for Fun and Profit (2005)', note: 'the isolation consequence of sharing a cache between threads' }
      ]
    },

    'microarchitectural-side-channels': {
      summary: 'A working Flush+Reload receiver run against the same cache the core uses, with '
        + 'the speculation driven by the same bimodal predictor M35 built. The secret is '
        + 'recovered at 100% given enough rounds, falls to chance the moment a speculation '
        + 'barrier is applied, and carries public data instead of the secret when the index is '
        + 'masked. A Prime+Probe receiver is included with its ambiguity reported.',
      intuition: 'The squashed instructions really are discarded; the cache line they touched '
        + 'is not, and it was chosen by the secret.',
      formulation: {
        equations: [
          {
            label: 'One reload pass, no mitigation',
            expr: 'sixteen probe lines, timed',
            terms: [
              { sym: 'fifteen lines', meaning: '20 cycles - a miss' },
              { sym: 'one line', meaning: '1 cycle - a hit, and its index is the secret' },
              { sym: 'training calls needed', meaning: '6, to saturate the bimodal counter' },
              { sym: 'with no training', meaning: 'nothing is recovered at all' }
            ]
          },
          {
            label: 'Repetition against noise, mean over 8 seeds at 30% noise',
            expr: 'rounds . no mitigation . barrier . masking',
            terms: [
              { sym: '1', meaning: '6.3% . 1.6% . 1.6%' },
              { sym: '7', meaning: '35.9% . 6.3% . 1.6%' },
              { sym: '31', meaning: '87.5% . 14.1% . 3.1%' },
              { sym: '127', meaning: '100.0% . 7.8% . 0.0%, against a chance rate of 6.25%' }
            ]
          },
          {
            label: 'What each mitigation actually does',
            expr: 'mitigation . leak . cost',
            terms: [
              { sym: 'none', meaning: 'the secret . nothing' },
              { sym: 'speculation barrier', meaning: 'no hit at all . the speculation, on every call' },
              { sym: 'index masking', meaning: 'the public array, deterministically . one AND instruction' },
              { sym: 'rolling back registers', meaning: 'the secret, unchanged . it was never the problem' }
            ]
          },
          {
            label: 'Prime+Probe: resolution and ambiguity',
            expr: 'geometry . values per set . candidates returned',
            terms: [
              { sym: '16 sets, 16 values', meaning: '1 . the answer plus the victim data line' },
              { sym: '8 sets, 16 values', meaning: '2 . twice as many candidates' },
              { sym: 'a real cache', meaning: '256 byte values over 64 sets' },
              { sym: 'what it needs', meaning: 'nothing shared with the victim but the cache' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The unmitigated channel recovers the secret with high reliability',
          why: 'A demonstration that does not work proves nothing about the mitigation either.',
          breaks: 'Asserted as a mean recovery rate over several seeds, not a single lucky run.'
        },
        {
          name: 'The mitigated channel sits at chance and stays there',
          why: 'The mitigation must remove the signal, not merely slow the attacker down.',
          breaks: 'Asserted at the largest round count, where an unmitigated run reaches 100%.'
        },
        {
          name: 'The reliability figure is averaged over independent seeds',
          why: 'Eight characters is eight trials, and eight trials report noise as a result.',
          breaks: 'A single run at chance can read 12.5% and a working channel 87.5%.'
        },
        {
          name: 'Speculation happens only when the predictor says so',
          why: 'Otherwise the leak is a flag rather than a mechanism.',
          breaks: 'Setting the training calls to zero stops the recovery entirely.'
        },
        {
          name: 'The victim never returns the secret architecturally',
          why: 'If it did, the channel would be irrelevant.',
          breaks: 'The out-of-bounds value is used only for the address of a speculative access.'
        }
      ],
      complexity: [
        { operation: 'one round of Flush+Reload', average: 'one flush and one timing pass over the probe array', worst: 'proportional to the alphabet size' },
        { operation: 'recovering one character', average: 'rounds per character, majority vote', worst: 'rises with the noise level' },
        { operation: 'Prime+Probe', average: 'fill every way of every set, then probe them', worst: 'sets times ways accesses per round' },
        { operation: 'the speculation barrier', average: 'the branch resolution latency, on every call', worst: 'the same on the hot path as on the cold one' },
        { operation: 'index masking', average: 'one AND instruction', worst: 'requires a power-of-two bound' }
      ],
      failureModes: [
        {
          symptom: 'A mitigation is added and the leak continues.',
          cause: 'It undoes the architectural effect, which was never where the leak was.',
          fix: 'Stop the speculative access, or stop the out-of-bounds address existing.'
        },
        {
          symptom: 'A channel is dismissed as too noisy to matter.',
          cause: 'Noise raises the error rate of one round and does not remove the correlation.',
          fix: 'Measure the recovery rate against the round count; an attacker with time simply waits.'
        },
        {
          symptom: 'A single run reports a mitigated channel as partially working.',
          cause: 'An eight-character secret is eight Bernoulli trials.',
          fix: 'Report a mean over independent seeds and compare it against the chance rate.'
        },
        {
          symptom: 'Constant-time code still leaks a key.',
          cause: 'Its branches are data-independent and its addresses are not.',
          fix: 'The rule is no secret-dependent addresses, which rules out key-indexed tables.'
        },
        {
          symptom: 'A defence stops Flush+Reload and the leak continues.',
          cause: 'Prime+Probe needs no shared memory, only the same cache.',
          fix: 'Address the sharing, not the specific receiver; the shape has many instances.'
        }
      ],
      inTheWild: [
        'Spectre and Meltdown, and the operating-system and microcode mitigations that followed.',
        'Cache attacks on AES table lookups, and the constant-time implementations that answered them.',
        'Memory deduplication disabled by default in hypervisors, which removes Flush+Reload.',
        'Timing leaks far from processors: response times, compression ratios and rate limiters.'
      ],
      sources: [
        { title: 'Kocher et al. - Spectre Attacks: Exploiting Speculative Execution (2019)', note: 'the bounds-check bypass this lab implements' },
        { title: 'Lipp et al. - Meltdown: Reading Kernel Memory from User Space (2018)', note: 'the same receiver with a deferred exception' },
        { title: 'Yarom and Falkner - FLUSH+RELOAD: a High Resolution Cache Side-Channel Attack (2014)', note: 'the receiver, and what it requires' },
        { title: 'Osvik, Shamir and Tromer - Cache Attacks and Countermeasures (2006)', note: 'Prime+Probe, and the resolution it gives back' }
      ]
    },

    'anatomy-of-a-modern-core': {
      summary: 'Top-down analysis over the core\'s own event log: every issue slot charged to '
        + 'exactly one of retiring, bad speculation, front-end bound and back-end bound, with '
        + 'a drill-down naming the structure inside each category. The four shares sum to 100% '
        + 'by construction on every program, and each matched fixture pair is a code change '
        + 'whose category shift can be checked.',
      intuition: 'Partition the whole slot budget into four exhaustive parts before arguing '
        + 'about any one of them.',
      formulation: {
        equations: [
          {
            label: 'The same machine, three different verdicts',
            expr: 'program . cycles . retiring . dominant category',
            terms: [
              { sym: 'chase', meaning: '393 . 8.5% . back-end bound at 85.7%' },
              { sym: 'factorial', meaning: '107 . 29.2% . bad speculation at 51.2%' },
              { sym: 'strlen', meaning: '34 . 23.5% . front-end bound at 48.5%' },
              { sym: 'what changed between runs', meaning: 'nothing about the machine' }
            ]
          },
          {
            label: 'Acting on the verdict: chase becomes stride',
            expr: 'measure . chase . stride',
            terms: [
              { sym: 'cycles', meaning: '678 . 174' },
              { sym: 'retiring', meaning: '4.9% . 23.7%' },
              { sym: 'back-end bound', meaning: '72.1% . 60.2%' },
              { sym: 'the check', meaning: 'the category the diagnosis named is the one that moved' }
            ]
          },
          {
            label: 'The accounting, on chase at width 4',
            expr: 'slots = width x cycles',
            terms: [
              { sym: 'slots available', meaning: '4 x 678 = 2712' },
              { sym: 'charged', meaning: '2712 - every slot, exactly once' },
              { sym: 'the four shares', meaning: '4.9 + 0.7 + 22.3 + 72.1 = 100.0%' },
              { sym: 'why it matters', meaning: 'four shares of one denominator are comparable; counters are not' }
            ]
          },
          {
            label: 'This simulator against a large contemporary core',
            expr: 'structure . here . roughly',
            terms: [
              { sym: 'reorder buffer', meaning: '32 entries . several hundred' },
              { sym: 'physical registers', meaning: '64 . a couple of hundred' },
              { sym: 'execution ports', meaning: '4 . 8 to 12' },
              { sym: 'L1 data cache', meaning: '4 KiB, one level . 32 to 48 KiB, three levels' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The four categories sum to 100% of the slot budget',
          why: 'A classifier that does not reconcile is describing the machine rather than measuring it.',
          breaks: 'Charged slots are compared against width times cycles on every program.'
        },
        {
          name: 'A slot is charged to exactly one category',
          why: 'Otherwise the shares are not comparable against each other.',
          breaks: 'Used slots split by whether the instruction committed; empty slots by the cycle\'s state.'
        },
        {
          name: 'A trapping instruction counts as retiring',
          why: 'It reaches the head of the buffer and commits, writing control registers instead of a general one.',
          breaks: 'Otherwise every program ending in ecall looks mildly mispredicted.'
        },
        {
          name: 'Recovery cycles are charged to bad speculation, not to the front end',
          why: 'A front end told to refetch has not failed at anything.',
          breaks: 'The cycles from a squash until dispatch restarts go to bad speculation.'
        },
        {
          name: 'The front-end reason distinguishes running out of program from running out of bandwidth',
          why: 'On a short fixture the window can hold the whole program.',
          breaks: 'The drill-down says so in words rather than implying a decoder problem.'
        }
      ],
      complexity: [
        { operation: 'classifying a run', average: 'one pass over the event log', worst: 'linear in cycles times events per cycle' },
        { operation: 'the drill-down', average: 'a count per reason string', worst: 'one bucket per distinct stall reason' },
        { operation: 'the verdict', average: 'the largest non-retiring share', worst: 'one comparison over four values' },
        { operation: 'checking a suggested change', average: 'one extra run of the changed program', worst: 'the pair must hold everything else constant' }
      ],
      failureModes: [
        {
          symptom: 'The categories do not add up.',
          cause: 'A slot was charged twice or not at all.',
          fix: 'Charge every slot of every cycle exactly once and assert the total against the budget.'
        },
        {
          symptom: 'A breakdown names a category and nobody knows what to change.',
          cause: 'The category was reported without the reason inside it.',
          fix: 'Drill down to the structure: a full buffer and exhausted registers want different fixes.'
        },
        {
          symptom: 'Front-end bound is reported and the decoder is fine.',
          cause: 'The whole program fits in the window, so the front end ran out of program.',
          fix: 'Report the reason; this shape does not occur on real traces.'
        },
        {
          symptom: 'The suggested change does not move the category it was aimed at.',
          cause: 'The diagnosis was wrong.',
          fix: 'Re-measure rather than tuning harder in the same direction.'
        },
        {
          symptom: 'A processor is described as memory bound with no workload attached.',
          cause: 'The verdict is a property of the program, and every category is dominant somewhere.',
          fix: 'Re-run top-down when the workload changes, not only when the hardware does.'
        }
      ],
      inTheWild: [
        'The top-down mode in Intel VTune, Linux perf and every serious profiler since.',
        'Amdahl\'s law and flame graphs, which are the same partition-first move.',
        'Capacity planning, where the same discipline decides which resource to buy.',
        'M58, which applies this method to real profiling tools and real hardware counters.'
      ],
      sources: [
        { title: 'Yasin - A Top-Down Method for Performance Analysis and Counters Architecture (2014)', note: 'the method, and the reason the shares sum to one' },
        { title: 'Agner Fog - The Microarchitecture of Intel, AMD and VIA CPUs', note: 'the dimensions the comparison table is drawn against' },
        { title: 'Hennessy and Patterson - Computer Architecture: A Quantitative Approach, chapter 3', note: 'the modern core, end to end' },
        { title: 'Intel 64 and IA-32 Architectures Optimization Reference Manual', note: 'the vendor figures behind the order-of-magnitude column' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
