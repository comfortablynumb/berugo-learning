/** Concepts for precise exceptions, depth limits and pipeline-friendly code (M35.7-M35.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'precise-exceptions-pipelined': [
      {
        term: 'Precise means the machine can pretend it executed strictly in order',
        diagram: {
          definition: [
            'flowchart LR',
            '    F["fetch"] -->|"flag"| D["decode"]',
            '    D -->|"flag"| E["execute"]',
            '    E -->|"flag"| M["memory"]',
            '    M -->|"flag"| W["write-back: the commit point"]',
            '    W --> T["trap taken here"]',
            '    E -.->|"squash now"| Y["everything younger"]'
          ].join('\n'),
          caption: 'The flag travels to the commit point so older instructions finish; the '
            + 'squash happens immediately so nothing younger has an effect. Both halves are '
            + 'necessary.'
        },
        plain: 'Everything before the fault has completed; nothing after it has had any effect.',
        formal: 'the state at the handler is the state a one-instruction-at-a-time machine would have',
        detail: [
          'That promise is what the whole software stack assumes.',
          'A debugger showing a coherent state, a page-fault handler restarting the access it just '
            + 'fixed, a context switch saving a register set: none of them work without it.',
          'None of them would be written differently if the hardware were slightly cheaper and '
            + 'imprecise.',
          'They would simply be impossible.'
        ],
        example: 'At the same number of retired instructions, this pipelined machine\'s '
          + 'registers are identical to the M34 behavioural simulator\'s on all five fault '
          + 'classes.'
      },
      {
        term: 'It is free on a single-cycle machine and it is not free here',
        plain: 'One instruction at a time has nothing to be imprecise about.',
        formal: 'five in flight: two younger than the fault, two older and not yet committed',
        detail: [
          'The M34 machine got precision by construction, and the cost only appears once '
            + 'instructions overlap.',
          'That is the general shape of an abstraction.',
          'It is cheap while the implementation happens to match it, and expensive once the '
            + 'implementation diverges.',
          'The abstraction is kept anyway, because everything above it depends on it.'
        ],
        example: 'Precision here costs a flag per stage, a squash path from every stage back to '
          + 'fetch, and a commit point; in M36 it costs an entire reorder buffer.'
      },
      {
        term: 'Faults are detected in different stages and the flag travels',
        plain: 'Fetch, decode, execute and memory can each raise one.',
        formal: 'the fault is recorded on the instruction rather than acted on where it was found',
        detail: [
          'A misaligned fetch is known at fetch, an illegal opcode at decode, an environment call '
            + 'at execute, and a misaligned or unmapped data access at memory.',
          'Acting immediately would break the ordering, because an older instruction still in the '
            + 'pipeline has to finish first.',
          'So the flag rides along and the trap happens at the commit point.',
          'That is the only place where "everything older is done" is true by construction.'
        ],
        example: 'A misaligned load is detected in the memory stage and the trap commits one '
          + 'cycle later, at write-back.'
      },
      {
        term: 'Squash immediately, commit late, and both are load-bearing',
        plain: 'Squashing alone loses work; committing alone lets a younger store escape.',
        formal: 'younger instructions are killed at detection; the trap is taken at write-back',
        detail: [
          'If the trap were taken at detection, the older instructions still in the pipeline would '
            + 'be thrown away with it, and the handler would see a state that never existed.',
          'If the squash waited for the commit point, a store two stages behind the fault would '
            + 'reach memory first.',
          'That is precisely what precise forbids.',
          'Neither half is optional and neither is obvious from the definition alone.'
        ],
        example: 'On a misaligned load the trap commits one cycle after detection, and five '
          + 'instructions fetched after it never commit anything.'
      },
      {
        term: 'A fault on the wrong path is not a fault',
        plain: 'Fetch reads past the end of a mispredicted branch and finds zeros.',
        formal: 'the flag has to be as speculative as the instruction carrying it',
        detail: [
          'Decoding zeros as an illegal instruction is correct. Acting on it is not, because that '
            + 'instruction was never going to execute.',
          'A machine that freezes on such a flag and does not unfreeze when the branch resolves '
            + 'stops dead on the first mispredicted loop exit.',
          'That is exactly what this simulator did before the check existed.',
          'Speculative state includes speculative exceptions.'
        ],
        example: 'Each iteration of a loop with an unpredicted exit fetches past the end and '
          + 'raises an illegal-instruction flag that is squashed a cycle later.'
      },
      {
        term: 'mret and control-register writes are serialising',
        plain: 'The pipeline drains around them.',
        formal: 'there is no forwarding path from a control register',
        detail: [
          'A trap handler reads mcause into a register and branches on it, writes mepc, and then '
            + 'returns through mret.',
          'That mret reads the mepc the instruction two ahead of it just wrote.',
          'Nothing forwards a control register, so the only correct answer is to drain.',
          'That is a real cost. It is why a trap is far more expensive than its instruction count '
            + 'suggests, and the same reason system calls are expensive enough to have shaped '
            + 'every high-performance I/O interface.'
        ],
        example: 'The six-instruction handler in the demo drains the pipeline twice, once for '
          + 'the mepc write and once for the mret.'
      },
      {
        term: 'Branch recovery and exception recovery are the same machinery',
        plain: 'Both kill younger instructions and redirect fetch.',
        formal: 'speculation is the ability to undo, and exceptions are an undo',
        detail: [
          'That is not a coincidence and it is worth noticing.',
          'A machine that already speculates on branches gets precise exceptions almost free, and '
            + 'a machine that wants precise exceptions has most of what speculation needs.',
          'It also explains why both got much harder at the same moment in history.',
          'Out-of-order execution broke the ordering that made both of them easy.'
        ],
        example: 'The same squash path serves a mispredicted branch and a memory fault in this '
          + 'machine.'
      },
      {
        term: 'Everything in M36 exists to break the order while preserving the illusion',
        plain: 'Finish in any order; commit in program order.',
        formal: 'a reorder buffer holds results until they can be committed in sequence',
        detail: [
          'Out-of-order execution lets instructions complete whenever their operands allow.',
          'That destroys every "yes, by construction" this machine relies on.',
          'Writes no longer happen in order, a squashed instruction may already have finished, and '
            + 'a store may be waiting in a buffer.',
          'Each of those becomes a hardware structure whose only purpose is to make the machine '
            + 'look like this one again.'
        ],
        example: 'Register renaming, the reorder buffer and the store buffer are three answers '
          + 'to three properties this pipeline gets for nothing.'
      }
    ],

    'pipeline-depth-limits': [
      {
        term: 'Two things do not divide, and they are what bound the depth',
        diagram: {
          definition: [
            'flowchart TB',
            '    A["one stage: 175 of logic + 3 = 178"] --> B["five: 35 + 3 = 38"]',
            '    B --> C["twenty: 9 + 3 = 12"]',
            '    C --> D["the overhead is now 25% of every cycle"]',
            '    C --> E["and a mispredict costs 16 instructions, not 2"]'
          ].join('\n'),
          caption: 'The logic divides. The register overhead and the branch penalty do not — '
            + 'one is paid per stage and the other is measured in stages.'
        },
        plain: 'The register overhead per stage, and the branch penalty measured in stages.',
        formal: 'period = ceil(logic / k) + overhead; penalty grows with k',
        detail: 'Cutting the logic into more stages divides only the logic. The flip-flop '
          + 'overhead is paid once per stage whatever the stage contains, so its share of the '
          + 'period rises; and the misprediction penalty is the distance from fetch to '
          + 'resolution measured in stages, so it rises too. Together they turn a monotone gain '
          + 'into a curve with a bottom, which is why no pipeline is infinitely deep.',
        example: 'At twenty stages the overhead is 25% of every cycle and a mispredict costs '
          + '16 instructions instead of 2.'
      },
      {
        term: 'The optimum is a property of the workload, not of the machine',
        plain: 'Predictable branches can afford depth; unpredictable ones cannot.',
        formal: 'the penalty enters CPI multiplied by the mispredict rate',
        detail: 'A program that rarely mispredicts barely notices a longer penalty and enjoys '
          + 'the shorter clock; a program full of data-dependent branches pays the penalty '
          + 'constantly and wants a shallow machine. The same silicon is right for one and '
          + 'wrong for the other, which is the central difficulty of designing a '
          + 'general-purpose processor and the reason the answer has always been a compromise '
          + 'rather than an optimum.',
        example: 'At a realistic register overhead the branchy workload wants roughly half the '
          + 'depth the predictable one does.'
      },
      {
        term: 'Our datapath\'s ratio is unusually generous and the model says so',
        plain: '175 gate delays of logic against 3 of overhead is 58 to 1.',
        formal: 'a real stage is nearer ten to one',
        detail: 'The M34 ALU is an unoptimised ripple-carry design, so the logic term is far '
          + 'larger relative to the register overhead than any real design\'s — and with that '
          + 'ratio the model recommends a very deep pipeline, which is a correct consequence of '
          + 'a datapath nobody would ship. Exposing the overhead as a control rather than '
          + 'quietly substituting a nicer number is the honest way to present a model whose '
          + 'defaults come from a toy.',
        example: 'Raising the overhead from 3 to 17 gate delays moves the fastest depth from 35 '
          + 'stages to 18 on the branchy workload.'
      },
      {
        term: 'Performance alone recommends a deeper pipeline than anybody built',
        plain: 'That is the historical result, not a flaw in the model.',
        formal: 'time is minimised well past the depth any shipped machine used',
        detail: 'What stopped depth was power rather than instructions per cycle, and the '
          + 'literature reports the power-aware optimum at roughly half the performance one. '
          + 'A model that only reported time would recommend the Pentium 4 and stop there; '
          + 'reporting both is what makes it match what the industry actually did after paying '
          + 'to find out.',
        example: 'On the branchy workload the fastest depth is 35 stages and the most efficient '
          + 'is 18.'
      },
      {
        term: 'Performance per watt on its own is a degenerate metric',
        plain: 'It is maximised by an arbitrarily slow machine.',
        formal: 'power falls faster than speed does, so the ratio rewards doing nothing',
        detail: 'That is why the pipeline-depth literature uses performance cubed per watt '
          + 'rather than something simpler: cubing the performance term stops the metric '
          + 'preferring a machine that is slow and cheap over one that is fast and expensive. '
          + 'It is a good reminder that a ratio of two quantities needs its degenerate cases '
          + 'checked before it is used to decide anything.',
        example: 'Reported as performance per watt, every curve in this model peaks at one '
          + 'stage, which is not a result about pipelining.'
      },
      {
        term: 'The curve is steep on the left and flat on the right',
        plain: 'Undershooting the optimum costs far more than overshooting it.',
        formal: 'time falls by an order of magnitude in the first few stages and climbs slowly after the bottom',
        detail: 'That asymmetry is useful whenever the right depth is uncertain: err deep. The '
          + 'same shape appears in almost every tuning parameter with diminishing returns — '
          + 'batch sizes, cache sizes, thread counts — and the practical consequence is the '
          + 'same, which is that the cost of being conservative is usually larger than the cost '
          + 'of being aggressive.',
        example: 'From one stage to five, the model\'s time falls from 220 275 to 51 300; from '
          + 'the optimum to the end of the range it rises by less than 5%.'
      },
      {
        term: 'Superpipelining trades frequency against instructions per cycle',
        plain: 'A faster clock and a worse CPI, and only the product decides.',
        formal: 'the same three-term equation as M34.6, applied to depth',
        detail: 'Every argument in this section is the performance equation again. What changes '
          + 'with depth is that two of its terms move in opposite directions at once, which is '
          + 'exactly the situation in which quoting one of them is most misleading — and '
          + 'frequency is the one that fits on a box.',
        example: 'The Pentium 4 raised frequency and lost on real work to a design running at '
          + 'two thirds the clock.'
      },
      {
        term: 'The overhead-per-stage argument caps every pipeline, including software ones',
        plain: 'Work divides; boundaries multiply.',
        formal: 'past some depth, more is paid in boundaries than is saved in stage length',
        detail: 'In silicon the boundary is a flip-flop\'s setup and clock-to-output time; in a '
          + 'software pipeline it is a queue, a serialisation, a context switch or a network '
          + 'hop, and it is usually far more expensive relative to the work than three gate '
          + 'delays are. A team splitting a service into twelve is making exactly this trade, '
          + 'and the difference is that the processor people measured the boundary cost first.',
        example: 'The branch penalty has a software analogue too: every stage between a '
          + 'decision and its consequence is work thrown away when the decision was wrong.'
      }
    ],

    'pipeline-friendly-code': [
      {
        term: 'The sorted-array result is about prediction, not about memory',
        diagram: {
          definition: [
            'flowchart TB',
            '    S["a data-dependent branch in a hot loop"] --> M{"is it predictable?"}',
            '    M -->|"yes"| K["leave it: a predicted branch is free"]',
            '    M -->|"no"| P{"what is the penalty?"}',
            '    P -->|"small"| K2["still leave it: the extra instructions cost more"]',
            '    P -->|"large"| B["branchless"]',
            '    M -->|"can it be sorted?"| SO["sort it"]'
          ].join('\n'),
          caption: 'Two of the three numbers in this decision are properties of the machine '
            + 'rather than of the code, which is why the answer changes without the source '
            + 'changing.'
        },
        plain: 'The same values in a different order, and the same answer.',
        formal: 'sorted data makes the branch two long runs; shuffled makes it a coin flip',
        detail: 'The branch is taken the same number of times either way, so nothing about the '
          + 'work changes. What changes is whether a two-bit counter can learn the pattern, and '
          + 'a long run of not-taken followed by a long run of taken is the easiest pattern '
          + 'there is. Reporting mispredicts rather than only time is what separates this '
          + 'explanation from the half-dozen others a timing difference would admit.',
        example: 'The same 64 values: 4 mispredicts sorted and 34 shuffled, for 503 cycles '
          + 'against 563, computing 6 947 both times.'
      },
      {
        term: 'Branchless code trades a possible mispredict for a certain cost',
        plain: 'Three extra instructions per element, every element, forever.',
        formal: 'slt produces 0 or 1; subtracting one makes a mask; the AND applies it',
        detail: 'The branchy loop pays nothing when the predictor is right and pays the penalty '
          + 'when it is wrong. The branchless loop pays its extra instructions unconditionally, '
          + 'whether or not there was ever a misprediction to avoid. So the comparison is extra '
          + 'instructions against mispredict rate times penalty, and it is not a matter of '
          + 'style.',
        example: '424 instructions branchy against 581 branchless, for the same answer over the '
          + 'same data.'
      },
      {
        term: 'On this machine branchless loses, and that is why it is measured',
        plain: 'A two-cycle penalty is not worth three instructions per element.',
        formal: 'the break-even penalty is about 4.8 cycles here',
        detail: 'Thirty extra mispredicts at two cycles each is sixty cycles; three extra '
          + 'instructions across sixty-four elements is nearly two hundred. Below about five '
          + 'cycles of penalty the branchy version wins even on shuffled data, and above it the '
          + 'branchless one does. Nothing about the source decides that — the machine does.',
        example: 'Branchless takes 654 cycles regardless of order, against 503 sorted and 563 '
          + 'shuffled for the branchy version.'
      },
      {
        term: 'The same code wins on a different machine',
        plain: 'Scale the penalty and the answer flips.',
        formal: 'at 5 cycles branchless wins; at 20 it wins by a wide margin',
        detail: 'That is the most useful thing in this section: an optimisation whose '
          + 'correctness as an optimisation depends on a hardware parameter. Advice of the form '
          + '"prefer branchless code" is therefore not advice at all unless it names the '
          + 'penalty and the mispredict rate it assumes, and most of it does not.',
        example: 'At a 20-cycle penalty the branchy shuffled loop would take 1 175 cycles and '
          + 'the branchless one 672.'
      },
      {
        term: 'Sorting the data is usually the better fix when it is available',
        plain: 'It makes the branch predictable rather than removing it.',
        formal: 'the loop keeps its early exit and its shorter instruction count',
        detail: 'Sorting costs its own time, which has to be amortised over enough passes, and '
          + 'it stops being available the moment the data cannot be reordered — which is most '
          + 'of the time. But when it is available it is strictly better than going branchless, '
          + 'because it removes the mispredicts without adding any instructions.',
        example: 'Sorted and branchy is 503 cycles; branchless is 654 whatever the order.'
      },
      {
        term: 'Unrolling helps, and not with the branch that is costing you',
        plain: 'It removes loop-control branches, which were predictable anyway.',
        formal: 'fewer instructions and more scheduling freedom, and the same mispredicts',
        detail: 'The loop-control branch is taken every iteration but one, so any predictor '
          + 'gets it right; removing it saves instructions rather than mispredicts. Unrolling '
          + 'is still usually a small win for exactly those other reasons, and expecting it to '
          + 'fix a data-dependent branch is a misdiagnosis.',
        example: 'The filter loop\'s control branch is predicted correctly on all but the last '
          + 'iteration, in every configuration.'
      },
      {
        term: 'An indirect call in a hot loop is the expensive shape',
        plain: 'A direction is one bit; a target is a full address.',
        formal: 'a virtual call through a varying pointer is close to unpredictable',
        detail: 'Direction prediction reaches 98% on ordinary code and indirect target '
          + 'prediction does not come close, so a polymorphic call in an inner loop is a much '
          + 'larger cost than a data-dependent branch. That is why devirtualisation is worth so '
          + 'much to a compiler, why profile-guided optimisation targets it specifically, and '
          + 'why hot loops in performance-critical code avoid it.',
        example: 'The return-address stack is the one indirect case with a clean answer, and it '
          + 'works only because calls and returns nest.'
      },
      {
        term: 'The measurement is cheap and almost nobody takes it',
        plain: 'Every processor counts mispredicted branches, per address.',
        formal: 'read the counter before rewriting the branch',
        detail: 'The question "is this branch actually mispredicted" has a direct answer that '
          + 'any profiler will read out of a hardware counter, and it settles the whole '
          + 'decision. Guessing instead is what produces branchless rewrites of branches that '
          + 'were never mispredicted — slower code, harder to read, shipped because the test '
          + 'data happened to be sorted.',
        example: 'The demo reports mispredicts alongside cycles for exactly this reason: the '
          + 'timing alone admits a dozen explanations and the counter admits one.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
