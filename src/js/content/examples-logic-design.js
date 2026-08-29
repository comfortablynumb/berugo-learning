/** Worked examples for timing, power and hardware description (M33.9-M33.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'timing-clocking-and-power': [
      {
        title: 'A timing report on the adder from four sections ago',
        goal: 'Read a real timing report: paths, critical path, slack, and what pipelining buys.',
        setup: 'The 8-bit ripple-carry adder, analysed structurally rather than simulated. '
          + 'Every path from a start point — an input or a flip-flop output — to an end point '
          + 'is measured, and the clock model charges 2 gate delays of clock-to-q and 1 of '
          + 'setup.',
        steps: [
          { do: 'Classify the paths in the netlist.',
            why: 'Only register-to-register paths set a circuit\'s own clock period.',
            work: 'one class present: input to output, 35 gate delays from a0 to cout' },
          { do: 'Compute the minimum clock period.',
            why: 'Logic plus the fixed flip-flop overhead.',
            work: '35 of logic plus 3 of overhead = 38, so the overhead is 8% of the period' },
          { do: 'Ask for a target period of 30.',
            why: 'Slack is the number a timing report exists to produce.',
            work: 'slack −8: the design does not run at that speed' },
          { do: 'Cut the logic into 2 and then 6 pipeline stages.',
            why: 'The standard fix, and the place its returns diminish.',
            work: '2 stages: period 21, speed-up 1.81. 6 stages: period 9, speed-up 4.22' },
          { do: 'Compute the ceiling on that speed-up.',
            why: 'The overhead does not divide, so the gain is bounded.',
            work: '(35 + 3) / 3 = 12.67 times, at infinitely many stages' }
        ],
        answer: 'A period of 38 gate delays, of which 3 are flip-flop overhead that no amount '
          + 'of design removes. Pipelining divides only the logic term, so two stages give 1.81 '
          + 'times rather than 2, six give 4.22 rather than 6, and the ceiling is 12.67 — '
          + 'approached slowly and never reached. Latency gets worse the whole way down: at six '
          + 'stages a single addition takes 54 gate delays instead of 38, which is the cost '
          + 'nobody advertises when they quote the throughput. In a processor there is a second '
          + 'cost this arithmetic does not include, because every extra stage lengthens the '
          + 'branch misprediction penalty — which is why pipeline depths rose for a decade and '
          + 'then came back down.'
      },
      {
        title: 'Glitches are a power bill, and the measurement depends on how you drive it',
        goal: 'Count switching that computed nothing, and watch a bad sampling method hide it.',
        setup: 'Switching activity measured by simulating pairs of input vectors and counting '
          + 'how often each wire changed. A wire that changes more than once before settling '
          + 'has glitched: it did no useful work and cost exactly as much as a wire that '
          + 'changed once.',
        steps: [
          { do: 'Drive 32 seeded random transitions through the 8-bit ripple adder.',
            why: 'Random vectors move many inputs at once, which is when glitches happen.',
            work: '887 wire changes, of which 197 were glitches — 22.2% wasted' },
          { do: 'Do the same for the 8-bit ALU.',
            why: 'More reconvergent paths, so more unbalanced arrival times.',
            work: '3 157 changes, 1 296 of them glitches — 41.1% wasted' },
          { do: 'Do the same for the carry-lookahead adder and the state machine.',
            why: 'To see the range, and a circuit that does not glitch at all.',
            work: 'lookahead 19.8% of 1 938 changes; the state machine 0 of 153' },
          { do: 'Replace the random vectors with a uniform walk of the low input bits.',
            why: 'The first version of this measurement did exactly that.',
            work: 'consecutive vectors differ in one or two bits and the measured glitch rate '
              + 'collapses to 0 of 887' }
        ],
        answer: 'Between a fifth and two fifths of all switching in these arithmetic circuits '
          + 'computes nothing — 41.1% in the ALU — and every one of those transitions costs the '
          + 'same energy as a useful one. That is the hazard from the minimisation section '
          + 'reappearing in a different unit, and it is why balancing path delays and adding '
          + 'redundant terms are power techniques as well as correctness techniques. The last '
          + 'step is the methodological one and it is worth more than the numbers: a uniform '
          + 'walk of the low bits reports no glitching at all, not because the circuit is clean '
          + 'but because consecutive vectors differ in one bit and a glitch needs several '
          + 'inputs moving at once. The benchmark was measuring the sampling method rather than '
          + 'the circuit — which is the most common way a performance measurement goes quietly '
          + 'wrong.'
      }
    ],
    'hardware-description-and-verification': [
      {
        title: 'A hierarchy, elaborated, and checked over its whole input space',
        goal: 'Follow a design from four modules to a verdict.',
        setup: 'A library of four modules: exclusive-or from four NANDs, a half adder using '
          + 'it, a full adder using two half adders, and a 4-bit adder instantiating four full '
          + 'adders in a loop. Each is elaborated into a flat netlist and checked against a '
          + 'model written arithmetically from its specification.',
        steps: [
          { do: 'Elaborate xor2 and check it.',
            why: 'The leaf, where the model is one exclusive-or.',
            work: '4 gates at depth 3, agreeing on all 4 vectors' },
          { do: 'Elaborate the full adder and count what it flattened.',
            why: 'Two half adders and an OR, and the hierarchy survives only in the labels.',
            work: '11 gates at depth 7 from 4 module instances, agreeing on all 8 vectors' },
          { do: 'Elaborate the 4-bit adder.',
            why: 'Written as a loop, so a 64-bit version is the same code.',
            work: '44 gates at depth 19 from 20 module instances' },
          { do: 'Check it against integer addition on every input vector.',
            why: 'Nine inputs is 512 vectors — the whole space.',
            work: 'all 512 agree, so the block is verified rather than tested' }
        ],
        answer: 'Four modules become one flat netlist of 44 gates, and the hierarchy survives '
          + 'only as label prefixes — which is why a bug in elaboration is a bug in everything '
          + 'downstream, and why the simulator, the timing analyser and the equivalence checker '
          + 'all read the flat form. The verification claim is the part worth being precise '
          + 'about: 512 of 512 vectors is the entire input space, so "verified" here means '
          + 'something a software test almost never means. The model matters as much as the '
          + 'coverage. It adds two JavaScript numbers where the netlist ripples carries through '
          + 'gates, so the two share no structure and agreement is evidence — a model derived '
          + 'from the circuit would have agreed with its bugs too.'
      },
      {
        title: 'One gate wrong, and what each check has to say about it',
        goal: 'Inject a realistic typo and see which tools catch it.',
        setup: 'The same library with one change: in the full adder, the sum output is taken '
          + 'from an OR of the first half-adder\'s sum and the carry in, rather than from the '
          + 'second half adder. It is a plausible slip, it elaborates cleanly, and it is wrong '
          + 'on some inputs and right on others.',
        steps: [
          { do: 'Elaborate the broken full adder and look for anything suspicious.',
            why: 'To establish that structure alone does not reveal it.',
            work: '12 gates instead of 11 at the same depth 7 — nothing looks wrong' },
          { do: 'Run the exhaustive equivalence check on it.',
            why: 'Eight vectors is the whole space for a full adder.',
            work: 'fails, and names the vector: a=1 b=0 cin=1, where sum is 1 and should be 0' },
          { do: 'Run the hand-written corner-case list instead and read its coverage.',
            why: 'This is what a testbench somebody wrote in a hurry looks like.',
            work: '4 vectors, 50.0% of the input space, 80% toggle coverage — and it PASSES' },
          { do: 'Check the 4-bit adder that instantiates the broken module.',
            why: 'A bug in a leaf module propagates to everything above it.',
            work: 'fails, naming a 9-bit input vector out of the 512 checked' }
        ],
        answer: 'The corner-case list drives half the input space, toggles 80% of the wires, '
          + 'and passes a design that is wrong — which is the entire argument against reading a '
          + 'coverage number as a quality number. Toggle coverage measures whether your tests '
          + 'moved the wires; it never looks at whether the answers were right, so it saturates '
          + 'long before testing does. Only the exhaustive check against an independently '
          + 'written model finds the bug, and it does more than report a failure: it names the '
          + 'exact input vector, which turns a verdict into a bug report. That is the shape '
          + 'worth importing into software — a property stated separately from the '
          + 'implementation, checked over as much of the input space as you can afford, and a '
          + 'counterexample rather than a red bar when it fails.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
