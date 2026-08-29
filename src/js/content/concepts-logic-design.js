/** Concepts for timing, power and hardware description (M33.9-M33.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'timing-clocking-and-power': [
      {
        term: 'Static timing analysis walks paths; it does not simulate',
        diagram: {
          definition: [
            'flowchart LR',
            '    L["launch flip-flop"] -->|"clock-to-q: 2"| C["combinational logic"]',
            '    C -->|"longest path"| K["capture flip-flop"]',
            '    K -->|"setup: 1"| E["next clock edge"]',
            '    C -.->|"shortest path"| H["hold check:<br/>must NOT arrive too early"]',
            '    E -.->|"period = clock-to-q + logic + setup"| P["the budget"]'
          ].join('\n'),
          caption: 'Everything that must fit inside one period. The setup check uses the '
            + 'longest path and is fixed by a slower clock; the hold check uses the shortest '
            + 'path and is not.'
        },
        plain: 'Measure every start-to-end path structurally and report the worst.',
        formal: 'start points are inputs and flip-flop outputs; end points are outputs and flip-flop data inputs',
        detail: 'Walking paths covers every possible input pattern at once, which simulation '
          + 'cannot do and which is why every real flow is built on it. It is also why a '
          + 'passing simulation is not a timing argument: the vectors you drove may simply not '
          + 'have exercised the worst path. The cost of that generality is pessimism — some '
          + 'reported paths are logically impossible — and finding those false paths is a real '
          + 'part of closing timing.',
        example: 'The 8-bit ripple adder reports a 35-delay input-to-output path, which is the '
          + 'worst over all 131 072 operand combinations rather than the one measured.'
      },
      {
        term: 'The period is clock-to-q plus logic plus setup, and only the middle term is yours',
        plain: 'The flip-flop overhead is paid every stage, whatever the logic does.',
        formal: 'period >= clockToQ + logic + setup',
        readAs: 'the clock period must cover the flip-flop delay, then the logic, then the setup time.',
        detail: 'That fixed overhead is what puts a floor under pipelining. Cutting the logic '
          + 'in half halves only the middle term, so the speed-up is less than two, and doing '
          + 'it repeatedly drives the overhead\'s share of the period towards one. The demo '
          + 'prints that share per stage count, which turns "pipelining has diminishing '
          + 'returns" from a slogan into a number you can point at.',
        example: 'For the ripple adder: 35 of logic and 3 of overhead gives a period of 38, so '
          + 'the overhead is 8% at one stage and 25% at four.'
      },
      {
        term: 'There are four classes of path and each is a different contract',
        plain: 'Register to register, input to register, register to output, input to output.',
        formal: 'only register-to-register sets your own clock period',
        detail: 'The other three are agreements with whatever is on the other side of the chip '
          + 'boundary: an input setup requirement you impose on your driver, an output delay '
          + 'you impose on your consumer, and a pure combinational delay budgeted by the system '
          + 'around you. Confusing them produces a design that meets timing internally and '
          + 'fails at the interface, which is the hardware version of a service that is fast '
          + 'until you measure it from the client.',
        example: 'The demo\'s adders have only an input-to-output path and no clock of their '
          + 'own; the state machine has all four.'
      },
      {
        term: 'Slack is the number a timing report exists to produce',
        plain: 'Target period minus required period: positive is headroom, negative does not run.',
        formal: 'slack = target - (clockToQ + logic + setup)',
        detail: 'Every optimisation in a synthesis tool is aimed at the most negative slack, '
          + 'and every other path is ignored until that one is fixed — which is why timing '
          + 'closure feels like whack-a-mole: fixing the worst path promotes the next one. The '
          + 'discipline of optimising exactly the binding constraint and nothing else transfers '
          + 'directly to performance work in software, where the equivalent mistake is '
          + 'optimising the function that is easiest to optimise.',
        example: 'The demo reports the ripple adder at a period of 38 against a target of 30: '
          + 'slack of −8, which is a design that does not run at that speed.'
      },
      {
        term: 'Hold violations are fixed by adding delay, and by nothing else',
        plain: 'A path too FAST overwrites the value being captured.',
        formal: 'shortest path from launch to capture must exceed the hold time',
        detail: 'Slowing the clock moves both edges together, so it changes nothing. Skew makes '
          + 'it worse in one direction and better in the other, which is why clock trees are '
          + 'the most carefully engineered wiring on a chip. The only fix is to insert buffers '
          + 'whose sole purpose is to be slow — a construction that looks like a mistake to '
          + 'anybody who has not met the constraint, and is mandatory once you have.',
        example: 'The demo\'s findings table pairs each symptom with the fix and, more usefully, '
          + 'with the fix that does not work.'
      },
      {
        term: 'Pipelining trades latency for throughput and saturates',
        plain: 'Divide the logic by k, add the overhead k times.',
        formal: 'period_k = ceil(logic / k) + overhead; speed-up ceiling = (logic + overhead) / overhead',
        readAs: 'the best possible speed-up is the whole delay divided by the per-stage overhead.',
        detail: 'The ceiling is reached only at infinitely many stages and is approached slowly, '
          + 'while latency gets worse the whole way down — which is the cost nobody advertises. '
          + 'In a processor there is a second cost that is not in this arithmetic: every extra '
          + 'stage lengthens the branch misprediction penalty, which is why pipeline depths '
          + 'peaked and then came back down.',
        example: 'Cutting 35 gate delays into 2 stages gives a period of 21 and a speed-up of '
          + '1.81; 6 stages gives 4.22; the ceiling is 12.67.'
      },
      {
        term: 'Dynamic power is switching, so a glitch is energy spent computing nothing',
        plain: 'A wire that changes three times before settling cost three times one that changed once.',
        formal: 'dynamic power is proportional to activity x capacitance x voltage^2 x frequency',
        readAs: 'power grows with how often wires switch, with capacitance, with the square of the voltage and with frequency.',
        detail: 'The demo counts every wire change over a set of seeded transitions and reports '
          + 'how many were glitches, which makes the hazard from the minimisation section '
          + 'reappear as a power bill. It also shows the measurement depending entirely on how '
          + 'the inputs are driven: a uniform walk of the low bits measures almost no glitching '
          + 'because consecutive vectors differ in one bit, and a glitch needs several inputs '
          + 'moving at once.',
        example: 'Over 32 seeded transitions the 8-bit ALU wastes 41.1% of its switching on '
          + 'glitches — 1 296 of 3 157 wire changes.'
      },
      {
        term: 'Power goes as voltage squared, which ended the frequency race',
        plain: 'Two cores at half the frequency and a lower voltage beat one core at full speed.',
        formal: 'P = a x V^2 x f, so halving f and V gives a quarter of the dynamic power per core',
        readAs: 'power is switching activity times the voltage squared times the clock frequency.',
        detail: 'Two cores at half frequency do the same total work as one at full, and the '
          + 'lower frequency permits a lower voltage — and the square makes that a large win. '
          + 'The proviso is that the work must divide, which is the whole of parallel '
          + 'programming and why Amdahl\'s law stopped being academic around 2005. Leakage '
          + 'scales with voltage alone and does not shrink the same way, which is why the '
          + 'strategy has limits.',
        example: 'The demo\'s comparison: two cores at half frequency use about 29% of the '
          + 'power of one core at full speed for the same throughput.'
      }
    ],
    'hardware-description-and-verification': [
      {
        term: 'A hardware description is data, not a drawing',
        plain: 'A module is a name, a list of ports, and a body that wires things together.',
        formal: 'a value, therefore diffable, parameterisable, generatable and testable',
        detail: 'That is the entire argument for hardware description languages, and it is the '
          + 'same argument as infrastructure-as-code: a schematic cannot be diffed, reviewed, '
          + 'generated by a loop or tested in isolation, and a value can. The demo\'s 4-bit '
          + 'adder is written as a loop instantiating one module four times, and a 64-bit '
          + 'version is the same four lines with a different constant.',
        example: 'The demo\'s library is four modules; the 4-bit adder elaborates to 44 gates '
          + 'from 20 module instances.'
      },
      {
        term: 'Elaboration flattens the hierarchy, and everything downstream sees only the result',
        diagram: {
          definition: [
            'flowchart TD',
            '    SRC["module hierarchy"] --> EL["elaboration"]',
            '    EL --> NET["one flat netlist<br/>hierarchy survives only in labels"]',
            '    NET --> SIM["simulation<br/>the vectors you thought of"]',
            '    NET --> EQ["equivalence check<br/>every vector, against a model"]',
            '    NET --> COV["coverage<br/>which wires never moved"]',
            '    EQ -->|"names the failing vector"| BUG["a bug report"]',
            '    COV -.->|"says nothing about correctness"| BUG'
          ].join('\n'),
          caption: 'The flow the demo runs. Only the equivalence check can say "correct", and '
            + 'only because the input space of a combinational block is small enough to walk.'
        },
        plain: 'Modules organise people; the tools work on one flat netlist of primitive gates.',
        formal: 'instantiation copies the child body into the parent netlist with a name prefix',
        detail: 'The simulator, the timing analyser and the place-and-route tool all read the '
          + 'flat netlist, so a bug in elaboration is a bug in everything after it. The '
          + 'hierarchy survives as a naming convention, which is exactly how a linker treats '
          + 'module boundaries in a program — and why a synthesis report can still tell you '
          + 'which source module its gates came from.',
        example: 'The demo recovers 20 module instances for the 4-bit adder by reading the '
          + 'label prefixes of the flattened netlist.'
      },
      {
        term: 'A description says structure, not sequence',
        plain: 'Two assignments are two pieces of hardware that exist at the same time, forever.',
        formal: 'order matters only through data dependence; there is no program counter',
        detail: 'This is the hardest adjustment for a programmer, and the model that works is a '
          + 'dataflow graph rather than a list of statements. Everything in a combinational '
          + 'block happens continuously and simultaneously; the only sequencing in the whole '
          + 'design comes from the clock edges. A description written as if it were a program '
          + 'produces either a mess of latches or a synthesis error, and both are the tool '
          + 'telling you the model is wrong.',
        example: 'The demo\'s modules return maps from output port to wire, which is what makes '
          + 'the description a graph rather than a sequence.'
      },
      {
        term: 'Combinational verification can be exhaustive, and that changes what "tested" means',
        plain: 'A block with ten inputs has 1 024 vectors; drive all of them.',
        formal: 'the input space is 2^n and correctness is a finite statement over it',
        readAs: 'the number of input vectors is two raised to the power of the number of input bits.',
        detail: 'Past twenty or so inputs that stops being possible, and the honest thing is to '
          + 'report the fraction rather than to imply the rest. That is a discipline worth '
          + 'importing into software: "sampled 400 of 131 072, seeded, reproducible" is a claim '
          + 'somebody can check and repeat, and "well tested" is not. The demo refuses '
          + 'exhaustive checks past its limit and says why rather than quietly sampling.',
        example: 'The full adder is checked on all 8 vectors and the 4-bit adder on all 512; '
          + 'the 16:1 multiplexer at 20 inputs is refused with a stated reason.'
      },
      {
        term: 'The model must be written from the specification, not from the implementation',
        plain: 'An oracle derived from the code under test agrees by construction and proves nothing.',
        formal: 'the reference computes the function arithmetically; the netlist computes it structurally',
        detail: 'This is the single most transferable idea in the milestone. The demo\'s adder '
          + 'model adds two JavaScript numbers; the netlist ripples carries through gates. They '
          + 'share no structure, so agreement over the whole input space is evidence. A model '
          + 'that reused the circuit\'s decomposition would agree with its bugs too, which is '
          + 'exactly what happens when a test asserts what the code currently returns.',
        example: 'The demo\'s injected typo changes one gate; the netlist still elaborates and '
          + 'simulates, and only the independently written model catches it.'
      },
      {
        term: 'Simulation shows behaviour; equivalence checking shows correctness',
        plain: 'A testbench reports what happened on the vectors you thought of.',
        formal: 'simulation is existential over your vectors; equivalence is universal over all of them',
        readAs: 'a testbench checks the cases you chose; an equivalence check covers every one of them.',
        detail: 'They answer different questions and a design needs both, because simulation is '
          + 'the only one that shows the waveform — glitches, settling times, the order things '
          + 'arrive in — and equivalence is the only one that can say the function is right. '
          + 'Neither subsumes the other, which is why a hardware flow runs both and a software '
          + 'flow that only has examples is missing half the picture.',
        example: 'The demo\'s testbench prints settling times per vector; the equivalence check '
          + 'prints one verdict over all of them.'
      },
      {
        term: 'Coverage measures your tests, never your design',
        plain: 'Toggle coverage says which wires moved, not whether the answers were right.',
        formal: 'vector coverage = vectors driven / 2^n; toggle coverage = wires seen at both values / wires',
        detail: 'The demo makes the failure mode concrete: a hand-written corner-case list '
          + 'reaches 80% toggle coverage on the full adder, visits half the input space, and '
          + 'misses the injected bug entirely. Even a single vector toggles some wires. Toggle '
          + 'coverage saturates long before testing does, which is precisely the relationship '
          + 'line coverage has to correctness in software — a floor worth having and a goal '
          + 'worth distrusting.',
        example: 'Corner cases: 4 vectors, 50% of the space, 80% toggle coverage — and the '
          + 'injected typo passes.'
      },
      {
        term: 'Formal equivalence is the same idea, scaled by a SAT solver',
        plain: 'Prove two netlists compute the same function instead of walking every vector.',
        formal: 'assert the two outputs differ, and let a solver prove that formula unsatisfiable',
        detail: 'The miter construction — XOR the two designs\' outputs together and ask a '
          + 'solver whether the result can ever be 1 — is what lets a synthesis flow apply '
          + 'thousands of transformations to a million-gate design and still guarantee the '
          + 'result matches the source. It is the previous milestone\'s CDCL machinery doing '
          + 'industrial work, and it is the strongest argument in this course for learning how '
          + 'a SAT solver works.',
        example: 'The demo walks vectors because its blocks are small; the industrial version '
          + 'replaces that walk with the solver from M32.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
