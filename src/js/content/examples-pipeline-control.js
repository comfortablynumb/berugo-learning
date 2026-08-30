/** Worked examples for control hazards and branch prediction (M35.4-M35.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'control-hazards': [
      {
        title: 'Moving the resolution point, and the two programs it makes worse',
        goal: 'Halve the branch penalty and find out what the other half costs.',
        setup: 'Four programs on the pipeline with no branch predictor, so every taken transfer '
          + 'is a redirect. Resolving in execute throws away two instructions; resolving in '
          + 'decode throws away one and needs a comparator there, plus a stall whenever an '
          + 'operand is still being computed by the instruction directly ahead.',
        steps: [
          { do: 'Run the sum loop with resolution in execute.',
            why: 'The baseline: 11 redirects at 2 cycles each.',
            work: '70 cycles, 22 of them flushes — 31% of the run' },
          { do: 'Move resolution to decode.',
            why: 'One instruction thrown away instead of two.',
            work: '69 cycles, 11 flushes, and no extra stalls' },
          { do: 'Do the same for the array maximum.',
            why: 'A program whose branches depend on values computed nearby.',
            work: '72 cycles and 20 flushes becomes 70 cycles, 12 flushes and 1 extra stall' },
          { do: 'Do the same for the string length and the factorial.',
            why: 'The cases where the trade goes the other way.',
            work: 'strlen 54 becomes 56; factorial 197 becomes 205, with 19 extra stalls' },
          { do: 'Compare the flush saving with the stall cost.',
            why: 'This is the whole decision.',
            work: 'the factorial saves 34 flush cycles and pays 19 stalls plus extra drains — '
              + 'a net loss of 8 cycles' }
        ],
        answer: 'Early resolution halves the flush count on every program and makes two of the '
          + 'four slower overall. The reason is specific and worth remembering: a branch whose '
          + 'operand is produced by the instruction immediately before it cannot be resolved in '
          + 'decode at all, because at that moment the value does not exist anywhere to forward '
          + 'from — the producer is in execute and has not finished. So the machine stalls, and '
          + 'a program full of compare-then-branch pairs pays more in stalls than it saves in '
          + 'flushes. Which side of that trade a program lands on is a property of the code, '
          + 'not of the machine, which is exactly why real designs resolve early AND predict: '
          + 'the prediction removes most of the redirects, so the remaining penalty matters '
          + 'less than the stalls do.'
      },
      {
        title: 'The penalty is the multiplier, and it grows with the thing that was supposed to help',
        goal: 'Show why deeper pipelines created the demand for better predictors.',
        setup: 'A branch every five instructions and a 5% misprediction rate — ordinary figures '
          + 'for real code. The penalty is the number of instructions thrown away per '
          + 'mistake, which is the distance from fetch to the resolution stage, so it scales '
          + 'with the pipeline depth.',
        steps: [
          { do: 'Compute the cost per instruction at five stages.',
            why: 'Resolution around stage 2 gives a penalty of 1 to 2.',
            work: '0.2 x 0.05 x 1 = 0.010 cycles per instruction' },
          { do: 'Do it at eight stages.',
            why: 'The resolution point moves with the depth.',
            work: 'penalty 2: 0.2 x 0.05 x 2 = 0.020' },
          { do: 'Do it at twelve and twenty stages.',
            why: 'The range real machines actually reached.',
            work: 'penalty 4 and 7: 0.040 and 0.070 cycles per instruction' },
          { do: 'Compare with the ideal.',
            why: 'The scale that makes those numbers mean something.',
            work: 'the ideal is 1.000, so 0.070 is 7% of the machine thrown away' },
          { do: 'Halve the misprediction rate instead.',
            why: 'The other lever, and the one that got the investment.',
            work: 'at 2.5% and twenty stages the cost falls to 0.035 — worth as much as halving '
              + 'the depth' }
        ],
        answer: 'The cost of imperfect prediction grows straight in proportion to the depth, so '
          + 'the same design change that shortened the clock made every mistake more expensive. '
          + 'At five stages a mediocre predictor is a rounding error; at twenty, a 5% miss rate '
          + 'costs 7% of the machine. That multiplication is why branch prediction turned from '
          + 'a footnote into a research field with its own championships, and it is the '
          + 'transferable shape: speculation is worth the hit rate multiplied by the cost of a '
          + 'miss, and the cost of a miss is usually decided by a design choice made somewhere '
          + 'else entirely. Moving resolution from execute to decode halves that cost without '
          + 'improving the prediction at all — which is the comparison almost nobody makes.'
      }
    ],

    'branch-prediction-basics': [
      {
        title: 'One bit against two, on a nested loop',
        goal: 'Watch a one-bit predictor miss twice per loop entry, and count what the second '
          + 'bit is worth.',
        setup: 'A nested loop: an inner branch executed 100 times over 20 outer iterations, and '
          + 'an outer branch executed 20 times. Both are loop-shaped, so a predictor only has '
          + 'to learn "taken, except at the exit" — which is where the two schemes come apart.',
        steps: [
          { do: 'Run the one-bit predictor.',
            why: 'Predict whatever happened last time.',
            work: '65.0% over 120 branches — 42 mispredicts' },
          { do: 'Work out where the misses are.',
            why: 'A loop of 5 entered 20 times has 20 exits, not 20 misses.',
            work: 'the exit is wrong, and so is the first iteration of the next entry: 2 per entry' },
          { do: 'Run the two-bit saturating counter.',
            why: 'One mistake now weakens the prediction rather than reversing it.',
            work: '80.8% — 23 mispredicts, roughly half' },
          { do: 'Read the accuracy per site.',
            why: 'The average is dominated by whichever branch runs most.',
            work: 'the inner branch is at 79.0% over 100 executions; the outer at 90.0% over 20' },
          { do: 'Compare with the static schemes.',
            why: 'The baseline any table has to beat.',
            work: 'never-taken 17.5%, backward-taken 82.5% — better than the one-bit table' }
        ],
        answer: 'One extra bit per branch halves the mispredicts on loop-shaped code, from 42 '
          + 'to 23, and the reason is entirely the transition in the middle of the state '
          + 'machine: from strongly taken it takes two mistakes to start predicting not-taken, '
          + 'so a single loop exit does not throw away what the branch has been doing for the '
          + 'previous ninety-nine iterations. The last step is the uncomfortable one: a static '
          + '"backward branches are taken" rule, which costs one comparison and no state at '
          + 'all, beats the one-bit table on this fixture. A dynamic predictor has to beat the '
          + 'static baseline by enough to justify its area, and that is a much higher bar than '
          + 'beating "always not taken".'
      },
      {
        title: 'What no counter can do, and what a return-address stack can',
        goal: 'Find the patterns that defeat per-site prediction entirely, and the one place a '
          + 'different mechanism wins outright.',
        setup: 'Four patterns: a loop, a nested loop, strictly alternating outcomes, and coin '
          + 'flips. Then the recursive factorial on the pipeline, which is a call-and-return '
          + 'workload rather than a branch-direction one.',
        steps: [
          { do: 'Run every predictor on the alternating pattern.',
            why: 'Taken, not taken, taken, not taken.',
            work: 'one-bit 0.0%, two-bit 0.0% — wrong on every single branch' },
          { do: 'Explain the zero.',
            why: 'It is not bad luck.',
            work: 'with 1 bit of state, "whatever happened last time" is exactly wrong every time' },
          { do: 'Run every predictor on coin flips.',
            why: 'The floor, so the other numbers mean something.',
            work: 'all four land between 47.5% and 50.2%' },
          { do: 'Run the factorial with a return-address stack.',
            why: 'Returns are indirect and a stack predicts them structurally.',
            work: '43 predictions made, 11 mispredicted, over a recursion 5 deep' },
          { do: 'Ask what a target buffer would do for the same returns.',
            why: 'It remembers where this return went last time.',
            work: 'a function called from n places returns to n addresses, so it is wrong on '
              + 'n-1 of every n' }
        ],
        answer: 'A per-site counter of any width scores zero on alternating outcomes, which is '
          + 'not a tuning problem — the information needed is in the history and the predictor '
          + 'never receives it. That is the gap the next section closes. The return-address '
          + 'stack is the other half of the example and it makes a different point: it beats a '
          + 'target buffer on returns not by being a better statistical model but by knowing '
          + 'something about the structure of programs, namely that calls and returns nest. A '
          + 'predictor told the shape of the pattern beats one that has to infer it, by a '
          + 'margin no amount of history will close — and that generalises directly to caching '
          + 'and prefetching in software.'
      }
    ],

    'advanced-branch-prediction': [
      {
        title: 'The correlated fixture, where the overall accuracy hides the whole effect',
        goal: 'Separate gshare from bimodal, and notice that the headline number almost fails '
          + 'to show it.',
        setup: 'Three branch sites. The first two are coin flips by construction; the third is '
          + 'taken exactly when both of the others were. A per-site counter sees the third as a '
          + 'branch taken one time in four; a predictor indexed by global history sees four '
          + 'separate cases, each of them perfectly determined.',
        steps: [
          { do: 'Run bimodal and read the overall accuracy.',
            why: 'The number a benchmark would report.',
            work: '57.3% over 1 200 branches' },
          { do: 'Run gshare and read the same number.',
            why: 'The comparison as usually presented.',
            work: '63.7% — a 6.4-point difference, which looks modest' },
          { do: 'Work out the ceiling.',
            why: 'Two of the three sites are unpredictable by construction.',
            work: '(50 + 50 + 100) / 3 = 66.7%, so gshare is close to the maximum available' },
          { do: 'Read the accuracy on the correlated site alone.',
            why: 'This is where the difference actually is.',
            work: 'bimodal 73.3%, gshare 88.8% — 15.5 points' },
          { do: 'Check the other two sites.',
            why: 'To confirm nothing else moved.',
            work: 'both predictors sit near 50% on both, as they must' }
        ],
        answer: 'The overall figures differ by 6.4 points and the effect being demonstrated is '
          + '15.5. Two thirds of this fixture is noise by design, so it drags every predictor '
          + 'towards the same ceiling and buries the one site that separates them. That is not '
          + 'an artefact of a synthetic fixture — it is what happens in real programs too, '
          + 'where a handful of hot unpredictable branches sit inside a sea of easy ones. The '
          + 'practical consequence is that a predictor comparison reported only as an average '
          + 'is close to useless, and that the first thing to do with any accuracy figure is '
          + 'ask what the achievable maximum was.'
      },
      {
        title: 'No predictor wins every row, and gshare loses to bimodal on a plain loop',
        goal: 'Run the tournament properly and find the regression the usual presentation omits.',
        setup: 'Four predictors — bimodal, gshare, tournament and a simplified TAGE — on five '
          + 'patterns, with the same table size for all of them so the comparison is about the '
          + 'indexing rather than about the area.',
        steps: [
          { do: 'Run everything on the alternating pattern.',
            why: 'The case a per-site counter cannot do at all.',
            work: 'bimodal 0.0%, gshare 97.0%, tournament 96.5%, TAGE 98.5%' },
          { do: 'Run everything on a single loop branch.',
            why: 'The case a per-site counter is already perfect at.',
            work: 'bimodal 88.0%, gshare 64.0% — history made it substantially worse' },
          { do: 'Explain the regression.',
            why: 'It is not noise.',
            work: 'history spreads 1 well-behaved site across up to 1 024 counters, so each sees a '
              + 'fraction of the training' },
          { do: 'Run the tournament on the same loop.',
            why: 'This is what a chooser is for.',
            work: '92.0% — better than either component alone' },
          { do: 'Shrink the table to 16 entries and run gshare again.',
            why: 'Aliasing is the other half of the trade.',
            work: 'accuracy collapses on all 5 fixtures, because each site now occupies several of '
              + 'the 16 counters' }
        ],
        answer: 'gshare is 33 points better than bimodal on one pattern and 24 points worse on '
          + 'another, which is why nobody ships it alone and why the tournament predictor — '
          + 'strictly more area than either — is the design that wins. The last step is the '
          + 'part that gets left out of descriptions: history is an improvement given enough '
          + 'table entries and a regression without them, because spreading each site across '
          + 'several counters is exactly what it does. "This technique is better" is not a '
          + 'statement that survives without its resource budget attached, and that is true '
          + 'well beyond branch prediction.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
