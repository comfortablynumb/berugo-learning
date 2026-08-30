/** Worked examples for SMT, side channels and the modern core (M36.7-M36.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'simultaneous-multithreading': [
      {
        title: 'Two workloads, opposite answers, one BIOS switch',
        goal: 'Measure the SMT gain on a stall-heavy pair and on a saturated pair, and see '
          + 'the configuration decision fall out of the numbers.',
        setup: 'Two real out-of-order cores stepped in lockstep, sharing one array of '
          + 'execution ports, one cache and one budget for the reorder buffer and issue queue. '
          + 'The front end serves one thread per cycle under the ICOUNT policy. The baseline '
          + 'for each thread is the same program on the core alone.',
        steps: [
          { do: 'Run two copies of `chain` alone and add the times.',
            why: 'This is what running them one after the other costs.',
            work: '38 + 38 = 76 cycles' },
          { do: 'Run them together on one core.',
            why: 'A dependence chain leaves most issue slots empty.',
            work: '48 cycles - a speed-up of 1.58x' },
          { do: 'Measure what each thread paid.',
            why: 'Throughput and latency move in opposite directions.',
            work: 'thread 0 finished 1.03x slower than alone, thread 1 1.26x slower' },
          { do: 'Now do the same with two copies of `independent`.',
            why: 'This program already issues at the port limit on its own.',
            work: '21 + 21 = 42 sequentially, and 42 together - a speed-up of 1.00x' },
          { do: 'Measure what those threads paid.',
            why: 'The second thread had to find empty slots, and there were none.',
            work: '1.62x and 2.00x slower than alone' }
        ],
        answer: 'The same hardware gives 1.58x on one pair and exactly nothing on the other, '
          + 'and nothing but the workload changed. That is the whole of the "should we turn '
          + 'SMT off" question, and it explains why both camps are right about their own '
          + 'systems: a throughput-oriented service reads the first column and a '
          + 'latency-critical one reads the last two. The `independent` row is the case that '
          + 'settles it for a database or a trading path - the core was already saturated, so '
          + 'the second thread bought no throughput and doubled the latency of the first. It '
          + 'is also worth noting the direction of the surprise in the other direction: two '
          + 'copies of `chase` over the same data run 3.52x faster together, because one '
          + 'thread\'s misses warm the shared cache for the other.'
      },
      {
        title: 'Two ways to starve a thread, and two different fixes',
        goal: 'Show that a fetch-fairness guard and a partitioned window solve different '
          + 'problems, and that neither covers the other.',
        setup: '`chase` as thread 0 and `chain` as thread 1 on one core with a 256-byte cache, '
          + 'measured over a fixed window of cycles rather than to completion - a starved '
          + 'thread finishes eventually once the thread starving it has stopped, so completion '
          + 'time hides the failure entirely.',
        steps: [
          { do: 'Run 150 cycles under strict priority with no guard.',
            why: 'Thread 0 wins the front end every cycle.',
            work: 'thread 0 retired 30 instructions, thread 1 retired 0' },
          { do: 'Add a starvation guard of 4 cycles and run again.',
            why: 'A thread passed over four times takes the next slot.',
            work: 'thread 0 still 30, thread 1 now 33, throughput up from 0.200 to 0.420' },
          { do: 'Loosen the guard to 8 and give thread 0 a shared window.',
            why: 'Thread 1 now gets fetch slots but has to find room to dispatch.',
            work: 'thread 1 retires 20 rather than 33, and throughput falls to 0.310' },
          { do: 'Partition the reorder buffer and issue queue instead.',
            why: 'Each thread gets a fixed half, whatever the other is doing.',
            work: 'thread 1 recovers to 33 and throughput rises to 0.375' },
          { do: 'Check what partitioning cost thread 0.',
            why: 'A fixed half is smaller than the whole when the other thread is idle.',
            work: 'thread 0 unchanged at 42 in this configuration, and 38 rather than 42 with '
              + 'an 8-entry buffer' }
        ],
        answer: 'Two independent failures with two independent fixes. The guard guarantees '
          + 'fetch slots and nothing more; a thread stalled on cache misses still holds the '
          + 'window it was given, so the other thread wins its slot and then finds no room to '
          + 'dispatch into. Partitioning fixes that and does nothing about fetch fairness. '
          + 'Every shipping SMT design does both, and this is the measurement that shows why '
          + 'neither alone is enough. The methodological point is the fixed window: over a '
          + 'full run, strict priority with no guard reports zero starved threads, because '
          + 'thread 1 completes normally once thread 0 has finished. Fairness bugs found in '
          + 'production rather than in a benchmark are nearly always hidden this way.'
      }
    ],

    'microarchitectural-side-channels': [
      {
        title: 'Recovering a secret, and then removing the signal',
        goal: 'Run the Flush+Reload receiver against a mispredicted bounds check, then apply '
          + 'each mitigation and see the recovery rate move.',
        setup: 'A gadget of the form "if (index < 16) touch(probe[data[index]])", with the '
          + 'secret stored immediately after the 16-entry array. The bounds check goes through '
          + 'a bimodal predictor; the probe array has one cache line per possible value; a hit '
          + 'costs 1 cycle and a miss 20. Noise is set to 30%, so other activity may evict or '
          + 'touch probe lines between the victim and the measurement.',
        steps: [
          { do: 'Call the gadget six times with in-bounds indices.',
            why: 'This saturates the predictor at "in range" - entirely legitimate code.',
            work: '6 training calls, after which the counter predicts taken' },
          { do: 'Flush the probe lines, call once out of bounds, and time all sixteen.',
            why: 'One reload pass is the whole receiver.',
            work: '15 lines at 20 cycles, 1 at 1 cycle' },
          { do: 'Repeat for 31 rounds per character and take a majority vote.',
            why: 'Noise makes a single round unreliable, not the channel unusable.',
            work: 'mean recovery over 8 seeds: 87.5%, against a chance rate of 6.25%' },
          { do: 'Raise the rounds to 127.',
            why: 'An attacker with time simply spends more of it.',
            work: '100.0% - the full secret, CAFEBABE' },
          { do: 'Insert a speculation barrier before the dependent load and repeat at 127 rounds.',
            why: 'This stops the access rather than undoing it.',
            work: '7.8%, which is chance' },
          { do: 'Try index masking instead.',
            why: 'The address is forced back into the array.',
            work: '0.0% for the secret - the receiver recovers ABCDEFGH, the public array' }
        ],
        answer: 'The channel recovers the whole secret given enough rounds and drops to chance '
          + 'the moment the speculative access is prevented. The two mitigations are worth '
          + 'contrasting: the barrier removes the signal entirely, and the mask leaves the '
          + 'channel working perfectly while making it carry public data. Neither of them '
          + 'undoes anything, because undoing is what the machine already does correctly and '
          + 'it is not where the leak was - the registers holding the secret really were '
          + 'freed, and the cache line the secret chose really did survive. The noise curve is '
          + 'the other lesson: repetition converts an unreliable channel into a reliable one, '
          + 'so "the channel is noisy" has never been a defence and the only distinction that '
          + 'matters is between a slow channel and an absent one.'
      },
      {
        title: 'Why Prime+Probe is weaker and more dangerous',
        goal: 'Run the receiver that needs no shared memory, and measure the ambiguity it '
          + 'gives back.',
        setup: 'The same victim, but the attacker no longer shares the probe array. Instead it '
          + 'fills every way of every cache set with its own lines, lets the victim run once, '
          + 'and checks which sets have lost a line. The cache is 16 sets by 4 ways.',
        steps: [
          { do: 'Prime every set with attacker lines.',
            why: 'Fill the whole cache with known state.',
            work: '16 sets x 4 ways = 64 lines installed' },
          { do: 'Run the victim once with the out-of-bounds index and probe every set.',
            why: 'A set that lost a line was touched by the victim.',
            work: '2 sets show an eviction: set 0 and set 2' },
          { do: 'Map those sets back to possible secret values.',
            why: 'The reading is a set index, not a value.',
            work: '2 candidates, A and C, where the answer is C' },
          { do: 'Count how many values share a set on this geometry.',
            why: 'Ambiguity is decided by values divided by sets.',
            work: '16 values over 16 sets: at most 1 per set, so the only extra candidate is '
              + 'the victim\'s own data line' },
          { do: 'Halve the sets and repeat.',
            why: 'Real caches have far more possible values than sets.',
            work: '8 sets for 16 values: 8 collisions, at most 2 values per set, and the '
              + 'candidate list doubles' }
        ],
        answer: 'Prime+Probe recovers the cache set rather than the value, so its output is a '
          + 'candidate list whose length is set by how many values share a set - on a real '
          + 'cache, 256 possible byte values over 64 sets, which is why it is normally one '
          + 'stage of an attack rather than the whole of it. What makes it the more dangerous '
          + 'receiver is the requirement it drops: it needs nothing shared with the victim but '
          + 'the cache itself, so it works across processes, across containers, and between '
          + 'two SMT threads on one core - which 36.7 showed share a cache by construction. '
          + 'That is why disabling memory deduplication stops Flush+Reload and does nothing '
          + 'for this, and why some operators disable SMT for isolation rather than for '
          + 'performance.'
      }
    ],

    'anatomy-of-a-modern-core': [
      {
        title: 'Four numbers, and the change one of them implies',
        goal: 'Classify a slow program, act on the verdict, and check that the category it '
          + 'named is the one that moved.',
        setup: '`chase` at issue width 4 on a 256-byte cache. Every issue slot - width times '
          + 'cycles - is charged to exactly one of retiring, bad speculation, front-end bound '
          + 'and back-end bound, so the four shares sum to 100% by construction.',
        steps: [
          { do: 'Run it and count the slots.',
            why: 'The denominator has to be the whole budget.',
            work: '678 cycles x 4 = 2712 slots' },
          { do: 'Read the four shares.',
            why: 'The largest non-retiring one is the verdict.',
            work: 'retiring 4.9%, bad speculation 0.7%, front-end 22.3%, back-end 72.1%' },
          { do: 'Check they add up.',
            why: 'A classifier that does not reconcile is describing rather than measuring.',
            work: '4.9 + 0.7 + 22.3 + 72.1 = 100.0%' },
          { do: 'Read the largest reason inside the dominant category.',
            why: 'The category says which half; the reason says which structure.',
            work: 'back-end bound at 72.1%, and the largest reason is "the reorder buffer is full"' },
          { do: 'Apply the change that implies - give the program addresses it can compute '
            + 'ahead - and re-run.',
            why: 'The buffer is full of loads waiting on misses that cannot overlap.',
            work: '`stride` over the same lines: 174 cycles, retiring 23.7%, back-end 60.2%' }
        ],
        answer: 'The verdict named the back end, the drill-down named the reorder buffer, and '
          + 'the change that empties a reorder buffer full of dependent loads is to make the '
          + 'loads independent - which is a data-structure change rather than a code change. '
          + 'Retiring rises from 4.9% to 23.7% and the cycle count falls by 3.9x, so the '
          + 'diagnosis was right. That last check is the part people skip: if the suggested '
          + 'change does not move the category it was aimed at, the diagnosis was wrong, and '
          + 'more tuning in that direction is time spent confirming a mistake rather than '
          + 'fixing one.'
      },
      {
        title: 'The same machine, three different verdicts',
        goal: 'Classify three programs on one unchanged configuration and see that the '
          + 'bottleneck is a property of the workload.',
        setup: 'Issue width 4, the default 4 KiB cache, a 32-entry reorder buffer and 64 '
          + 'physical registers. Nothing about the machine changes between the three runs.',
        steps: [
          { do: 'Classify `chase`.',
            why: 'A pointer chase with no independent misses.',
            work: '8.5% retiring, 85.7% back-end bound - 393 cycles for 133 instructions' },
          { do: 'Classify `factorial`.',
            why: 'Recursion, so calls and returns and data-dependent branches.',
            work: '29.2% retiring, 51.2% bad speculation - 107 cycles for 124 instructions' },
          { do: 'Classify `strlen`.',
            why: 'A short loop with byte loads.',
            work: '23.5% retiring, 48.5% front-end bound - 34 cycles for 31 instructions' },
          { do: 'List the actions each verdict implies.',
            why: 'This is the output of the method, not the shares.',
            work: 'chase: change the data layout; factorial: change the branch structure or '
              + 'the data; strlen: 1 more instruction per fetch block would help' },
          { do: 'Note what changed between the three runs.',
            why: 'To see what the verdict is a statement about.',
            work: 'nothing at all - one configuration, 3 programs' }
        ],
        answer: 'One machine produces three different verdicts, so "this processor is memory '
          + 'bound" is not a statement about the processor. That is the practical consequence '
          + 'of the method and the reason vendor characterisations of a chip are much less '
          + 'useful than a top-down run of your own code: the answer depends on what you are '
          + 'running, and it has to be re-measured when the workload changes rather than only '
          + 'when the hardware does. It is also why the four categories are worth more than '
          + 'any single number in this milestone - IPC would have reported 0.338, 1.159 and '
          + '0.912 for these three and told you nothing at all about what to do next.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
