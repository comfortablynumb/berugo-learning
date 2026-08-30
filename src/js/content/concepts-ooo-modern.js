/** Concepts for SMT, side channels and the modern core (M36.7-M36.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'simultaneous-multithreading': [
      {
        term: 'A second thread fills the holes the first one leaves',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["thread 0: a dependence chain"] --> H["most issue slots empty"]',
            '    B["thread 1: independent by construction"] --> H',
            '    H --> T["throughput rises; each thread is slower"]'
          ].join('\n'),
          caption: 'The second thread needs no analysis to be independent of the first, which '
            + 'is the one guarantee no compiler can give.'
        },
        plain: 'One thread cannot keep a wide core busy; two can share the empty slots.',
        formal: 'the gain comes from slots the first thread could not use',
        detail: 'A dependence chain leaves most issue slots empty in most cycles, and 36.1 '
          + 'showed that no amount of width fills them, because the parallelism is not in the '
          + 'code. A second thread supplies instructions that are independent of the first by '
          + 'construction rather than by analysis, so they fit exactly where the first '
          + 'thread\'s could not. The whole of SMT follows from that one observation.',
        example: 'Two copies of `chain` run together in 48 cycles against 76 sequentially - a '
          + 'gain of 1.58x.'
      },
      {
        term: 'It is a throughput gain and a latency loss, always',
        plain: 'Each thread is slower than it was alone; both together finish sooner.',
        formal: 'total instructions per cycle rises while per-thread instructions per cycle falls',
        detail: 'That is the same shape as pipelining in M35.1 and batching in every queueing '
          + 'system: throughput bought by making each unit of work take longer. What makes SMT '
          + 'worth singling out is that it is a switch somebody has to set, so the trade gets '
          + 'made explicitly - and it is made on folklore far more often than on a measurement '
          + 'of the two columns that decide it.',
        example: 'The `chain` pair gains 1.58x in total while the two threads run 1.03x and '
          + '1.26x slower than alone.'
      },
      {
        term: 'On a saturated core it buys nothing and costs plenty',
        plain: 'If one thread already used every port, the second one is only queueing.',
        formal: 'the speed-up approaches 1.00 as the first thread approaches full port utilisation',
        detail: 'This is the case that decides real configuration questions. A workload with '
          + 'high instruction-level parallelism already issues at the port limit, so the '
          + 'second thread finds no empty slots and simply takes turns - total throughput is '
          + 'unchanged and each thread takes about twice as long. Databases and latency-critical '
          + 'services disable SMT for exactly this reason, and they are right for their '
          + 'workload rather than superstitious.',
        example: 'Two copies of `independent` take 42 cycles together and 42 sequentially, '
          + 'with the threads 1.62x and 2.00x slower.'
      },
      {
        term: 'The shared cache can make a thread faster than it was alone',
        plain: 'One thread\'s misses fill the cache for the other.',
        formal: 'two threads over the same data share the cost of warming it',
        detail: 'This is the one case where a thread is better off sharing a core than owning '
          + 'one, and it is not a modelling artefact - it is why thread-per-request servers '
          + 'working on common data get on so well with SMT. It also makes the point that '
          + '"shared" and "contended" are not the same word: a shared structure is contended '
          + 'when the threads want different things from it and cooperative when they want the '
          + 'same thing.',
        example: 'Two copies of `chase` take 385 cycles together against 1356 sequentially, '
          + 'each finishing in about half its solo time.'
      },
      {
        term: 'Fetch bandwidth is the resource a thread gets starved of',
        plain: 'One thread is served per cycle, and which one is the policy.',
        formal: 'strict priority gives thread 0 every cycle, so thread 1 retires nothing',
        detail: 'Starvation here is not slowness, it is zero progress: over a fixed window the '
          + 'lower-priority thread retires no instructions at all. It is invisible in a '
          + 'completion time, because the starved thread finishes eventually once the other '
          + 'has stopped, which is why the measurement has to be taken over a fixed number of '
          + 'cycles. Fairness bugs found in production rather than in a benchmark almost '
          + 'always have this shape.',
        example: 'Over 150 cycles with strict priority and no guard, thread 1 retires 0 '
          + 'instructions and its longest starve is the whole window.'
      },
      {
        term: 'A starvation guard is one counter and it is not optional',
        plain: 'A thread that has waited too long takes the next slot whatever the policy says.',
        formal: 'if a thread has gone N cycles without a fetch slot it wins the next one',
        detail: 'The guard converts a policy that can starve into one that cannot, at a small '
          + 'cost to the favoured thread, and the cost is tunable by the threshold. It is the '
          + 'same construction as aging in an operating-system scheduler and as a fair-queueing '
          + 'discipline in a network: a priority rule plus a bound on how long anybody may be '
          + 'passed over. Any priority scheme without one has a starvation case, whether or '
          + 'not it has been found yet.',
        example: 'The same 150-cycle window with a guard of 4 gives thread 1 thirty-three '
          + 'retired instructions instead of zero.'
      },
      {
        term: 'ICOUNT is the policy that shipped, and its reasoning transfers',
        plain: 'Serve the thread with the fewest instructions already in flight.',
        formal: 'prefer the thread whose occupancy of the window is lowest',
        detail: 'A thread with many instructions in flight is either making progress or stuck, '
          + 'and in both cases it does not need more. That heuristic has no notion of priority '
          + 'or fairness in it and produces both, which is what makes it a good example of a '
          + 'scheduling rule: it optimises for a proxy - occupancy - that happens to correlate '
          + 'with everything the designer actually wanted.',
        example: 'ICOUNT and round robin give the same throughput on these pairs; strict '
          + 'priority gives less.'
      },
      {
        term: 'Partitioning the window fixes a different failure from the guard',
        plain: 'A thread can win a fetch slot and still be unable to dispatch.',
        formal: 'a stalled thread holding a shared window blocks the other at dispatch rather than at fetch',
        detail: 'The guard guarantees fetch slots and nothing else. A thread stalled on cache '
          + 'misses holds its reorder-buffer and issue-queue entries for the whole miss, and '
          + 'with a shared budget it can hold nearly all of them - so the other thread gets '
          + 'its slot and finds no room. Giving each thread a fixed share fixes that at a small '
          + 'cost, and every shipping SMT design partitions something for this reason.',
        example: 'With a guard of 8 and a shared window, thread 1 retires 20 instructions; '
          + 'partitioned, it retires 33 and total throughput rises.'
      },
      {
        term: 'Everything shared is also something observable',
        plain: 'The performance argument for sharing and the security argument against it are the same fact.',
        formal: 'two threads on one core share a cache, and a cache\'s state depends on what was accessed',
        detail: 'SMT is cheap because the expensive structures are shared and only the '
          + 'architectural state is duplicated. That same ratio is what makes two threads on '
          + 'one core able to read each other through timing in a way two threads on two cores '
          + 'cannot, and no amount of software isolation changes it. It is why some operators '
          + 'disable SMT for isolation reasons rather than performance ones, and why cloud '
          + 'providers stopped co-scheduling different tenants on one core.',
        example: 'Prime+Probe needs nothing shared with its victim but the cache, which two '
          + 'SMT threads have by construction.'
      }
    ],

    'microarchitectural-side-channels': [
      {
        term: 'The shape: a shared, stateful resource whose timing reveals its state',
        diagram: {
          definition: [
            'flowchart LR',
            '    P["put the resource in a known state"] --> V["let the victim run"]',
            '    V --> M["measure how long access takes now"]',
            '    M --> S["the difference is the secret"]'
          ].join('\n'),
          caption: 'Three steps, and they work on any structure that remembers what it was '
            + 'asked for.'
        },
        plain: 'Anything shared that remembers what it was asked for can carry a channel.',
        formal: 'the channel exists wherever access time depends on prior access',
        detail: 'A cache is the clearest example and far from the only one: branch predictor '
          + 'tables, translation buffers, the store queue and the execution ports are all '
          + 'shared and all stateful. The recipe never changes - put the resource in a known '
          + 'state, let the victim run, measure - so a defence that removes one instance '
          + 'without addressing the shape leaves the others in place. That is why the '
          + 'mitigations for this class keep arriving one at a time.',
        example: 'This lab uses the cache; the same three steps against a branch predictor '
          + 'give a different channel with the same structure.'
      },
      {
        term: 'Flush+Reload names the line it asks about',
        plain: 'Evict every probe line, let the victim run, then time each one.',
        formal: 'a hit is one cycle here and a miss is twenty, and exactly one line will be a hit',
        detail: 'Because the attacker chooses which line to ask about, the reading is exact: '
          + 'the position of the fast line in the probe array is the secret value. That '
          + 'precision is bought with a requirement - the attacker needs memory shared with '
          + 'the victim, such as a shared library or a deduplicated page - which is why '
          + 'disabling memory deduplication was one of the first deployed mitigations for this '
          + 'family.',
        example: 'One reload pass over sixteen lines shows fifteen at twenty cycles and one at '
          + 'one cycle.'
      },
      {
        term: 'Spectre is that channel plus a mispredicted bounds check',
        plain: 'The bounds check is a branch, and branches are predicted.',
        formal: 'training with in-bounds indices makes the out-of-bounds call speculate past the check',
        detail: 'The gadget is correct code: it checks the index before using it. The attacker '
          + 'calls it with legitimate indices until the predictor is confident, then calls it '
          + 'once out of bounds. The prediction says "in range", the two dependent loads run '
          + 'before the check resolves, and the second of them touches a cache line chosen by '
          + 'data the program was never allowed to read. Turning the training off stops the '
          + 'leak entirely, which is the mechanism rather than a switch.',
        example: 'With training set to zero the receiver recovers nothing; with six training '
          + 'calls it recovers the whole secret.'
      },
      {
        term: 'The leak is the cache state, not the discarded instructions',
        plain: 'The registers really are freed and the squash really is complete.',
        formal: 'a squash restores architectural state; a cache is not architectural state',
        detail: 'Everything the architecture promises is kept: the speculative registers are '
          + 'reclaimed, the instructions are removed from the buffer, and no value the program '
          + 'could read has changed. One cache line is resident that was not before, and no '
          + 'squash touches a cache - because a cache that undid its fills on a misprediction '
          + 'would be a cache that never helped. That is why "we roll back the registers" was '
          + 'never a mitigation.',
        example: 'The step table shows the register recovered and the line surviving at the '
          + 'same moment.'
      },
      {
        term: 'Meltdown is the same channel with a fault instead of a branch',
        plain: 'A load that will fault still delivered its data to the next instruction.',
        formal: 'the exception is taken at commit, and the dependent access happened before that',
        detail: 'On affected designs a load from a privileged address raised its fault at '
          + 'commit rather than blocking the dependent instruction, so the value reached a '
          + 'second load and left the same cache footprint. The receiver is identical to '
          + 'Spectre\'s; only the way the machine was persuaded to read the data differs. The '
          + 'fix - unmapping the kernel from user page tables - costs a page-table switch on '
          + 'every system call, which is why the mitigation was itself a performance story.',
        example: 'The five fault fixtures in 36.3 show a fault detected at address computation '
          + 'and taken at commit.'
      },
      {
        term: 'Noise makes the channel slower, never absent',
        plain: 'Repetition and a majority vote turn an unreliable reading into a reliable one.',
        formal: 'the recovery rate rises with the number of rounds and converges on the truth',
        detail: 'Other activity can evict the victim\'s line, hiding a real signal, or touch an '
          + 'unrelated line, manufacturing a false one. Both raise the error rate of a single '
          + 'round and neither removes the correlation, so an attacker with time simply raises '
          + 'the round count. "The channel is noisy" has therefore never been a defence, and '
          + 'the distinction that matters is between a channel that is slow and a channel that '
          + 'is not there.',
        example: 'At 30% noise the mean recovery rate goes from 6% at one round to 100% at '
          + '127 rounds.'
      },
      {
        term: 'The two mitigations fail in different ways, and both are instructive',
        plain: 'A barrier stops the access; a mask stops the address existing.',
        formal: 'the barrier leaves no hit at all; the mask leaves a working channel carrying public data',
        detail: 'Neither one tries to undo anything, which is the point. With a speculation '
          + 'barrier the receiver sees no hit and every round abstains. With index masking the '
          + 'channel still works perfectly and deterministically carries the in-bounds array '
          + 'instead of the secret. A mitigation\'s job is not to break the channel - it is to '
          + 'keep the secret out of it, and the second row is the clearer illustration of '
          + 'that.',
        example: 'Masked, the receiver recovers ABCDEFGH: the first eight entries of the '
          + 'public array, every time.'
      },
      {
        term: 'Prime+Probe is weaker, and works where Flush+Reload cannot',
        plain: 'It recovers the cache set rather than the value, and needs nothing shared.',
        formal: 'the reading is ambiguous whenever more values map to a set than there are sets',
        detail: 'Filling every way of every set with your own lines and seeing which sets lost '
          + 'one requires no shared memory at all, only the same cache - so it works across '
          + 'processes, across containers, and between two SMT threads on one core. What it '
          + 'gives back is a few address bits, so on a real cache with 256 possible byte values '
          + 'over 64 sets the reading always has several answers, and it is usually one stage '
          + 'of an attack rather than the whole of it.',
        example: 'On a 16-set cache with 16 values there are no collisions; halving the sets '
          + 'gives every reading two answers.'
      },
      {
        term: 'This is why constant-time code is about addresses, not only branches',
        plain: 'A table indexed by a secret byte leaks that byte through the cache.',
        formal: 'the rule is no secret-dependent addresses, not merely no secret-dependent branches',
        detail: 'M23 made the point for comparisons, and this section is the mechanism behind '
          + 'it. Code whose every branch is data-independent still leaks if the address it '
          + 'touches depends on a key, because the cache records which line was touched. That '
          + 'is why constant-time AES implementations avoid lookup tables, why bignum libraries '
          + 'use scatter-gather over full cache lines, and why "no branches on secrets" is '
          + 'half of the rule.',
        example: 'The gadget here has one secret-dependent address and no secret-dependent '
          + 'branch, and it leaks completely.'
      }
    ],

    'anatomy-of-a-modern-core': [
      {
        term: 'Every issue slot goes to exactly one of four categories',
        diagram: {
          definition: [
            'flowchart TD',
            '    S["width x cycles slots"] --> U{"used?"}',
            '    U -->|"yes"| C{"committed?"}',
            '    U -->|"no"| B{"back end could accept?"}',
            '    C -->|"yes"| R["retiring"]',
            '    C -->|"no"| X["bad speculation"]',
            '    B -->|"yes"| F["front-end bound"]',
            '    B -->|"no"| K["back-end bound"]'
          ].join('\n'),
          caption: 'Three questions, four leaves, and the shares sum to one because nothing '
            + 'takes two paths.'
        },
        plain: 'Retiring, bad speculation, front-end bound, back-end bound.',
        formal: 'the four shares sum to 100% because every slot is charged exactly once',
        detail: 'A cycle offers as many slots as the issue width. The used ones are split by '
          + 'whether the instruction survived to commit; the empty ones go to whichever stall '
          + 'category the cycle was in. Nothing is left over and nothing is counted twice, so '
          + 'the shares are comparable against each other in a way that a list of hardware '
          + 'counters with different denominators never is. That comparability is the whole '
          + 'contribution of the method.',
        example: 'On every program in the demo the four categories sum to 100.0%, and a test '
          + 'asserts it.'
      },
      {
        term: 'A high retiring share is not always good news',
        plain: 'A program doing the work it was asked to do will not be fixed by the processor.',
        formal: 'when retiring dominates, the remaining lever is the instruction count',
        detail: 'Retiring is the category everyone wants to be large, and when it is, the '
          + 'conclusion is that no microarchitectural investigation will pay. The machine is '
          + 'already doing what it was asked; the only way to make it faster is to ask for '
          + 'less, which means a better algorithm or less work per item. Learning that early '
          + 'saves the time otherwise spent tuning a program that has nothing left to give.',
        example: '`alias` is 48.2% retiring, the highest here, and it is also the fastest '
          + 'fixture at 1.893 instructions per cycle.'
      },
      {
        term: 'Bad speculation is where branchy, data-dependent code lands',
        plain: 'The slots were used by instructions that never committed.',
        formal: 'bad speculation counts the squashed slots plus the recovery slots',
        detail: 'This is the category that points at the data rather than at the code. A branch '
          + 'whose direction depends on unsorted input is unpredictable by construction, and '
          + 'the fix is never "predict better" - it is to sort the input, remove the branch, or '
          + 'change the representation. That is the same conclusion M35.9 reached from the '
          + 'other direction with the sorted-array result.',
        example: '`factorial` spends 51.2% of its slots on bad speculation and `arrayMax` '
          + '47.1%.'
      },
      {
        term: 'Back-end bound is usually memory, and the drill-down says which structure',
        plain: 'The front end had work ready and the machine would not take it.',
        formal: 'the stall reason names the full structure: buffer, queue, registers or load/store queue',
        detail: 'Four different structures produce the same category and want different '
          + 'changes: a full reorder buffer is a window problem, exhausted physical registers '
          + 'are a renaming-depth problem, a full issue queue is usually a long-latency '
          + 'operation, and a full load/store queue is memory pressure. Reporting the category '
          + 'without the reason gives a diagnosis nobody can act on, so the classifier keeps '
          + 'both.',
        example: '`chase` on a small cache is 72.1% back-end bound with "the reorder buffer is '
          + 'full" as the single largest reason.'
      },
      {
        term: 'Front-end bound needs care on a short program',
        plain: 'A window that holds the whole program runs out of program, not of bandwidth.',
        formal: 'the front end delivered nothing while the back end had room',
        detail: 'On these fixtures the machine sometimes has the entire program in flight, so '
          + 'the front end has genuinely nothing left to fetch. That is charged to front-end '
          + 'bound by the definition and it is not a decoder problem, so the drill-down says '
          + 'so in words. Real traces do not have this shape, and a classifier that reported '
          + 'the category without the reason would send somebody to look at code layout for no '
          + 'reason.',
        example: '`chain` is 74.3% front-end bound with "the whole program is already in '
          + 'flight" as the reason.'
      },
      {
        term: 'Applying the suggested change should move the category it named',
        plain: 'If it does not, the diagnosis was wrong.',
        formal: 'a code change with everything else held constant should shift the dominant share',
        detail: 'This is the test of the method rather than an application of it. Each matched '
          + 'fixture pair is a code change with the machine, the settings and often the '
          + 'instruction count held constant, so the category shift is attributable. When a '
          + 'change aimed at a category does not move it, more tuning in that direction is time '
          + 'spent confirming a mistake, and the right response is to re-measure rather than to '
          + 'try harder.',
        example: 'Turning `chase` into `stride` moves retiring from 4.9% to 23.7% and the '
          + 'cycle count from 678 to 174.'
      },
      {
        term: 'The verdict is a property of the program, not of the processor',
        plain: 'The same machine is front-end, back-end and speculation bound depending on what it runs.',
        formal: 'the dominant category varies across programs on identical hardware',
        detail: 'Across the twelve programs here on one configuration, every category is '
          + 'dominant somewhere. That makes a statement like "this processor is memory bound" '
          + 'meaningless without a workload attached, and it is why vendor-supplied '
          + 'characterisations of a chip are much less useful than a top-down run of your own '
          + 'code. It also means the measurement has to be repeated when the workload changes, '
          + 'not merely when the hardware does.',
        example: '`chase` is back-end bound, `factorial` bad-speculation bound and `strlen` '
          + 'front-end bound on the same machine.'
      },
      {
        term: 'Partition the total before arguing about any part of it',
        plain: 'Exhaustive, non-overlapping categories that sum to one.',
        formal: 'the method is a partition of the slot budget, not a list of counters',
        detail: 'That is why top-down works as a decision procedure while two hundred hardware '
          + 'counters do not. The same move underlies Amdahl\'s law, a flame graph, and a good '
          + 'incident review: before arguing about any one contribution, write down where 100% '
          + 'of the total goes. It costs nothing, it is portable to any performance question, '
          + 'and most of the time it changes what you were about to do next.',
        example: 'Four numbers replace a counter dump, and the largest non-retiring one names '
          + 'the next action.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
