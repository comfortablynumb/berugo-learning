/** Concepts for control hazards and branch prediction (M35.4-M35.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'control-hazards': [
      {
        term: 'A control hazard is not knowing what to fetch next',
        diagram: {
          definition: [
            'flowchart TB',
            '    B["a branch is fetched"] --> G["fetch keeps going on a guess"]',
            '    G --> R{"the branch resolves"}',
            '    R -->|"the guess was right"| N["nothing happens"]',
            '    R -->|"the guess was wrong"| S["squash everything fetched since<br/>and redirect"]',
            '    S --> C["2 cycles gone, resolving in execute"]'
          ].join('\n'),
          caption: 'Waiting would cost the same cycles every time instead of only on a '
            + 'mistake, so fetch guesses and the wrong guesses are discarded.'
        },
        plain: 'The branch is in flight and its direction is not known yet.',
        formal: 'the penalty is the number of stages between fetch and resolution',
        detail: [
          'Fetch cannot simply wait, because waiting costs the penalty on every branch rather '
            + 'than only on the mispredicted ones.',
          'So it guesses, and the machine keeps a way to undo.',
          'That is speculation in its simplest form.',
          'The whole of branch prediction is an effort to make the guess better rather than to '
            + 'avoid guessing.'
        ],
        example: 'On the sum loop with no prediction at all, 22 of 70 cycles — 31% — are '
          + 'instructions fetched down a path that turned out to be wrong.'
      },
      {
        term: 'Squashing has to be total, and that is what makes guessing safe',
        plain: 'A flushed instruction leaves no register written and no memory changed.',
        formal: 'nothing before write-back commits any architectural state',
        detail: [
          'The property that makes speculation possible is not the prediction. It is the ability '
            + 'to undo.',
          'In this machine that is easy, because only write-back commits anything and every '
            + 'instruction younger than the branch is still short of it.',
          'The same property is what precise exceptions need in 35.7.',
          'That is why branch recovery and exception recovery are the same machinery, and why a '
            + 'machine that has one gets the other nearly free.'
        ],
        example: 'In the stage diagram the squashed rows simply stop; there is no undo step to '
          + 'perform because nothing had been done.'
      },
      {
        term: 'Resolving earlier halves the penalty and is not free',
        plain: 'A comparator in decode, and a stall when the operand is not ready.',
        formal: 'decode resolution costs one flushed instruction instead of two',
        detail: [
          'The branch\'s operands have to be compared wherever it resolves, so early resolution '
            + 'needs a comparator in decode and its own forwarding paths.',
          'It also needs a stall whenever an operand is still being computed by the instruction '
            + 'directly ahead.',
          'At that moment the value does not exist anywhere to forward from.',
          'Whether the trade pays depends on how often a branch reads a register written just '
            + 'before it, which is a property of the code.'
        ],
        example: 'On the sum loop, decode resolution takes 69 cycles against 70; on the '
          + 'factorial it takes 205 against 197, because the branches there depend on the '
          + 'instruction immediately before them.'
      },
      {
        term: 'Static prediction is nearly free and is the baseline to beat',
        plain: '"Backward branches are taken" is one comparison.',
        formal: 'a backward branch is a loop, and a loop usually loops',
        detail: [
          'It costs a sign test on the immediate and no state at all, and on loop-shaped code it '
            + 'captures most of the available benefit.',
          'Every dynamic predictor has to beat it by enough to justify a table and the area for '
            + 'it.',
          'That is a much higher bar than beating "always not taken".',
          'Quoting a dynamic predictor\'s accuracy without the static baseline beside it is how a '
            + 'table gets justified for nothing.'
        ],
        example: 'On the loop fixture: never-taken 10.0%, backward-taken 90.0%, and a two-bit '
          + 'counter 88.0% — the static scheme wins.'
      },
      {
        term: 'A direction is useless without a target',
        plain: 'Knowing a branch is taken does not tell fetch where to go.',
        formal: 'the target is in the instruction, which has not been decoded yet',
        detail: [
          'A branch target buffer remembers where this address went when it was last taken, so a '
            + '"taken" prediction has somewhere to send the fetch.',
          'It is a cache, it can miss, and a miss costs exactly what a wrong direction costs.',
          'It also handles unconditional jumps, which have no direction to predict and still '
            + 'redirect fetch.',
          'On this machine a jump with no target buffer costs a full redirect every time it '
            + 'executes.'
        ],
        example: 'With no predictor at all the sum loop pays 11 redirects; with a predictor and '
          + 'a target buffer it pays 2.'
      },
      {
        term: 'Delayed branches encoded a pipeline depth into an instruction set',
        plain: 'The instruction after a branch executes regardless.',
        formal: 'the delay slot is architectural, so every implementation must honour it',
        detail: [
          'It works perfectly at the depth it was designed for and becomes a liability at every '
            + 'other.',
          'The number of slots is fixed in the contract, while the pipeline that motivated it '
            + 'changes every generation.',
          'MIPS and SPARC both did it and both regretted it.',
          'It is the M34 lesson about instruction sets — a decision in the contract is permanent '
            + '— meeting the M35 lesson about depth.'
        ],
        example: 'RISC-V has no delay slot, deliberately, and this machine pays two flushed '
          + 'instructions instead.'
      },
      {
        term: 'The penalty is the multiplier on every prediction miss',
        plain: 'Accuracy only matters multiplied by what a mistake costs.',
        formal: 'cost per instruction = branch rate x mispredict rate x penalty',
        detail: [
          'A two-cycle penalty makes a mediocre predictor tolerable.',
          'A twenty-cycle penalty makes an excellent one expensive.',
          'That multiplication is why prediction accuracy became worth an enormous amount of '
            + 'silicon exactly when pipelines got deep.',
          'The same design change that shortened the clock made every mistake more expensive in '
            + 'proportion.'
        ],
        example: 'At a branch every five instructions and a 5% miss rate, the cost per '
          + 'instruction grows from 0.010 cycles at five stages to 0.070 at twenty.'
      },
      {
        term: 'Speculation is worth exactly the hit rate times the cost of a miss',
        plain: 'And the cost of a miss is usually decided somewhere else.',
        formal: 'a better recovery path can be worth more than a better predictor',
        detail: [
          'Prefetching a page, warming a cache, optimistically locking a row, speculatively '
            + 'running a branch of a workflow: all of them are this bet.',
          'In every case the interesting number is not the hit rate, but the hit rate multiplied '
            + 'by what a miss costs.',
          'A system that made the miss cheaper to recover from is often a better investment than '
            + 'one that made the guess slightly more accurate.',
          'That comparison is almost never made.'
        ],
        example: 'Moving branch resolution from execute to decode halves the miss cost without '
          + 'improving the prediction at all.'
      }
    ],

    'branch-prediction-basics': [
      {
        term: 'A predictor has only the address to work with',
        diagram: {
          definition: [
            'stateDiagram-v2',
            '    stronglyNotTaken --> weaklyNotTaken: taken',
            '    weaklyNotTaken --> stronglyNotTaken: not taken',
            '    weaklyNotTaken --> weaklyTaken: taken',
            '    weaklyTaken --> weaklyNotTaken: not taken',
            '    weaklyTaken --> stronglyTaken: taken',
            '    stronglyTaken --> weaklyTaken: not taken'
          ].join('\n'),
          caption: 'Two bits, four states, one rule. The middle transition is the whole value: '
            + 'from strongly taken it takes two mistakes to start predicting not-taken.'
        },
        plain: 'No operands, no decoded instruction, nothing about this execution.',
        formal: 'predict from the program counter alone, before decode',
        detail: [
          'At the moment fetch needs an answer, the instruction has not been decoded, the '
            + 'registers have not been read, and nothing about the current values is known.',
          'Everything a predictor does is inference from what happened at this address before.',
          'That is why the whole field is about what to remember and how to index it.',
          'It is not about how to compute the branch condition sooner.'
        ],
        example: 'A branch target buffer and a direction predictor are both indexed by the '
          + 'address, because it is the only input available.'
      },
      {
        term: 'A one-bit predictor misses twice per loop, not once',
        plain: 'It gets the exit wrong, then gets the next entry wrong too.',
        formal: 'a loop of n iterations entered m times costs 2m mispredicts',
        detail: [
          'On the exit it predicts taken and the branch falls through.',
          'It then remembers "not taken" and predicts that on the first iteration of the next '
            + 'entry, which is taken.',
          'Both are wrong, and the second one is the surprise.',
          'Adding a second bit means a single mistake only weakens the prediction rather than '
            + 'reversing it, which removes the second miss. One extra bit, half the mispredicts '
            + 'on loop code.'
        ],
        example: 'On the nested-loop fixture: one-bit 65.0%, two-bit 80.8%, over the same 120 '
          + 'branches.'
      },
      {
        term: 'The per-site accuracy matters and the average hides it',
        plain: 'One hot branch at 50% inside a program at 95% overall.',
        formal: 'sort by mispredicts, not by address',
        detail: [
          'A predictor\'s overall accuracy is dominated by whichever branches execute most, and '
            + 'the ones that execute most are usually the easy ones.',
          'So a hot, unpredictable branch can be invisible in the total while costing most of the '
            + 'lost cycles.',
          'Every real profiler reports mispredicts per branch address for exactly this reason.',
          'The table in the demo is sorted by misses rather than by address, so the expensive site '
            + 'is at the top.'
        ],
        example: 'On the nested fixture the overall figure is 80.8% and the inner loop branch '
          + 'is at 79.0% over 100 executions, while the outer one is at 90.0% over 20.'
      },
      {
        term: 'A history table aliases, and the aliasing is invisible in the total',
        plain: 'Two branch sites whose indices collide share a counter.',
        formal: 'the index is a few bits of the address, so different addresses can map together',
        detail: [
          'Interference between unrelated branches degrades both.',
          'It shows up only as a slightly worse overall number that could be explained by a dozen '
            + 'other things.',
          'More index bits cost area and fewer cost accuracy, and the working set of active branch '
            + 'sites in a real program is far larger than any fixture suggests.',
          'That is why a predictor that looks excellent on a microbenchmark can disappoint on real '
            + 'code.'
        ],
        example: 'The demo\'s tables are 1 024 entries, which is roomy for a fixture with two '
          + 'branch sites and small for a program with thousands.'
      },
      {
        term: 'A return-address stack is a different mechanism, not a better table',
        plain: 'A call pushes; a return pops.',
        formal: 'a return is predicted from where its call was, not from where this site last went',
        detail: [
          'A target buffer predicts a return by remembering where that return instruction went '
            + 'last time.',
          'That is wrong every time the function is called from somewhere new, and a function '
            + 'worth having is called from many places.',
          'A stack is right essentially always, because calls and returns nest.',
          'That is not a better statistical model of the same data. It is a mechanism that knows '
            + 'something about the structure of the program.'
        ],
        example: 'A function called from twenty places: a target buffer is wrong on nineteen '
          + 'returns in twenty, and a return-address stack is right on all of them.'
      },
      {
        term: 'The stack has a fixed depth, and beyond it recursion gets quietly slower',
        plain: 'The oldest entries are pushed out and never come back.',
        formal: 'a stack of depth d predicts the innermost d returns and mispredicts the rest',
        detail: [
          'Recursion deeper than the hardware stack loses the outermost frames, so those returns '
            + 'mispredict on the way back out.',
          'It is a genuine performance cliff, and it depends on a hardware parameter nobody '
            + 'documents prominently.',
          'It appears in a profiler as nothing more informative than "this got slower".',
          'It is one of the real reasons deep recursion is discouraged in performance-critical '
            + 'code.'
        ],
        example: 'Eight or sixteen entries is typical, so a recursion thirty deep mispredicts '
          + 'roughly half its returns.'
      },
      {
        term: 'The floor is chance, and a comparison without it proves nothing',
        plain: 'Nothing predicts a coin flip better than 50%.',
        formal: 'the random fixture exists so no predictor can be called good without a reference',
        detail: [
          'Every predictor scores well on a long loop and badly on random outcomes.',
          'So a tournament run only on friendly patterns measures nothing.',
          'Including the floor is what makes the other numbers mean something.',
          'It is the same discipline as including a brute-force oracle in an algorithm '
            + 'comparison.'
        ],
        example: 'On coin flips all four predictors land between 47.5% and 50.2%, which is '
          + 'chance and nothing else.'
      },
      {
        term: 'Counter values are worth showing raw',
        plain: 'A loop branch sits at 3; an unpredictable one oscillates around 1 and 2.',
        formal: 'four states, named rather than numbered',
        detail: [
          'A two-bit saturating counter is small enough to display completely.',
          'Watching where the counters settle explains the accuracy figure above them better than '
            + 'any description of the state machine.',
          'It also makes the aliasing visible.',
          'Two sites sharing a counter show up as a counter that never settles, which is a '
            + 'different failure from a genuinely unpredictable branch.'
        ],
        example: 'After the nested fixture, the two live counters both sit at 2 — weakly taken '
          + '— because the inner loop exits often enough to keep pulling them down.'
      }
    ],

    'advanced-branch-prediction': [
      {
        term: 'Branches correlate, and a per-site predictor cannot see it',
        diagram: {
          definition: [
            'flowchart LR',
            '    PC["branch address"] --> X{"exclusive or"}',
            '    GH["global history:<br/>a shift register of recent outcomes"] --> X',
            '    X --> T["counter table"]',
            '    T --> P["prediction"]',
            '    P -.->|"outcome"| GH'
          ].join('\n'),
          caption: 'One site now occupies several counters, one per history pattern — so a '
            + 'branch that behaves differently depending on what came before gets a separate '
            + 'answer for each case.'
        },
        plain: 'A branch whose outcome is decided by what two earlier branches did.',
        formal: 'its own history is a coin flip; its behaviour is perfectly determined',
        detail: [
          'A counter indexed only by address sees a 50/50 branch and settles on whichever outcome '
            + 'is more common, which caps it well below what is achievable.',
          'The information it needs exists, in the outcomes of the earlier branches.',
          'It simply never reaches the predictor.',
          'That is the gap gshare closes, and it is why the fixture that demonstrates it has to be '
            + 'constructed rather than found.'
        ],
        example: 'On the correlated site: a per-site counter reaches 73.3% and a history-indexed '
          + 'one reaches 88.8%.'
      },
      {
        term: 'gshare is one exclusive-or, and that is the whole idea',
        plain: 'Index the table with the address combined with recent outcomes.',
        formal: 'slot = address bits XOR global history bits',
        detail: [
          'Mixing the history into the index gives each branch site several counters, one per '
            + 'history pattern, so each case can be learned separately.',
          'It is a remarkably small change to a bimodal predictor.',
          'It is also the one that made correlation predictable.',
          'The cost is that a single site now occupies several entries, which crowds the table and '
            + 'makes aliasing worse.'
        ],
        example: 'On the alternating fixture, where a per-site counter is at 0.0%, gshare '
          + 'reaches 97.0%.'
      },
      {
        term: 'History helps some branches and hurts others',
        plain: 'gshare can be worse than bimodal on a well-behaved loop.',
        formal: 'spreading one site over many counters costs it whenever it did not need to be spread',
        detail: [
          'A loop branch with a stable pattern was already predicted perfectly by one counter.',
          'Giving it eight, one per history pattern, means each of them sees a fraction of the '
            + 'training and none of them settles as firmly.',
          'That is a real regression and it appears in the demo.',
          'It is the reason nobody ships gshare alone.'
        ],
        example: 'On the plain loop fixture: bimodal 88.0%, gshare 64.0%.'
      },
      {
        term: 'A tournament predictor runs two and learns which to believe',
        plain: 'A chooser counter per site, updated only when they disagree.',
        formal: 'more area than either, and fewer surprises than both',
        detail: [
          'Real programs contain both kinds of branch: some that need history and some that are '
            + 'hurt by it.',
          'So neither predictor wins everywhere, and a design that picks per site wins overall.',
          'Updating the chooser only when the two disagree is the detail that makes it work.',
          'Agreement carries no information about which one to trust.'
        ],
        example: 'On the loop fixture, where gshare regressed to 64.0%, the tournament reaches '
          + '92.0% — better than either component alone.'
      },
      {
        term: 'TAGE gives each branch the history length it actually needs',
        plain: 'Tagged tables at geometric history lengths; the longest match answers.',
        formal: 'a branch needing two bits and one needing fifty are both served well',
        detail: [
          'The insight is that "how much history does this branch need" is itself a per-branch '
            + 'question.',
          'A single history length is a compromise that suits neither extreme.',
          'Tagging lets a table say "this entry really is for this branch and this history" rather '
            + 'than guessing.',
          'Allocating a longer table on a mispredict lets a branch migrate to the length it needs. '
            + 'TAGE has won every prediction championship for nearly twenty years.'
        ],
        example: 'On the alternating and nested fixtures TAGE is the best of the four, at 98.5% '
          + 'and 95.8%.'
      },
      {
        term: 'A table too small makes history a regression rather than an improvement',
        plain: 'Aliasing gets worse before it gets better.',
        formal: 'each site occupies several entries, so a small table collides more than bimodal would',
        detail: [
          'This is the trade nobody mentions when describing gshare as an improvement.',
          'It is an improvement given enough entries, and a regression without them.',
          'The demo exposes the index width as a control precisely so the crossover is visible.',
          '"This technique is better" is not a statement that survives without its resource budget '
            + 'attached.'
        ],
        example: 'With four index bits — sixteen counters for every site and every history — '
          + 'gshare collapses on every fixture.'
      },
      {
        term: 'Indirect branches are a harder and largely unsolved problem',
        plain: 'A direction is one bit; a target is a full address.',
        formal: 'a virtual call through a varying pointer has no small answer to remember',
        detail: [
          'Predicting which of many targets an indirect jump will take needs a target predictor '
            + 'with its own history.',
          'It is much less accurate than direction prediction.',
          'That is why devirtualisation is worth so much to a compiler, and why hot loops in '
            + 'performance-critical code avoid polymorphism.',
          'It is also why a jump table can be slower than a chain of well-predicted comparisons.'
        ],
        example: 'The return-address stack is the one indirect case with a clean answer, and it '
          + 'works only because calls and returns nest.'
      },
      {
        term: '98% is not a finished sentence',
        plain: 'Multiply the miss rate by the penalty before calling a predictor good.',
        formal: 'at a branch every 5 instructions, 2% wrong is 4 mispredicts per 1 000',
        detail: [
          'Four mispredicts per thousand instructions at a twenty-cycle penalty is eighty lost '
            + 'cycles per thousand.',
          'That is around 7% of a machine that would otherwise retire one instruction per cycle.',
          'It comes from a predictor everybody would call excellent.',
          'Going from 98% to 99% halves that, which is why two decades of research went into the '
            + 'last percentage point of something that already looked solved.'
        ],
        example: 'The demo reports mispredicts per thousand instructions and the share of '
          + 'runtime beside the accuracy, because the accuracy alone settles nothing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
