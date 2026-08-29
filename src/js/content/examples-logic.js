/** Worked examples for gates, minimisation and the blocks (M33.1-M33.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'boolean-algebra-and-gates': [
      {
        title: 'One function, two circuits, and the price of using one gate type',
        goal: 'Measure what functional completeness costs, rather than accepting that it holds.',
        setup: 'Exclusive-or built two ways: as the library cell a standard cell library '
          + 'provides, and as four NANDs. Both are run over every input combination by two '
          + 'evaluators — a zero-delay reference and an event-driven simulation with a delay '
          + 'per gate — so the value and the timing are measured separately.',
        steps: [
          { do: 'Build exclusive-or as one library cell and read its cost.',
            why: 'The baseline: what the function costs when somebody has already optimised it.',
            work: '1 gate, 12 transistors, critical path 3 gate delays' },
          { do: 'Build the same function from four NANDs and read the same numbers.',
            why: 'This is the construction functional completeness guarantees exists.',
            work: '4 gates, 16 transistors, critical path 3 gate delays' },
          { do: 'Compare both against the truth table, row by row.',
            why: 'Two circuits are the same function only if every row agrees.',
            work: 'both are 1 on rows 1 and 2 of 4, and the two evaluators agree on 4 of 4 rows' },
          { do: 'Build NOT, AND and OR from NANDs and count.',
            why: 'The rest of the completeness proof, priced.',
            work: '1, 2 and 3 NANDs — 4, 8 and 12 transistors, at delays 1, 2 and 2' }
        ],
        answer: 'Functional completeness is real and it costs 33% here: 16 transistors against '
          + '12 for the same function, at the same depth. That is why a fabrication process can '
          + 'be built around one gate type and why a standard cell library still ships an XOR '
          + 'cell — the possibility argument and the economics point in opposite directions. '
          + 'The AND and OR rows carry the other half of the story: a NAND is 4 transistors and '
          + 'an AND is 6, because an AND is a NAND with an inverter after it. That single fact '
          + 'is why De Morgan\'s laws are an engineering tool rather than an identity, and why '
          + 'a synthesised netlist is full of inverting gates however the source was written.'
      },
      {
        title: 'Reading a truth table off a circuit that was never given one',
        goal: 'Derive the canonical and minimised forms from a netlist rather than the reverse.',
        setup: 'Three three-input circuits from the demo — majority of three, a 2:1 '
          + 'multiplexer cell, and the AND-OR circuit that glitches. Each is evaluated on all '
          + 'eight input combinations, the minterms are read off the results, and the canonical '
          + 'and minimised expressions are generated from those minterms.',
        steps: [
          { do: 'Evaluate majority of three on all eight rows and collect the minterms.',
            why: 'The carry output of a full adder, and the function every minimiser gets right.',
            work: '5 gates at depth 6; output is 1 on rows 3, 5, 6 and 7 — 4 of 8' },
          { do: 'Do the same for the multiplexer cell.',
            why: 'A library primitive, so the gate count says what a cell costs, not a build.',
            work: '1 gate at depth 3; 1 on rows 1, 3, 6 and 7 — also 4 of 8' },
          { do: 'Do the same for the hazard circuit.',
            why: 'The circuit the next section fixes; note that its table is unremarkable.',
            work: '4 gates at depth 5; 1 on rows 3, 4, 5 and 7' },
          { do: 'Check the event-driven simulation against the zero-delay reference on every row.',
            why: 'Two evaluators sharing no code is the only way to trust either.',
            work: '8 of 8 rows agree for each circuit, and the settling times differ per row' }
        ],
        answer: 'Three circuits with four minterms each, and three different costs — 5 gates, 1 '
          + 'gate and 4 gates — which is the width-against-depth trade appearing before any '
          + 'adder does. The important discipline is the direction of derivation: the table is '
          + 'produced by running the netlist, so it describes the circuit that exists rather '
          + 'than the circuit somebody meant to build. The hazard circuit is the one to '
          + 'remember. Its table is correct on all eight rows, it agrees with the reference on '
          + 'all eight rows, and its output still dips during one input change — which no '
          + 'amount of looking at the table will ever reveal.'
      }
    ],
    'logic-minimisation': [
      {
        title: 'From ten minterms to seven literals, with every step measured',
        goal: 'Run the whole flow on one function and price each stage.',
        setup: 'The four-variable function with minterms 0, 1, 2, 5, 6, 7, 8, 9, 10 and 14 and '
          + 'no don\'t-cares. Every cover is rebuilt as a two-level AND-OR netlist and checked '
          + 'back against the original minterms, so the comparison is between circuits rather '
          + 'than between expressions.',
        steps: [
          { do: 'Write the canonical sum of products and build it.',
            why: 'The mechanical form that always exists, as a cost baseline.',
            work: '10 terms, 40 literals, 43 gates at depth 25' },
          { do: 'Merge to prime implicants and find the essentials.',
            why: 'The exact half of minimisation, and the part with no choices in it.',
            work: '6 prime implicants, of which 2 are essential' },
          { do: 'Take the essentials, then cover the rest greedily, and build the result.',
            why: 'What every production minimiser does.',
            work: '3 terms, 7 literals, 10 gates at depth 7 — and correct on every row' },
          { do: 'Search every subset of the 6 primes for the cheapest cover.',
            why: 'So that "minimal" is a measurement rather than a claim.',
            work: '64 subsets searched; the minimum is also 3 terms and 7 literals' }
        ],
        answer: 'Minimisation turns 43 gates into 10 and depth 25 into 7 — a factor of four in '
          + 'area and of three in delay for a mechanical transformation. On this function the '
          + 'greedy answer is the minimum, which is the usual outcome and the reason a '
          + 'heuristic is acceptable in a shipping tool: 2 of the 6 primes were forced, and the '
          + 'covering step had very little room to go wrong. The exhaustive search is worth '
          + 'running anyway, because it converts "we believe this is minimal" into "we checked '
          + '64 subsets". That distinction is the whole difference between a measured claim and '
          + 'a remembered one.'
      },
      {
        title: 'Where greedy loses, and what the minimiser removed that you wanted',
        goal: 'Find the two failure modes of minimisation and measure both.',
        setup: 'Two functions: the trap, with minterms 0, 1, 2, 5, 6 and 7 and no essential '
          + 'prime implicants at all, and the classic function whose minimised cover glitches. '
          + 'Hazards are found by listing every pair of adjacent rows that are both 1, and each '
          + 'pair is then simulated in both directions with per-gate delays.',
        steps: [
          { do: 'Run the greedy cover on the trap function.',
            why: 'With no essentials, the covering heuristic is doing all the work.',
            work: '4 terms, 8 literals, 10 gates at depth 9' },
          { do: 'Run the exhaustive search on the same function.',
            why: 'The only honest way to say what minimal is.',
            work: '3 terms, 6 literals, 8 gates at depth 7 — greedy loses by 2 literals' },
          { do: 'Take the minimised classic function and simulate every adjacent pair of ones.',
            why: 'A hazard is invisible in the truth table and visible in a transition.',
            work: '4 of 13 adjacent pairs make the output dip, all on the falling edge' },
          { do: 'Add back the redundant terms that cover those pairs and measure again.',
            why: 'The fix is exactly the term minimisation discarded.',
            work: '0 of 13 glitch, at 7 terms, 19 literals, 22 gates and depth 15' }
        ],
        answer: 'Two independent failures, both real. Greedy loses on the trap function because '
          + 'nothing is forced: it takes a large term early and then needs extra terms to cover '
          + 'what that choice left behind. And the minimised classic function is correct on '
          + 'every row of its table while dipping on 4 of its 13 adjacent transitions, because '
          + 'the term that used to hold the output up during the switch was removed for being '
          + 'unnecessary. Removing it was correct with respect to the specification; the '
          + 'specification just did not say anything about what happens on the way between two '
          + 'rows. Buying the glitch back costs 12 gates and 8 gate delays here, which is why '
          + 'you spend it only where the clock is not there to hide the dip.'
      }
    ],
    'combinational-blocks': [
      {
        title: 'Tree against flat, at four widths, with the textbook claim tested',
        goal: 'Measure the multiplexer both ways and see whether "flat is constant depth" holds.',
        setup: 'The same 2^k:1 multiplexer built as a tree of 2:1 stages and as one level of '
          + 'decoded AND terms feeding an OR, both from two-input gates, at k = 1, 2, 3 and 4. '
          + 'Both forms are checked against the same behavioural model over the whole input '
          + 'space where that is possible.',
        steps: [
          { do: 'Build 2:1 both ways.',
            why: 'The base case, where the tree is a single library cell.',
            work: 'tree 1 gate at depth 3; flat 4 gates at depth 5' },
          { do: 'Build 4:1 both ways and check both against the model.',
            why: 'Six inputs is 64 vectors, so "checked" means all of them.',
            work: 'tree 3 gates at depth 6; flat 13 gates at depth 9; both agree on 64 of 64' },
          { do: 'Build 8:1 both ways.',
            why: 'The width where the gate counts start to separate.',
            work: 'tree 7 gates at depth 9; flat 34 gates at depth 13' },
          { do: 'Build 16:1 both ways.',
            why: 'Far enough to see which curve is which.',
            work: 'tree 15 gates at depth 12; flat 83 gates at depth 17' }
        ],
        answer: 'The tree grows linearly in gates and logarithmically in depth, exactly as '
          + 'advertised. The flat form does not behave as advertised at all: it is larger AND '
          + 'deeper at every width measured, because "constant depth" assumes an unbounded '
          + 'fan-in AND and OR, and with two-input gates the decode is itself a tree — so the '
          + 'flat form pays a logarithm twice. The construction wins only where a wide term '
          + 'really is one gate: a PLA row, a memory word line, a domino AND-OR stage. That '
          + 'caveat is worth more than the slogan it replaces, and it generalises: a complexity '
          + 'claim that assumes an unrealistic primitive is a claim about a machine you do not '
          + 'have.'
      },
      {
        title: 'Five blocks, five cost shapes, and a verification budget that runs out',
        goal: 'Measure each block against a model, and watch exhaustive checking stop being possible.',
        setup: 'Each block is built as a netlist and checked against a model written in '
          + 'arithmetic from its specification — not derived from the circuit. Every input '
          + 'vector is driven where the input count allows it, and the check is refused with a '
          + 'reason where it does not.',
        steps: [
          { do: 'Build the 2-bit decoder and check it.',
            why: 'Four rows, so the check is trivially complete.',
            work: '6 gates at depth 3, agreeing with the model on 4 of 4 vectors' },
          { do: 'Build the 4-input priority encoder and check it.',
            why: 'A chain rather than a tree, which the depth should show.',
            work: '9 gates at depth 7, agreeing on 16 of 16 vectors' },
          { do: 'Build the 4-bit comparator and check it.',
            why: 'Eight inputs is 256 vectors, still exhaustible.',
            work: '24 gates and 152 transistors at depth 13, agreeing on 256 of 256' },
          { do: 'Build the 8-bit barrel shifter and check it.',
            why: 'Eleven inputs is 2 048 vectors, which is the practical edge.',
            work: '24 gates and 288 transistors at depth 9, agreeing on 2 048 of 2 048' },
          { do: 'Ask for the 16:1 multiplexer at 20 inputs.',
            why: 'To see the tool refuse rather than quietly sample.',
            work: '20 inputs is 1 048 576 vectors — past the limit, and reported as such' }
        ],
        answer: 'Four blocks fully verified and one refused, which is the honest shape of a '
          + 'verification report. The depth column is the part to read structurally: the '
          + 'priority encoder is depth 7 on four inputs where the decoder is depth 3, because '
          + 'priority is a chain and decoding is not — and that difference is why interrupt '
          + 'latency grows with the number of sources while address decoding does not. The '
          + 'barrel shifter is the other one worth keeping: 24 gates gives any shift distance '
          + 'in 9 gate delays, and the delay does not depend on the distance, which is both why '
          + 'a variable shift is one cycle and why it is not a timing side channel.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
