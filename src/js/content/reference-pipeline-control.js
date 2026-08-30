/** Reference entries for control hazards and branch prediction (M35.4-M35.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'control-hazards': {
      summary: 'The branch resolution point as a control, with the flush count and the stall '
        + 'count both measured: resolving in decode halves the flushes on every program and '
        + 'makes two of the four slower overall, because a branch whose operand is still being '
        + 'computed cannot be resolved early at all.',
      intuition: 'Fetch guesses because waiting costs the penalty every time instead of only on '
        + 'a mistake.',
      formulation: {
        equations: [
          {
            label: 'Resolving in execute against resolving in decode, no predictor',
            expr: 'program . EX cycles / flushes . ID cycles / flushes',
            terms: [
              { sym: 'sum', meaning: '70 / 22 . 69 / 11 — 1 cycle saved' },
              { sym: 'arrayMax', meaning: '72 / 20 . 70 / 12 — 2 cycles saved' },
              { sym: 'strlen', meaning: '54 / 12 . 56 / 8 — 2 cycles LOST' },
              { sym: 'factorial', meaning: '197 / 68 . 205 / 34 — 8 cycles lost, 19 extra stalls' }
            ]
          },
          {
            label: 'What the penalty costs per instruction',
            expr: 'branch rate x mispredict rate x penalty',
            terms: [
              { sym: '5 stages, penalty 1', meaning: '0.2 x 0.05 x 1 = 0.010 cycles' },
              { sym: '8 stages, penalty 2', meaning: '0.020' },
              { sym: '12 stages, penalty 4', meaning: '0.040' },
              { sym: '20 stages, penalty 7', meaning: '0.070 — 7% of a machine whose ideal is 1.000' }
            ]
          },
          {
            label: 'The strategies, and who used each',
            expr: 'strategy . what it assumes . who',
            terms: [
              { sym: 'stall until resolved', meaning: 'nothing . nobody, once anything better existed' },
              { sym: 'predict not taken', meaning: 'the next address in order . the simplest machines; it is free' },
              { sym: 'predict backward taken', meaning: 'a backward branch is a loop . early MIPS and SPARC' },
              { sym: 'delayed branch', meaning: 'the compiler fills the slot . MIPS and SPARC, and both regretted it' },
              { sym: 'dynamic prediction', meaning: 'it will do what it did last time . everything since' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A squashed instruction leaves nothing behind',
          why: 'It is what makes guessing safe rather than merely fast.',
          breaks: 'Nothing before write-back commits any architectural state.'
        },
        {
          name: 'Early resolution is charged for its stalls as well as credited for its flushes',
          why: 'Reporting only the flush saving would make it look free.',
          breaks: 'The factorial pays 19 extra stalls and ends up 8 cycles slower.'
        },
        {
          name: 'The penalty is the stage distance and nothing else',
          why: 'It is why deeper pipelines made every mistake more expensive.',
          breaks: 'Two cycles resolving in execute, one resolving in decode, exactly.'
        }
      ],
      complexity: [
        { operation: 'a redirect, resolving in execute', average: '2 cycles', worst: 'the same, every time' },
        { operation: 'a redirect, resolving in decode', average: '1 cycle', worst: 'plus a stall when the operand is not ready' },
        { operation: 'an unconditional jump, no target buffer', average: 'a full redirect every execution', worst: 'once per loop iteration' },
        { operation: 'a correctly predicted branch', average: 'free', worst: 'free — that is the point of predicting' },
        { operation: 'the penalty at depth k', average: 'roughly 0.4k stages', worst: '15 to 20 cycles on a deep out-of-order core' }
      ],
      failureModes: [
        {
          symptom: 'A third of the cycles disappear into nothing on a loop-heavy program.',
          cause: 'No prediction, so every taken branch and jump costs a full redirect.',
          fix: 'A target buffer alone removes most of it; the sum loop goes from 11 redirects to 2.'
        },
        {
          symptom: 'Moving branch resolution earlier makes the machine slower.',
          cause: 'The branches depend on the instruction immediately before them.',
          fix: 'Measure both. Which side of the trade a program lands on is a property of the code.'
        },
        {
          symptom: 'A delay slot that a later pipeline cannot use.',
          cause: 'The slot is architectural, so every implementation must honour it.',
          fix: 'Nothing, once shipped. It is why RISC-V has none.'
        },
        {
          symptom: 'A branch predictor improvement that buys almost nothing.',
          cause: 'The penalty was already small, so the miss rate was not the binding cost.',
          fix: 'Multiply before investing; halving the penalty may be cheaper than improving the guess.'
        },
        {
          symptom: 'A speculatively executed instruction leaves an observable trace.',
          cause: 'Something before the commit point changed state.',
          fix: 'It must not — and when it does through a cache, that is Spectre.'
        }
      ],
      inTheWild: [
        'Every pipelined processor, and the branch target buffer that arrived with the first ones.',
        'MIPS and SPARC delay slots, and the decades of compatibility they bought.',
        'Spectre, which is speculation leaving a trace in a structure nobody was squashing.',
        'Speculative execution in databases and workflow engines, on the same arithmetic.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, chapter 4', note: 'control hazards and the resolution point' },
        { title: 'Hennessy and Patterson — A Quantitative Approach, chapter 3', note: 'branch costs at depth, quantitatively' },
        { title: 'Kocher et al. — Spectre Attacks (2019)', note: 'what happens when a squash is not quite total' },
        { title: 'McFarling and Hennessy — Reducing the cost of branches (ISCA 1986)', note: 'the static schemes measured against each other' }
      ]
    },

    'branch-prediction-basics': {
      summary: 'Four predictors on four patterns built to separate them, with accuracy reported '
        + 'per branch site rather than only in total, the counter states shown raw, and a '
        + 'return-address stack whose advantage over a target buffer is structural rather than '
        + 'statistical.',
      intuition: 'A predictor has only the address, so everything it does is inference from '
        + 'what happened there before.',
      formulation: {
        equations: [
          {
            label: 'Four predictors, four patterns',
            expr: 'pattern . never taken . backward taken . one bit . two bit',
            terms: [
              { sym: 'loop', meaning: '10.0% . 90.0% . 80.0% . 88.0%' },
              { sym: 'nested loop', meaning: '17.5% . 82.5% . 65.0% . 80.8%' },
              { sym: 'alternating', meaning: '50.0% . 50.0% . 0.0% . 0.0%' },
              { sym: 'coin flips', meaning: '47.5% . 47.5% . 49.8% . 50.2%' }
            ]
          },
          {
            label: 'The nested fixture, per site',
            expr: 'site . executions . accuracy with a two-bit counter',
            terms: [
              { sym: 'inner loop branch', meaning: '100 . 79.0%' },
              { sym: 'outer loop branch', meaning: '20 . 90.0%' },
              { sym: 'the overall figure', meaning: '80.8%, which is neither of them' }
            ]
          },
          {
            label: 'The two-bit saturating counter',
            expr: 'strongly not taken . weakly not taken . weakly taken . strongly taken',
            terms: [
              { sym: 'a taken outcome', meaning: 'moves one state right, saturating at strongly taken' },
              { sym: 'a not-taken outcome', meaning: 'moves one state left' },
              { sym: 'the value of the middle', meaning: 'two mistakes to change the prediction, so a loop exit costs one miss instead of two' }
            ]
          },
          {
            label: 'Returns: a target buffer against a return-address stack',
            expr: 'case . target buffer . return stack',
            terms: [
              { sym: 'called from one place', meaning: 'right . right' },
              { sym: 'called from twenty places', meaning: 'wrong on 19 of 20 . right' },
              { sym: 'recursion within the stack depth', meaning: 'wrong on almost every return . right' },
              { sym: 'recursion deeper than the stack', meaning: 'wrong . right except the outermost frames' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The floor is measured, not assumed',
          why: 'A tournament without a random fixture cannot say what "good" means.',
          breaks: 'All four predictors land between 47.5% and 50.2% on coin flips.'
        },
        {
          name: 'Accuracy is reported per site, sorted by misses',
          why: 'The average is dominated by whichever branch runs most, which is usually the easy one.',
          breaks: 'The nested fixture is 80.8% overall and 79.0% on the branch that runs 100 times.'
        },
        {
          name: 'The static baseline is shown beside the dynamic predictors',
          why: 'A table has to beat one comparison and no state by enough to justify itself.',
          breaks: 'Backward-taken beats the one-bit table on both loop fixtures.'
        }
      ],
      complexity: [
        { operation: 'static prediction', average: 'one comparison, no state', worst: 'wrong on every forward taken branch' },
        { operation: 'one-bit predictor', average: '1 bit per entry', worst: '2 mispredicts per loop entry' },
        { operation: 'two-bit predictor', average: '2 bits per entry', worst: '1 mispredict per loop entry' },
        { operation: 'branch target buffer', average: 'a tag and an address per entry', worst: 'a miss costs what a wrong direction costs' },
        { operation: 'return-address stack', average: '8 to 16 entries, and returns are nearly free', worst: 'recursion deeper than that mispredicts silently' }
      ],
      failureModes: [
        {
          symptom: 'A loop-heavy program mispredicts twice per loop entry.',
          cause: 'A one-bit predictor loses its state on the exit and relearns on the next entry.',
          fix: 'A second bit. It halves the mispredicts on the nested fixture, 42 to 23.'
        },
        {
          symptom: 'A predictor at 95% overall and a program that is still branch-bound.',
          cause: 'One hot site is at 50% and the average is carried by cold easy ones.',
          fix: 'Read mispredicts per branch address; every profiler will report them.'
        },
        {
          symptom: 'Deeply recursive code that gets slower past a certain depth, for no visible reason.',
          cause: 'The return-address stack overflowed and the outermost returns mispredict.',
          fix: 'Bound the recursion, or convert to iteration. Nothing reports this directly.'
        },
        {
          symptom: 'A predictor that looks excellent on a microbenchmark and mediocre in production.',
          cause: 'Aliasing: the real working set of branch sites is far larger than the fixture.',
          fix: 'Size the table against the real site count, and report per-site accuracy.'
        },
        {
          symptom: 'A predictor scoring 0%, not 50%.',
          cause: 'The pattern alternates, and "whatever happened last time" is exactly wrong.',
          fix: 'History. No counter width fixes it, which is the next section.'
        }
      ],
      inTheWild: [
        'The two-bit counter, which is inside essentially every predictor shipped since 1990.',
        'Return-address stacks, and the depth limits that make deep recursion expensive.',
        'perf stat branch-misses, which is this measurement on real hardware.',
        'Profile-guided optimisation, which is static prediction informed by a real run.'
      ],
      sources: [
        { title: 'Smith — A study of branch prediction strategies (ISCA 1981)', note: 'the two-bit counter, introduced' },
        { title: 'Yeh and Patt — Two-level adaptive training branch prediction (MICRO 1991)', note: 'where history entered the design' },
        { title: 'Hennessy and Patterson — A Quantitative Approach, chapter 3', note: 'predictor accuracy measured across real workloads' },
        { title: 'Intel and AMD optimisation manuals', note: 'return-stack depths and the recursion cliff they imply' }
      ]
    },

    'advanced-branch-prediction': {
      summary: 'gshare, a tournament predictor and a simplified TAGE against a bimodal '
        + 'baseline, on five patterns including one constructed so that a branch is decided by '
        + 'two earlier ones — where the overall accuracy differs by 6.4 points and the effect '
        + 'being demonstrated is 15.5.',
      intuition: 'Mixing recent outcomes into the index gives one branch site several counters, '
        + 'one per situation it can be in.',
      formulation: {
        equations: [
          {
            label: 'Every predictor on every pattern',
            expr: 'pattern . bimodal . gshare . tournament . TAGE-lite',
            terms: [
              { sym: 'correlated', meaning: '57.3% . 63.7% . 63.0% . 63.3%' },
              { sym: 'alternating', meaning: '0.0% . 97.0% . 96.5% . 98.5%' },
              { sym: 'nested loop', meaning: '80.8% . 87.5% . 94.2% . 95.8%' },
              { sym: 'single loop', meaning: '88.0% . 64.0% . 92.0% . 80.0%' },
              { sym: 'coin flips', meaning: '50.2% . 49.0% . 47.0% . 54.5%' }
            ]
          },
          {
            label: 'The correlated fixture, per site',
            expr: 'the third branch is taken exactly when the first two were',
            terms: [
              { sym: 'site 0x300 and 0x304', meaning: 'coin flips: everybody near 50%' },
              { sym: 'site 0x308, bimodal', meaning: '73.3% — it settles on "not taken", which is right 3 times in 4' },
              { sym: 'site 0x308, gshare', meaning: '88.8%' },
              { sym: 'the achievable ceiling overall', meaning: '(50 + 50 + 100) / 3 = 66.7%' }
            ]
          },
          {
            label: 'What each design adds',
            expr: 'design . the idea . what it costs',
            terms: [
              { sym: 'gshare', meaning: 'address XOR global history . more aliasing per site' },
              { sym: 'tournament', meaning: 'two predictors and a chooser . both tables plus a third' },
              { sym: 'TAGE', meaning: 'tagged tables at geometric history lengths . tags and an allocation policy' },
              { sym: 'perceptron', meaning: 'a linear function of the history . a multiply-accumulate on the fetch path' }
            ]
          },
          {
            label: 'What 98% accuracy costs',
            expr: 'a branch every 5 instructions, a 20-cycle penalty',
            terms: [
              { sym: '2% wrong', meaning: '4 mispredicts per 1 000 instructions' },
              { sym: 'at 20 cycles each', meaning: '80 lost cycles per 1 000' },
              { sym: 'as a share', meaning: 'around 7% of a machine whose ideal is one instruction per cycle' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every predictor gets the same table size',
          why: 'Otherwise the comparison is about area rather than about indexing.',
          breaks: 'The index width is a control, and shrinking it degrades gshare fastest.'
        },
        {
          name: 'The per-site figures are shown, because the overall one hides the effect',
          why: 'Two thirds of the correlated fixture is unpredictable by construction.',
          breaks: '6.4 points overall against 15.5 on the site that carries the correlation.'
        },
        {
          name: 'The regression is reported as well as the improvement',
          why: 'gshare is worse than bimodal on a plain loop, by 24 points.',
          breaks: 'History spreads a well-behaved site across counters that each see less training.'
        }
      ],
      complexity: [
        { operation: 'bimodal', average: '2 bits per entry, one entry per site', worst: 'blind to anything but this site\'s own history' },
        { operation: 'gshare', average: 'the same table, indexed differently', worst: 'one site occupies 2^h entries, so aliasing rises' },
        { operation: 'tournament', average: 'three tables', worst: 'still one prediction per cycle, which is the real constraint' },
        { operation: 'TAGE', average: 'several tagged tables plus a base', worst: 'the allocation policy is most of the design' },
        { operation: 'indirect target prediction', average: 'much less accurate than direction prediction', worst: 'a polymorphic call in a hot loop' }
      ],
      failureModes: [
        {
          symptom: 'A predictor with history is worse than one without.',
          cause: 'The table is too small, so each site spread over several entries collides.',
          fix: 'Size the table for the working set, or use a tournament with a per-site chooser.'
        },
        {
          symptom: 'A branch that is perfectly determined and predicted at 73%.',
          cause: 'Its outcome depends on earlier branches, and the predictor is indexed only by address.',
          fix: 'Global history in the index; that is the whole of gshare.'
        },
        {
          symptom: 'A predictor comparison where everything scores about the same.',
          cause: 'The fixture is mostly unpredictable, so every predictor sits at the ceiling.',
          fix: 'Report per site, and state the achievable maximum.'
        },
        {
          symptom: 'A hot loop with a virtual call that no predictor helps with.',
          cause: 'It is an indirect target, not a direction.',
          fix: 'Devirtualise, or hoist the call out; this is what profile-guided optimisation targets.'
        },
        {
          symptom: '"Our predictor is 98% accurate" ending an argument.',
          cause: 'The rate was quoted without the penalty it multiplies.',
          fix: 'Report mispredicts per thousand instructions and the share of runtime.'
        }
      ],
      inTheWild: [
        'gshare, in essentially every processor of the late 1990s.',
        'TAGE and its descendants, which have won every prediction championship since 2006.',
        'Perceptron predictors, shipped by AMD and described publicly.',
        'Indirect target prediction, and the devirtualisation passes that exist because of it.'
      ],
      sources: [
        { title: 'McFarling — Combining branch predictors (DEC WRL, 1993)', note: 'gshare and the tournament predictor, in one paper' },
        { title: 'Seznec and Michaud — A case for (partially) tagged geometric history length prediction (2006)', note: 'TAGE' },
        { title: 'Jimenez and Lin — Dynamic branch prediction with perceptrons (HPCA 2001)', note: 'the other family, and why long histories became usable' },
        { title: 'The Championship Branch Prediction workshops', note: 'the shared traces that make these comparisons honest' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
