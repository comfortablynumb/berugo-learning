/** Worked examples for issue width, speculation and memory parallelism (M36.4-M36.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'superscalar-issue': [
      {
        title: 'A width curve that stops at two, and the histogram that says why',
        goal: 'Find the exact reason `independent` stops getting faster, using the '
          + 'distribution rather than the average.',
        setup: '`independent` is 32 additions with no true dependence, so its ILP bound is '
          + '32.00 and there is plenty of parallelism to find. The machine has four ports: two '
          + 'general integer units, one for memory and one for branches.',
        steps: [
          { do: 'Run at issue width 1.',
            why: 'The baseline.',
            work: '37 cycles, IPC 0.865' },
          { do: 'Run at width 2.',
            why: 'Twice the permission to issue.',
            work: '21 cycles, IPC 1.524 - a gain of 1.76x' },
          { do: 'Run at widths 4 and 8.',
            why: 'The bound is 32.00, so there should be more to get.',
            work: '21 cycles at both - no further gain at all' },
          { do: 'Read the issue histogram at width 4.',
            why: 'The average hides the distribution completely.',
            work: '17 cycles issued exactly 2 instructions, 4 issued 0, and none issued 3 or more' },
          { do: 'Read the port counts.',
            why: 'A hard ceiling at two suggests exactly two units.',
            work: 'alu0 issued 17, alu1 issued 17, mem 0, branch 0' }
        ],
        answer: 'The ceiling is the port mix, and the histogram shows it in a way no average '
          + 'could: exactly two instructions in every issuing cycle, never three, because '
          + 'there are exactly two integer units and this program is nothing but integer '
          + 'arithmetic. The bound of 32.00 says the code would happily use thirty-two, and '
          + 'the machine can supply two. That is a completely different situation from '
          + '`chain`, which is flat from width 1 for the opposite reason - and the two look '
          + 'identical on a graph of IPC against width. Distinguishing them takes the '
          + 'histogram and the dependence bound, which is why the demo reports the limiting '
          + 'factor rather than leaving the curve to speak for itself.'
      },
      {
        title: 'A port model that halved the machine, and the symptom it produced',
        goal: 'See how conflating result latency with initiation interval makes every width '
          + 'curve wrong in a specific and plausible-looking way.',
        setup: 'The original scheduler marked a port busy until the cycle its result appeared, '
          + 'so `port.busyUntil = cycle + latency` and a port was available again only when '
          + '`busyUntil < cycle`. Every operation on this machine has a latency of at least 1.',
        steps: [
          { do: 'Work out when a 1-cycle operation issued at cycle c frees its port.',
            why: 'This is the arithmetic the bug lives in.',
            work: 'busyUntil = c + 1, and at cycle c + 1 the test c + 1 < c + 1 is false' },
          { do: 'So find the earliest cycle the port accepts another operation.',
            why: 'One cycle later than it should be.',
            work: 'cycle c + 2, giving each port a throughput of one operation every 2 cycles' },
          { do: 'Compute the resulting ceiling with two integer ports.',
            why: 'Two ports at half rate is one integer operation per cycle.',
            work: '2 x 0.5 = 1.0 instructions per cycle, whatever the width' },
          { do: 'Check that against the measured IPC before the fix.',
            why: 'A prediction the bug makes, which the data can confirm.',
            work: '`independent` measured 0.865 at every width from 1 to 8' },
          { do: 'Separate the two numbers and re-run.',
            why: 'A pipelined unit takes one operation per cycle however long the result takes.',
            work: '`independent` drops to 21 cycles and IPC 1.524, and `factorial` from 138 to 107' }
        ],
        answer: 'A fully pipelined functional unit accepts a new operation every cycle '
          + 'regardless of how long its result takes to appear; the two numbers are latency '
          + 'and initiation interval, and they are not the same. Conflating them capped every '
          + 'port at half throughput and produced a machine that saturated near an IPC of one '
          + 'whatever the width - which is a plausible-looking result, and is exactly the '
          + 'shape somebody would write a paragraph about. It was a true statement about the '
          + 'model and a false one about processors. The tell was that the saturation point '
          + 'did not depend on the program at all: a genuine limit varies with the workload, '
          + 'and a modelling artefact does not.'
      }
    ],

    'speculation-and-recovery': [
      {
        title: 'What memory dependence speculation is worth, on a fixture that can show it',
        goal: 'Measure the gain from letting a load pass a store whose address is not yet '
          + 'known - and first, discover that the obvious fixture cannot measure it.',
        setup: 'Two pairs. `alias` and `disjoint` put a store and a load next to each other '
          + 'with both addresses already in registers. `hiddenAlias` and `hiddenDisjoint` load '
          + 'the STORE\'s address from memory, so it is genuinely unknown for many cycles.',
        steps: [
          { do: 'Run `disjoint` with speculation on and off.',
            why: 'The load can never alias the store, so speculation should be a free win.',
            work: '39 cycles both ways, and 0 loads ever waited' },
          { do: 'Work out why the control did nothing.',
            why: 'A control with no effect looks exactly like a control with no importance.',
            work: 'both addresses are ready in cycle 1, the store resolves before the load is '
              + 'even selected, so no load ever has to guess' },
          { do: 'Run `hiddenDisjoint` with speculation off.',
            why: 'Now the store address arrives from memory, so conservative ordering bites.',
            work: '59 cycles, with 27 load-issue attempts refused' },
          { do: 'Run it with speculation on.',
            why: 'The load goes anyway, and here it is always right.',
            work: '43 cycles, 0 waits and 0 misspeculations' },
          { do: 'Take the ratio.',
            why: 'This is the value of the guess when it is correct.',
            work: '59 / 43 = 1.37x' }
        ],
        answer: 'Speculation is worth 1.37x here, and the more useful part of the exercise is '
          + 'the first half. The natural fixture for this control measures nothing, and it '
          + 'measures nothing for a reason that is invisible unless you look at when the '
          + 'addresses become available: with both in registers the store always resolves '
          + 'first, so the load never faces the question the control is about. A demo built on '
          + 'that pair would have shown a switch with no effect next to a paragraph explaining '
          + 'why the effect is large, and every reader would have believed the paragraph. The '
          + 'only way to tell a control that does nothing from one that does nothing important '
          + 'is to build the fixture that would have shown a difference.'
      },
      {
        title: 'Being wrong every iteration, and paying for it once',
        goal: 'Measure the cost of a load that aliases every time, and see the store-set '
          + 'predictor bound it.',
        setup: '`hiddenAlias` is the same program as `hiddenDisjoint` with one number changed: '
          + 'the offsets table is all zeros, so the store lands on exactly the address the '
          + 'younger load reads, every iteration of an eight-iteration loop.',
        steps: [
          { do: 'Run with speculation off.',
            why: 'The conservative baseline: the load always waits.',
            work: '60 cycles, 27 waits, 0 misspeculations' },
          { do: 'Run with speculation on.',
            why: 'The load goes early and is wrong.',
            work: '61 cycles' },
          { do: 'Count the misspeculations.',
            why: 'Eight iterations that all alias could cost eight squashes.',
            work: '2 misspeculations, not 8' },
          { do: 'Read the store-set count.',
            why: 'The predictor records the load that was wrong.',
            work: '1 store set learned, after which that load waits' },
          { do: 'Count the waits under speculation.',
            why: 'The load is waiting again, by prediction rather than by policy.',
            work: '18 waits, against 27 for the always-conservative machine' }
        ],
        answer: 'Being wrong every single iteration costs one cycle in total, because the '
          + 'machine stops being wrong after twice. That is Chrysos and Emer\'s store-set '
          + 'result and it is what makes aggressive memory speculation safe to ship: the '
          + 'failure mode is self-limiting, so the expected cost is set by how fast the '
          + 'predictor learns rather than by how often the program aliases. The pair also '
          + 'shows why the predictor has to be per-load rather than global - the same machine '
          + 'is simultaneously waiting on the load that aliases and speculating freely on '
          + 'every other load in the program, and a single global switch would have to choose '
          + 'the worse behaviour for one of them.'
      }
    ],

    'memory-level-parallelism': [
      {
        title: 'Identical misses, four times the cycles',
        goal: 'Hold the cache-miss count constant between an array walk and a pointer chase, '
          + 'and find where the difference actually comes from.',
        setup: '`stride` walks 32 cache lines with the address computed from an induction '
          + 'variable; `chase` walks the same 32 lines in a shuffled order with each address '
          + 'loaded from the previous line. The cache is 8 sets x 1 way x 32 bytes = 256 '
          + 'bytes, so both walks miss on every line.',
        steps: [
          { do: 'Count the cache misses of each.',
            why: 'This is the number every profiler reports.',
            work: '32 misses each - identical' },
          { do: 'Count the cycles.',
            why: 'The thing the misses were supposed to explain.',
            work: 'stride 174 cycles, chase 678 - a factor of 3.90' },
          { do: 'Measure the misses in flight, averaged over the cycles when any were.',
            why: 'A different unit, and the one that separates them.',
            work: 'stride 3.86, chase 1.00' },
          { do: 'Check the peak against the miss-register count.',
            why: 'The machine has four miss status holding registers.',
            work: 'stride peaks at 4, chase peaks at 1' },
          { do: 'Divide the misses by the parallelism to get the latencies actually paid.',
            why: 'Overlap means one memory latency can cover several lines.',
            work: 'stride 32 / 3.86 = 8.3 latencies; chase 32 / 1.00 = 32' }
        ],
        answer: 'The array pays about eight memory latencies and the list pays thirty-two, for '
          + 'the same thirty-two misses. This is the result that should change how the '
          + 'array-versus-list question is asked: the usual explanation is locality, and here '
          + 'locality has been removed from the comparison entirely by construction - the two '
          + 'fixtures touch the same lines and miss the same number of times. What is left is '
          + 'whether the machine knows the next address before the previous load has returned, '
          + 'and no window, width or bandwidth changes that for a chase. A cache-miss counter '
          + 'cannot tell these two programs apart, so the metric to reach for is '
          + 'misses-in-flight, and most profilers do not expose it by default.'
      },
      {
        title: 'One control, two answers: sweeping the miss registers',
        goal: 'Show that the same hardware change is worth 5x on one program and exactly '
          + 'nothing on another.',
        setup: 'The same two traversals on the same 256-byte cache, with the number of miss '
          + 'status holding registers swept from 1 to 16. Everything else is held constant, '
          + 'including the reorder buffer at 32 entries.',
        steps: [
          { do: 'Run `stride` with 1 miss register.',
            why: 'One register means a blocking cache in all but name.',
            work: '648 cycles, parallelism 1.00' },
          { do: 'Raise it to 2, then 4.',
            why: 'Each extra register is another miss that may be in flight.',
            work: '332 cycles at parallelism 1.98, then 174 at 3.86' },
          { do: 'Raise it to 8 and 16.',
            why: 'To find where the program runs out of independent misses.',
            work: '128 cycles at parallelism 5.41 for both' },
          { do: 'Run `chase` across the whole sweep.',
            why: 'The same control on a program with no independent misses.',
            work: '678 cycles at every setting, parallelism exactly 1.00 throughout' },
          { do: 'Compare the two gains.',
            why: 'One control, two answers.',
            work: 'stride 648 / 128 = 5.06x; chase 678 / 678 = 1.00x' }
        ],
        answer: 'Miss registers are worth 5.06x on the array and nothing at all on the list, '
          + 'and the parallelism figure tracks the cycle count exactly - which is the check '
          + 'that the metric is measuring the thing it claims to. The engineering conclusion '
          + 'is uncomfortable in a useful way: buying more outstanding-miss capacity for a '
          + 'pointer-chasing workload is buying nothing, and the same is true of a larger '
          + 'window, a wider machine and a more aggressive prefetcher. The only changes that '
          + 'help a chase are ones that give the program more than one address at a time, '
          + 'which means changing the data structure. That is why the advice about arrays and '
          + 'B-trees keeps being right for reasons its usual justification does not cover.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
