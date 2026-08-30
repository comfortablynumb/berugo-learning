/** Worked examples for precise exceptions, depth and pipeline-friendly code (M35.7-M35.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'precise-exceptions-pipelined': [
      {
        title: 'A fault in the memory stage, with four other instructions in flight',
        goal: 'Follow one fault from detection to commit and prove the state is precise.',
        setup: 'A program that loads a word from an odd address, then sets two registers and '
          + 'spins. A handler is loaded at the trap vector; it reads mcause, branches on its '
          + 'sign bit, advances mepc past the offending instruction and returns with mret. The '
          + 'pipelined machine\'s registers are compared against the M34 behavioural simulator '
          + 'at the same number of retired instructions.',
        steps: [
          { do: 'Find the cycle the fault is detected.',
            why: 'A misaligned data access is known in the memory stage.',
            work: 'cycle 5, with two younger instructions already in decode and fetch' },
          { do: 'Find the cycle the trap commits.',
            why: 'The flag travels to write-back so older instructions can finish.',
            work: 'cycle 6 — one cycle later' },
          { do: 'Read what the hardware saved.',
            why: 'This is what the handler has to work with.',
            work: 'mcause 4, mepc 0x8, mtval 0x10000001 — the address that was wrong' },
          { do: 'Count what was thrown away.',
            why: 'Everything younger must leave no trace.',
            work: '5 instructions fetched after the fault and never committed' },
          { do: 'Compare the registers against the behavioural machine.',
            why: 'This is the definition of precise, and it is checkable.',
            work: '0 differences at the same retire count' }
        ],
        answer: 'Five instructions were inside the machine when the fault was taken and the '
          + 'architectural state is identical to a machine that executes one at a time. The two '
          + 'halves of the mechanism are both visible in the timing: the squash happens at '
          + 'cycle 5, immediately, so a store two stages behind cannot reach memory; the trap '
          + 'commits at cycle 6, at write-back, so the two older instructions still in the '
          + 'pipeline finish first. Doing only the first would throw away completed work and '
          + 'doing only the second would let a younger store escape, and neither failure would '
          + 'produce an error message — it would produce a handler looking at a state that '
          + 'never existed.'
      },
      {
        title: 'The faults that must not commit, and the handler that costs more than it looks',
        goal: 'Find the two costs of exceptions that the fault classes alone do not show.',
        setup: 'The same run, with every fault event in the cycle log examined rather than only '
          + 'the one that committed. The handler is six instructions long: two control-register '
          + 'reads, a branch, an add, a control-register write and an mret.',
        steps: [
          { do: 'Count the faults detected during the run.',
            why: 'Only one of them was real.',
            work: '6 illegal-instruction flags, every one of them raised past the end of a '
              + 'mispredicted loop' },
          { do: 'Check whether any of them committed.',
            why: 'A fault on the wrong path is not a fault.',
            work: '0 — each was squashed with the instruction carrying it when the branch '
              + 'resolved' },
          { do: 'Ask what happens if the machine acts on them.',
            why: 'This is not hypothetical; the simulator did it.',
            work: 'fetch freezes and never restarts, so the machine stops dead after 2 '
              + 'instructions, at the first mispredicted loop exit' },
          { do: 'Count the pipeline drains inside the handler.',
            why: 'mret and control-register writes cannot be forwarded.',
            work: '2 drains in 6 instructions — one for the mepc write and one for the mret' },
          { do: 'Measure the handler\'s cost against its length.',
            why: 'This is why a trap is expensive.',
            work: '6 instructions occupy far more than 6 cycles, because the machine empties twice' }
        ],
        answer: 'Two costs, neither of which appears in a list of fault classes. The first is '
          + 'that a speculative instruction carries a speculative exception, and a machine that '
          + 'forgets this freezes on the first wrong-path fetch — which this simulator did, and '
          + 'the symptom was a program that simply stopped after two instructions. The second '
          + 'is that a trap handler is full of serialising instructions: nothing forwards a '
          + 'control register, so the pipeline drains around the mepc write and again around '
          + 'the mret. That is a large part of why a system call costs far more than its '
          + 'instruction count suggests, and why every high-performance I/O interface of the '
          + 'last decade has been an attempt to make fewer of them.'
      }
    ],

    'pipeline-depth-limits': [
      {
        title: 'The depth curve, and why its bottom is where it is',
        goal: 'Evaluate the model at four depths and watch the two non-dividing terms take over.',
        setup: 'The model from `machines/pipeline-model.js`, with the defaults measured in '
          + 'M34.4: 175 gate delays of logic and 3 of flip-flop overhead. The workload has a '
          + 'branch every four instructions, a 12% misprediction rate and 0.15 cycles per '
          + 'instruction of hazard stalls.',
        steps: [
          { do: 'Evaluate at one stage.',
            why: 'The unpipelined baseline.',
            work: 'period 178, CPI 1.238, time 220 275' },
          { do: 'Evaluate at five stages.',
            why: 'The machine this milestone built.',
            work: 'period 38, CPI 1.350, time 51 300 — 4.3 times faster' },
          { do: 'Evaluate at twenty.',
            why: 'The depth the industry actually reached.',
            work: 'period 12, CPI 1.800, time 21 600 — the overhead is now 25% of every cycle' },
          { do: 'Evaluate at thirty-six and at forty.',
            why: 'To find the bottom rather than assume it.',
            work: '18 300 at thirty-six and 19 200 at forty — the curve has turned' },
          { do: 'Read off the two optima.',
            why: 'Performance and performance-per-watt disagree.',
            work: 'fastest at 35 stages; most efficient at 18' }
        ],
        answer: 'The curve falls by a factor of four in the first five stages, keeps falling '
          + 'slowly to a bottom in the mid thirties, and then turns up. Two things produced the '
          + 'turn and neither of them divides: the register overhead, which is paid once per '
          + 'stage and reaches a quarter of the period by twenty stages, and the branch '
          + 'penalty, which is measured in stages and so grows with exactly the thing that was '
          + 'supposed to help. The shape is as useful as the optimum: steep on the left and '
          + 'almost flat on the right, so guessing too shallow costs far more than guessing too '
          + 'deep. And the two optima disagreeing by a factor of two is the whole reason the '
          + 'industry\'s answer changed once power became the binding constraint.'
      },
      {
        title: 'Our overhead is unrealistically small, and saying so is the point',
        goal: 'Test the model against a ratio no real design has, and watch the optimum move.',
        setup: 'The same model with the register overhead as a control. The measured value from '
          + 'M34.4 is 3 gate delays against 175 of logic — a ratio of 58 to 1 — because the '
          + 'M34 ALU is an unoptimised ripple-carry design. A real pipeline stage is nearer ten '
          + 'to one.',
        steps: [
          { do: 'Read the optimum at the measured overhead of 3.',
            why: 'The honest default.',
            work: 'fastest at 35 stages, most efficient at 18' },
          { do: 'Raise it to 10.',
            why: 'Closer to a real ratio.',
            work: 'fastest at 25 stages, most efficient at 11' },
          { do: 'Raise it to 17.',
            why: 'About ten to one, which is realistic.',
            work: 'fastest at 18, most efficient at 8 — and the workloads now separate' },
          { do: 'Compare the workloads at that overhead.',
            why: 'The optimum is a property of the workload, not of the machine.',
            work: 'predictable branches want 35 stages; unpredictable ones want 18' },
          { do: 'Compare with what was actually built.',
            why: 'The model has to answer to history.',
            work: 'shipped depths settled at roughly 14 to 20 stages' }
        ],
        answer: 'At the overhead this project measured, the model recommends a very deep '
          + 'pipeline — which is a correct consequence of a datapath nobody would ship, and '
          + 'exactly the sort of result that should be reported rather than tuned away. Raising '
          + 'the overhead towards a realistic share moves the optimum into the range machines '
          + 'actually reached and makes the workloads separate by a factor of two. That last '
          + 'part is the difficulty at the heart of general-purpose processor design: one '
          + 'pipeline gets built, different programs want different ones, and the industry ran '
          + 'the experiment in public. The Pentium 4 chased the term the model says improves '
          + 'and paid the two it says get worse; the shallower design beat it on real work, and '
          + 'the line that survived came from the shallow one.'
      }
    ],

    'pipeline-friendly-code': [
      {
        title: 'The same values in a different order, and 60 cycles',
        goal: 'Reproduce the sorted-array result with the mechanism counted rather than guessed.',
        setup: 'A loop that sums the elements of a 64-element array that are at least 128. The '
          + 'same 64 values are used twice, once sorted and once shuffled, so the branch is '
          + 'taken the same number of times and the answer is identical. The machine has a '
          + 'two-bit predictor and a two-cycle misprediction penalty.',
        steps: [
          { do: 'Run over the sorted data.',
            why: 'The branch is a long run of not-taken then a long run of taken.',
            work: '503 cycles, 4 mispredicts, answer 6 947' },
          { do: 'Run over the shuffled data.',
            why: 'The same values, the same comparison, a different order.',
            work: '563 cycles, 34 mispredicts, answer 6 947' },
          { do: 'Attribute the difference.',
            why: 'A timing difference alone admits a dozen explanations.',
            work: '30 extra mispredicts x 2 cycles = 60 cycles, which is the whole difference' },
          { do: 'Check the instruction counts.',
            why: 'To rule out the loop doing different work.',
            work: '424 instructions in both runs' },
          { do: 'Check the answers.',
            why: 'To rule out the comparison being different.',
            work: '6 947 in both runs' }
        ],
        answer: 'Twelve per cent slower on identical data doing identical work, and every one '
          + 'of the extra cycles is a mispredicted branch. This is the famous result, and '
          + 'reproducing it with the mispredict counter rather than only the clock is what '
          + 'makes it an explanation instead of an anecdote — a timing difference alone could '
          + 'have been cache behaviour, memory layout or the allocator. The mechanism is that a '
          + 'two-bit counter learns "not taken" for the first half of the sorted array and '
          + '"taken" for the second, and mispredicts only at the boundary; on shuffled data '
          + 'there is no pattern to learn and it is wrong about half the time on the elements '
          + 'that straddle the threshold.'
      },
      {
        title: 'The branchless version loses here and wins on a bigger machine',
        goal: 'Price the branchless rewrite properly, and find the penalty at which it flips.',
        setup: 'The same filter, written without a branch: a comparison producing 0 or 1, a '
          + 'subtraction turning that into a mask of all zeros or all ones, and an AND applying '
          + 'it. Three extra instructions per element, executed unconditionally, and no branch '
          + 'to mispredict.',
        steps: [
          { do: 'Run the branchless version on both data orders.',
            why: 'Insensitivity to the order is its whole appeal.',
            work: '654 cycles either way, 1 mispredict, answer 6 947' },
          { do: 'Compare with the branchy version on shuffled data.',
            why: 'The case branchless is supposed to win.',
            work: '654 against 563 — branchless is 16% slower' },
          { do: 'Count the instructions.',
            why: 'This is what it paid.',
            work: '581 against 424 — 157 extra instructions for 64 elements' },
          { do: 'Solve for the penalty at which they tie.',
            why: 'The answer is a property of the machine, so make it explicit.',
            work: '91 extra cycles over 33 avoided mispredicts, plus the 2 already paid: about '
              + '4.8 cycles' },
          { do: 'Scale the mispredicts to larger penalties.',
            why: 'The same code on a deeper machine.',
            work: 'at 5 cycles: 665 against 657. At 20: 1 175 against 672' }
        ],
        answer: 'The branchless rewrite is 16% slower on this five-stage pipeline and nearly '
          + 'twice as fast on a deep out-of-order one, with no change to the source. The '
          + 'break-even is a misprediction penalty of about 4.8 cycles, which every processor '
          + 'built in the last twenty years exceeds — so the usual advice is right for the '
          + 'usual machine and wrong for this one, and neither is a fact about the code. The '
          + 'discipline that follows is not "prefer branchless" or "prefer branchy": it is to '
          + 'know the mispredict rate and the penalty before rewriting anything, and both are '
          + 'available from a hardware counter that every profiler can read. Guessing instead '
          + 'is how branchless rewrites get shipped for branches that were never mispredicted, '
          + 'measured on test data that happened to be sorted.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
