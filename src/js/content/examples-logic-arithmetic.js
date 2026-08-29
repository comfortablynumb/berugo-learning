/** Worked examples for the adders and the ALU (M33.4-M33.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'arithmetic-circuits': [
      {
        title: 'Three adders, three cost curves, and the width where each stops making sense',
        goal: 'Measure the same function built three ways as the word doubles.',
        setup: 'Ripple carry, carry lookahead and carry select, each built from two-input '
          + 'gates at 4, 8 and 16 bits, and each checked against integer addition — '
          + 'exhaustively at 4 bits, where 2^9 = 512 vectors is the whole space, and by a '
          + 'seeded sample above that with the count reported.',
        steps: [
          { do: 'Build all three at 4 bits and read gates and depth.',
            why: 'Small enough that the three are genuinely comparable.',
            work: 'ripple 20 gates at depth 19; lookahead 42 at 16; select 33 at 14' },
          { do: 'Build all three at 8 bits.',
            why: 'One doubling is enough to show which term is growing.',
            work: 'ripple 40 at 35; lookahead 180 at 26; select 65 at 22' },
          { do: 'Build all three at 16 bits.',
            why: 'Far enough for the quadratic term to become unaffordable.',
            work: 'ripple 80 at 67; lookahead 1 000 at 44; select 129 at 38' },
          { do: 'Drive the 8-bit ripple adder from 0 to all-ones-plus-one and measure settling.',
            why: 'The worst case for a carry chain, measured rather than assumed.',
            work: 'settles after 32 gate delays; the structural critical path is 35' }
        ],
        answer: 'Doubling the width doubles the ripple depth — 19, 35, 67 — and adds a constant '
          + 'to the lookahead depth: 16, 26, 44. The gate columns move the other way, and '
          + 'violently: lookahead is 2.1 times the ripple adder at 4 bits and 12.5 times at 16, '
          + 'because expanding the carry recurrence for every bit costs a number of terms that '
          + 'grows with the square of the width. That is why no real 64-bit adder is either of '
          + 'these: production designs build lookahead in four-bit blocks and ripple between '
          + 'them, or use a prefix tree that is logarithmic in depth with a regular layout. '
          + 'Carry select is the honest middle — 129 gates at depth 38 where lookahead needs '
          + '1 000 for depth 44 — and it gets there by duplication rather than by fan-in, which '
          + 'is often the practical answer.'
      },
      {
        title: 'Why multiply is not one gate delay',
        goal: 'Price multiplication against addition at the same width, and verify both exactly.',
        setup: 'An array multiplier — one AND gate per pair of operand bits for the partial '
          + 'products, then an array of adders to sum them — at 2, 3 and 4 bits, beside a '
          + 'ripple adder of the same width. Every possible product is checked against integer '
          + 'multiplication.',
        steps: [
          { do: 'Build the 2-bit multiplier and check every product.',
            why: 'Four partial-product bits: small enough to check by eye as well as by code.',
            work: '14 gates at depth 13, exact on all 16 products' },
          { do: 'Build the 3-bit multiplier.',
            why: 'Nine partial products, so the array has started to grow.',
            work: '39 gates at depth 27, exact on all 64 products' },
          { do: 'Build the 4-bit multiplier.',
            why: 'Sixteen partial products, and the shape is now clear.',
            work: '76 gates at depth 41, exact on all 256 products' },
          { do: 'Compare each against a ripple adder of the same width.',
            why: 'The comparison the instruction latency table is really making.',
            work: 'at 4 bits: 3.8 times the gates and 2.16 times the depth of the adder' }
        ],
        answer: 'Gates grow with the square of the width and depth grows linearly, and no '
          + 'identity removes either. The partial products themselves are free — one AND gate '
          + 'each, all available after one gate delay — so the entire cost is adding them up, '
          + 'which is why the interesting multiplier designs are all about reducing that array '
          + 'faster: carry-save adders, Wallace and Dadda trees, Booth recoding to halve the '
          + 'number of rows. This is the whole answer to "why is multiply three cycles when add '
          + 'is one", and it is also why a compiler rewrites a multiply by a constant into '
          + 'shifts and adds. Division is worse still and for a different reason: its '
          + 'recurrence is not associative, so no tree flattens it, which is why constant '
          + 'division is turned into a multiply by a reciprocal and variable division is simply '
          + 'slow.'
      }
    ],
    'arithmetic-logic-unit': [
      {
        title: 'Four operations for the price of one adder',
        goal: 'Measure what the operations and the flags cost on top of the arithmetic.',
        setup: 'An 8-bit ALU with four operations — add, subtract, AND, XOR — and four flags, '
          + 'built from the ripple adder of the previous section plus a multiplexer per bit. '
          + 'The gate count is broken down by part, and every part is measured from the same '
          + 'netlist.',
        steps: [
          { do: 'Build the whole 8-bit ALU and measure it.',
            why: 'The total everything else is a share of.',
            work: '92 gates, 838 transistors, critical path 47 gate delays' },
          { do: 'Build the bare 8-bit ripple adder for comparison.',
            why: 'The expensive structure the other operations are sharing.',
            work: '40 gates at depth 35 — 43% of the ALU\'s gates' },
          { do: 'Account for the rest by part.',
            why: 'So the multiplexer cost of the operation code is explicit.',
            work: 'inversion 8, logic paths 16, result muxes 16, flags 12 — 92 in total' },
          { do: 'Subtract the adder from the ALU.',
            why: 'This difference is the price of three more operations and four flags.',
            work: '52 extra gates and 12 extra gate delays' }
        ],
        answer: 'Three extra operations and four flags cost 52 gates and 12 gate delays on top '
          + 'of an adder that costs 40 gates and 35 delays. The reason it is that cheap is that '
          + 'only one structure in the block has a chain in it: AND and XOR are one gate per '
          + 'bit and finish long before the carry reaches the top of the word, so they are free '
          + 'in time and nearly free in area. What is not free is the selection — 16 gates and '
          + '2 gate delays of multiplexing that sit in front of every result bit and are paid '
          + 'on every instruction, including the ones that only add. That is why an ALU has '
          + 'four operations rather than sixteen, and why complex operations live in separate '
          + 'functional units with their own latencies.'
      },
      {
        title: 'One addition, two verdicts: carry against overflow',
        goal: 'Show that the same bits carry two different answers to "did that fit".',
        setup: 'The 8-bit ALU, driven on five cases chosen because they are where the signed '
          + 'and unsigned readings part company. Every case is checked against a reference '
          + 'written from the definitions of the operations and the flags, not from the '
          + 'circuit.',
        steps: [
          { do: 'Compute 255 + 1.',
            why: 'The unsigned result needs a ninth bit; the signed result does not.',
            work: 'result 0, flags zero and carry — as signed values this is −1 + 1 = 0' },
          { do: 'Compute 127 + 1.',
            why: 'The signed result does not fit; the unsigned one does.',
            work: 'result 128, flags negative and overflow — carry is clear' },
          { do: 'Compute 0 − 1.',
            why: 'A borrow, on a convention that surprises people.',
            work: 'result 255, flag negative only — the carry flag is CLEAR after a borrow' },
          { do: 'Compute 0 − 128.',
            why: 'Negating the most negative value in the word.',
            work: 'result 128, flags negative and overflow — there is no positive counterpart' },
          { do: 'Check every case at 4 bits against the reference, exhaustively.',
            why: 'Ten inputs is a space small enough to walk completely.',
            work: 'all 1 024 combinations of operands and operation agree, flag for flag' }
        ],
        answer: 'The circuit does not know whether your numbers are signed, so it computes both '
          + 'answers and lets the branch instruction choose. 255 + 1 sets carry and not '
          + 'overflow; 127 + 1 sets overflow and not carry; both are correct, and which one is '
          + 'an error depends entirely on a type the hardware never saw. That gap is where a '
          + 'large share of integer bugs live, and it explains the language rules people find '
          + 'arbitrary: C defines unsigned wraparound because the hardware defines it, and '
          + 'leaves signed overflow undefined because checking it costs an instruction the '
          + 'standard did not want to mandate. The borrow row is the practical trap — after a '
          + 'subtract, a CLEAR carry means a borrow happened on this convention, which is why '
          + 'the same flag is called borrow on some architectures and inverted on others.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
