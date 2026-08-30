/** Concepts for superscalar issue, speculation and memory parallelism (M36.4-M36.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'superscalar-issue': [
      {
        term: 'Issue width is a permission, not a speed-up',
        diagram: {
          definition: [
            'flowchart LR',
            '    W["issue width 8"] --> Q{"why did it not go 8x faster?"}',
            '    Q --> A["the code has no more parallelism"]',
            '    Q --> B["a port is already busy"]',
            '    Q --> C["the front end delivered nothing"]',
            '    Q --> D["the back end refused it"]'
          ].join('\n'),
          caption: 'Four answers, four different next actions, and the same flat graph.'
        },
        plain: 'The machine may start that many instructions; it usually starts fewer.',
        formal: 'width bounds the instructions issued per cycle and does not determine them',
        detail: 'Every width sweep in this milestone produces a curve that rises and then '
          + 'flattens, and the flat part is the interesting part. There are exactly four '
          + 'reasons it flattens and they call for completely different responses - rewrite '
          + 'the algorithm, add units, fix the front end, or enlarge a buffer. Choosing the '
          + 'wrong one is how a quarter gets spent on an optimisation that could not have '
          + 'worked, so the demo names the reason rather than reporting the curve.',
        example: 'Eight times the width buys between 1.00x and 2.37x across the twelve '
          + 'programs here.'
      },
      {
        term: 'A port limit looks like a spike in the issue histogram',
        plain: 'Exactly two instructions issue per cycle and never three.',
        formal: 'the histogram of instructions issued per cycle has a hard ceiling at the port count',
        detail: 'The average IPC hides this completely. A machine four wide that issues two '
          + 'instructions in most of its working cycles is a machine two wide with extra '
          + 'logic, and only the distribution shows it. When the ceiling in the histogram sits '
          + 'below the configured width, the answer is the port mix rather than anything about '
          + 'the code, and the fix is a different instruction mix or a different machine.',
        example: 'On `independent` at width 4 the histogram is 17 cycles issuing exactly two '
          + 'and 4 issuing none.'
      },
      {
        term: 'Latency and initiation interval are different numbers',
        plain: 'A pipelined unit takes a new operation every cycle however long its result takes.',
        formal: 'latency is when the result appears; the initiation interval is when the next may start',
        detail: 'Conflating the two makes every functional unit block for its full latency, '
          + 'which halves the throughput of every port that has a multi-cycle operation. The '
          + 'symptom is specific and easy to misread: the machine saturates at an IPC near one '
          + 'whatever the width, and the width-explorer curve then tells a true story about '
          + 'the model and a false one about processors. This simulator had exactly that bug '
          + 'until the two were separated.',
        example: 'A load has a latency of two cycles and an initiation interval of one, so the '
          + 'memory port serves one access per cycle.'
      },
      {
        term: 'The cost of width grows faster than its benefit',
        plain: 'Doubling the width roughly quadruples the select logic.',
        formal: 'wakeup cost grows with window times width, and the bypass network with width squared',
        detail: 'Wakeup broadcasts a finished result to every waiting entry; select is a '
          + 'priority encoder over the ready set; the bypass network has to carry every '
          + 'producer to every consumer in the cycle after the producer finishes. All of that '
          + 'sits inside a single clock period, so it eats directly into frequency rather than '
          + 'being pipelined away. That is why practical widths settled at four to six and the '
          + 'industry started adding cores instead.',
        example: 'At a window of 32, width 4 needs 128 tag comparators and 16 bypass paths; '
          + 'width 8 needs 256 and 64.'
      },
      {
        term: 'The front end runs out at a taken branch',
        plain: 'A fetch block ends where the code stops being contiguous.',
        formal: 'a fetch unit n wide delivers min(n, instructions to the next taken branch)',
        detail: 'Basic blocks in real code average well under eight instructions, so a fetch '
          + 'unit eight wide spends much of its time delivering four or five. That is a hard '
          + 'limit on how much a wide back end can be fed, and it is why the micro-operation '
          + 'cache and the loop buffer exist: both are ways to keep delivering past a branch '
          + 'by supplying decoded instructions from a structure that is not laid out in '
          + 'program order.',
        example: 'On `strlen` the machine is front-end bound at every width and is still '
          + 'getting faster at width 8.'
      },
      {
        term: 'The issue queue and the window are separate limits',
        plain: 'One holds instructions waiting for an operand, the other instructions waiting to commit.',
        formal: 'the issue queue empties at issue; the reorder buffer empties at commit',
        detail: 'They fill for different reasons and either can be the binding constraint. A '
          + 'program stalled on a dependence chain fills the issue queue with instructions '
          + 'short of an operand; a program stalled on a cache miss fills the reorder buffer '
          + 'with finished instructions waiting for the head. Reporting "the back end is full" '
          + 'without saying which structure is a diagnosis that cannot be acted on, which is '
          + 'why the stall reason names the structure.',
        example: 'The dispatch-stall reasons distinguish a full buffer, a full queue, a full '
          + 'load/store queue and no free physical register.'
      },
      {
        term: 'Nobody gets the speed-up the width advertises',
        plain: 'Quoting width as a speed-up is quoting one factor of a product.',
        formal: 'time = instructions x cycles per instruction x clock period, and width touches only the middle term',
        detail: 'This is the same error as quoting instructions per cycle without the clock, '
          + 'which M34.6 spent a section on, and it survives because width is the number that '
          + 'appears on a slide. A wider machine has a longer select loop and therefore, all '
          + 'else equal, a longer clock period - so the honest comparison of a four-wide and '
          + 'an eight-wide design is a product of three terms, two of which move in opposite '
          + 'directions.',
        example: 'Going from width 1 to width 8 is worth 1.00x on `chain` and 2.37x on '
          + '`alias`, never eight.'
      },
      {
        term: 'The knee of the curve is the diagnosis',
        plain: 'Where the line flattens says which of the four answers applies.',
        formal: 'the smallest width at which further doubling does not reduce the cycle count',
        detail: 'A curve that is flat from width 1 is a dependence chain. A curve that steps '
          + 'once and stops is a port limit. A curve still rising at the largest width tested '
          + 'is a machine that was genuinely too narrow. Reading the knee is faster than '
          + 'reading a profile and it needs only one control, which is what makes the width '
          + 'explorer the single most useful picture in this milestone.',
        example: '`chain` is flat from width 1, `independent` steps once at width 2, and '
          + '`strlen` is still climbing at width 8.'
      }
    ],

    'speculation-and-recovery': [
      {
        term: 'Every guess has three parts, and the third is the expensive one',
        diagram: {
          definition: [
            'flowchart LR',
            '    G["something makes a guess"] --> W["something else finds it was wrong"]',
            '    W --> R{"recovery"}',
            '    R -->|"a checkpoint was taken"| F["restore: one copy"]',
            '    R -->|"nobody checkpointed here"| U["unwind: one step per instruction"]'
          ].join('\n'),
          caption: 'The branch had a checkpoint because the machine knew it was guessing. A '
            + 'load that aliases is a surprise, and surprises cost more.'
        },
        plain: 'Guess, detect, recover — and recovery differs by where the guess was made.',
        formal: 'the machine speculates on branch direction, jump targets, memory independence and the absence of faults',
        detail: 'Branches and jumps are places the machine knows in advance that it might be '
          + 'wrong, so it takes a checkpoint of the alias table when the instruction is '
          + 'renamed and recovery is a single copy. A load that turns out to alias an older '
          + 'store is not such a place, so recovery walks the reorder buffer backwards undoing '
          + 'each rename in turn. Both mechanisms have to exist, because a checkpoint is only '
          + 'available where somebody thought to take one.',
        example: 'A run of `hiddenAlias` recovers twice by unwinding, walking back 39 buffer '
          + 'entries in the process.'
      },
      {
        term: 'Memory dependence speculation is worth measuring, on the right fixture',
        plain: 'A load may pass a store whose address is not yet known.',
        formal: 'conservative ordering waits for every older store; speculation waits only for the predicted ones',
        detail: 'The fixture has to have a store whose address genuinely arrives late, or the '
          + 'control does nothing at all. With both addresses in registers the store resolves '
          + 'before the load is even selected, and switching speculation off changes the cycle '
          + 'count by zero - a control with no effect looks exactly like a control with no '
          + 'importance. Loading the store address from memory makes the guess real and the '
          + 'measurement possible.',
        example: 'On `hiddenDisjoint`, conservative ordering takes 59 cycles and speculation '
          + '43 - a gain of 1.37x.'
      },
      {
        term: 'A store-set predictor turns a repeated mistake into a single one',
        plain: 'Remember the loads that were wrong, and speculate freely on the rest.',
        formal: 'a load that has aliased before waits for older stores; every other load goes',
        detail: 'Without it, a load that aliases every iteration misspeculates every iteration '
          + 'and speculation is a pure loss. With it the machine is wrong twice, records the '
          + 'load, and waits from then on - so the cost of a bad guess is bounded by the '
          + 'learning rate rather than by the loop count. That is Chrysos and Emer\'s result, '
          + 'and it is the reason aggressive memory speculation is safe to ship: the failure '
          + 'mode is self-limiting.',
        example: 'On `hiddenAlias` speculation costs one cycle against conservative ordering, '
          + 'with two misspeculations and one store set learned.'
      },
      {
        term: 'Wasted work is the number nobody quotes',
        plain: 'Everything on the wrong path was decoded, renamed, issued and executed.',
        formal: 'wasted share = squashed instructions / fetched instructions',
        detail: 'Speculation buys time with energy, and the energy is spent whether or not the '
          + 'guess was right. The instructions on a wrong path go through every stage of the '
          + 'machine before anybody discovers the mistake, and the correct answer only buys '
          + 'the fact that some of the work was useful. On a plugged-in machine that is '
          + 'invisible; on a battery it is a line item, and it is why efficiency cores '
          + 'speculate less rather than being simply smaller.',
        example: '`factorial` fetches 323 instructions to retire 124, so 61% of the front '
          + 'end\'s work is discarded.'
      },
      {
        term: 'A deeper window speculates further and throws more away',
        plain: 'The extra depth is spent on a path that may be wrong.',
        formal: 'squashed work grows with the window on a branchy program, and the cycle count can grow with it',
        detail: 'The usual argument for a larger reorder buffer is memory-level parallelism, '
          + 'and it is correct for programs with independent misses. On a program whose limit '
          + 'is an unpredictable branch, the extra entries are filled with instructions that '
          + 'will be squashed, so the machine gets slower and less efficient at the same time. '
          + 'That makes window size a workload-dependent trade rather than a number to '
          + 'maximise.',
        example: '`arrayMax` takes 52 cycles at 32 entries and 54 at 64, and squashes 92 '
          + 'instructions against 140.'
      },
      {
        term: 'Checkpoints are finite, and running out changes the machine',
        plain: 'A design supports a fixed number of unresolved branches.',
        formal: 'when no checkpoint is available the next branch stalls rather than speculating',
        detail: 'A checkpoint is a copy of the alias table and the free list, so it costs real '
          + 'storage and there can only be a few. That number is the maximum depth of '
          + 'speculation past unresolved branches, and it is a published microarchitectural '
          + 'parameter for the same reason the reorder buffer size is. Code with a very high '
          + 'branch density can exhaust it, at which point a wide machine behaves like a '
          + 'narrow one for reasons no instruction count explains.',
        example: 'Every branch and jump takes a checkpoint here, and each one is dropped when '
          + 'its instruction commits.'
      },
      {
        term: 'Value prediction is the idea that did not pay off',
        plain: 'Results really are repetitive, and it still did not ship.',
        formal: 'a predicted value must be compared against every real value, and a wrong one costs a full unwind',
        detail: 'Predicting what a load will return breaks true dependences, which is the one '
          + 'thing renaming cannot do, so the potential gain is large. It failed on the '
          + 'accounting: verification costs a comparison on every prediction, the misprediction '
          + 'rate is high on exactly the values worth predicting, and recovery is the '
          + 'expensive unwind rather than a checkpoint restore. Saying so is a better lesson '
          + 'than a control that pretends to implement it.',
        example: 'The guesses table lists it as not implemented, alongside the four kinds this '
          + 'machine does make.'
      },
      {
        term: 'The pattern generalises to anything done eagerly',
        plain: 'Prefetching, eager evaluation and speculative retries are the same shape.',
        formal: 'the value of speculation is the hit rate times the saving, minus the full cost of every attempt',
        detail: 'Any optimisation that does work before knowing whether it is needed has this '
          + 'accounting, and the question is never whether it is faster in the good case. It '
          + 'is what the hit rate is and who pays for the misses - which may be a different '
          + 'party from the one who benefits, as with a speculative retry that doubles the '
          + 'load on an already-struggling service. Naming the shape makes the right question '
          + 'obvious.',
        example: 'A hedged request in a distributed system is branch prediction with the '
          + 'wasted work paid by the server rather than the client.'
      }
    ],

    'memory-level-parallelism': [
      {
        term: 'The same misses, overlapped or not',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["array: addresses known in advance"] --> M1["four misses in flight"]',
            '    M1 --> T1["one memory latency covers four lines"]',
            '    B["list: the next address is the last load result"] --> M2["one miss in flight"]',
            '    M2 --> T2["one memory latency per line"]'
          ].join('\n'),
          caption: 'Identical miss counts, and one of them pays the latency four times less '
            + 'often.'
        },
        plain: 'An array walk and a pointer chase over the same lines differ by four times.',
        formal: 'memory-level parallelism is the average number of misses outstanding while any are',
        detail: 'The miss count is the number every profiler reports and it cannot tell these '
          + 'two programs apart: both miss exactly 32 times on a 256-byte cache. What differs '
          + 'is whether the misses can be in flight at once, and that is decided by whether '
          + 'the program knows the next address before the previous load has returned. The '
          + 'unit that separates them is misses-in-flight, and it needs a different counter '
          + 'from the one people reach for.',
        example: '`stride` measures 3.86 misses in flight and takes 174 cycles; `chase` '
          + 'measures 1.00 and takes 678.'
      },
      {
        term: 'A non-blocking cache is what makes overlap possible',
        plain: 'On a miss it records the line and carries on serving.',
        formal: 'a miss occupies one miss status holding register until the line returns',
        detail: 'A blocking cache stops the machine on a miss, so no amount of window or width '
          + 'produces overlap. A non-blocking one records the outstanding line in a register '
          + 'and keeps accepting accesses, and the number of those registers is a hard cap on '
          + 'how many misses can be in flight. That turns "how much memory parallelism does '
          + 'this program have" from a property of the code into a property of the machine - '
          + 'but only for code that has any.',
        example: 'Sweeping the registers from 1 to 8 takes `stride` from 648 cycles to 128 and '
          + 'leaves `chase` at 678 throughout.'
      },
      {
        term: 'Overlap needs a window as well as registers',
        plain: 'The second miss can only start if its instruction has been dispatched.',
        formal: 'the reorder buffer bounds how far ahead the machine can look for the next miss',
        detail: 'Miss registers are useless if the instruction that would cause the next miss '
          + 'has not been dispatched, and it cannot be dispatched if the buffer is full of '
          + 'instructions waiting behind the first miss. So the two structures have to be '
          + 'sized together, and the argument for a very large window is a memory argument '
          + 'rather than an instruction-level one - which is why window sizes kept growing '
          + 'long after issue widths stopped.',
        example: '`stride` takes 378 cycles with 8 buffer entries and 174 with 32, at the same '
          + 'four miss registers.'
      },
      {
        term: 'This is why an array beats a linked list, and it is not locality',
        plain: 'Hold the miss counts equal and the array is still four times faster.',
        formal: 'the gap survives when both traversals touch the same lines and miss the same number of times',
        detail: 'The usual explanation is locality: contiguous elements share a cache line, so '
          + 'one miss serves several accesses. That is true and it is a different effect. '
          + 'These two fixtures are constructed to touch exactly the same lines and miss '
          + 'exactly the same number of times, which removes locality from the comparison '
          + 'entirely, and the array is still nearly four times faster. Prefetching then '
          + 'amplifies the gap further because a stride is predictable and a chase is not.',
        example: 'Both fixtures miss 32 times on a 256-byte cache; 174 cycles against 678.'
      },
      {
        term: 'Store-to-load forwarding: the load that never reaches memory',
        plain: 'The value comes from the store queue, because memory does not have it yet.',
        formal: 'a load takes its value from the newest older store to the same address, if there is one',
        detail: 'A store does not write memory until it commits, so a younger load to the same '
          + 'address would read a stale value if it went to the cache. Forwarding is therefore '
          + 'a correctness requirement before it is an optimisation, and it costs an '
          + 'associative search of the store queue on every load. The performance consequence '
          + 'is worth knowing: a store immediately followed by a load of the same address is '
          + 'very nearly free.',
        example: 'The `alias` run forwards 8 of its loads and makes zero cache accesses in '
          + 'total.'
      },
      {
        term: 'Four ordering rules, and three of them are trades',
        plain: 'One is correctness; the rest let something go earlier than it provably could.',
        formal: 'stores wait for commit; loads forward, may pass unknown stores, and occupy a miss register',
        detail: 'Only the first rule is forced. Forwarding, memory dependence speculation and '
          + 'the miss registers are all mechanisms for starting something before its safety is '
          + 'established, and each therefore needs a way to detect a mistake and undo it. That '
          + 'gives the memory system the same three-part structure as every other kind of '
          + 'speculation in the milestone, which is a better way to remember the rules than a '
          + 'list.',
        example: 'The store-set predictor is the "detect and remember" half of the third rule.'
      },
      {
        term: 'The measurement has to be averaged over the right cycles',
        plain: 'Average over the whole run and you mostly measure how much of it was not memory.',
        formal: 'the average is taken over the cycles when at least one miss was outstanding',
        detail: 'Dividing total outstanding-miss-cycles by the whole run length gives a smaller '
          + 'number for a program that spent less time waiting, which is the wrong direction '
          + 'for every conclusion this metric is used to reach. Restricting the average to the '
          + 'cycles when memory was actually busy makes it a statement about the memory '
          + 'behaviour rather than about the mix, and it is the same discipline as charging '
          + 'pipeline bubbles at the commit point in M35.',
        example: '`chase` spends 94% of its cycles with a miss outstanding, and the average '
          + 'over those cycles is exactly 1.00.'
      },
      {
        term: 'Prefetching interacts with all of this, and it is M37\'s subject',
        plain: 'A predictable pattern can be fetched before the program asks.',
        formal: 'a prefetcher issues accesses for addresses it expects, which raises overlap further',
        detail: 'A hardware prefetcher watching a strided walk sees a constant delta and can '
          + 'run arbitrarily far ahead of the program, which raises the achievable overlap '
          + 'above what the window alone allows. Watching a pointer chase it sees a sequence '
          + 'of unrelated addresses and can do nothing. The property that gives an array its '
          + 'memory-level parallelism is the same one that makes it predictable, so the two '
          + 'effects compound rather than merely coexisting.',
        example: 'The simulator has no prefetcher, so the 3.9x gap here is the floor rather '
          + 'than the whole effect.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
