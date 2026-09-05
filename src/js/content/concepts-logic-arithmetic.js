/** Concepts for the adders and the ALU (M33.4-M33.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'arithmetic-circuits': [
      {
        term: 'A full adder is three in, two out, and addition is a chain of them',
        plain: 'Sum is the exclusive-or of all three inputs; carry is the majority of them.',
        formal: 'sum = a xor b xor cin; carry = (a and b) or (cin and (a xor b))',
        detail: [
          'Nothing new is needed to add. Both of those functions were built in the first section '
            + 'of this milestone.',
          'What is needed is a lot of them, arranged so that the carry reaches the top of the '
            + 'word in time.',
          'That is the whole subject: the function is trivial and the timing is not.',
          'Every adder on this page computes exactly the same thing, and differs only in how the '
            + 'carry gets from bit zero to bit sixty-three.'
        ],
        example: 'Majority of three, the carry function, is 5 gates at depth 6 when built from '
          + 'two-input gates.'
      },
      {
        term: 'Ripple carry is correct, and its delay is linear in the width',
        plain: 'Bit i cannot finish until bit i-1 has decided its carry.',
        formal: 'delay is proportional to n, the number of bits',
        readAs: 'the delay of the adder grows in direct proportion to the number of bits in the word.',
        detail: [
          'This is fine at four bits and unusable at sixty-four, and it is the reason every real '
            + 'datapath contains something else.',
          'What makes it worth building anyway is that it is the baseline every other adder is '
            + 'measured against.',
          'Its worst case is also data-dependent in a way the others are not.',
          'Given operands that generate no carries it settles almost immediately, and given '
            + 'all-ones plus one it takes the entire chain.'
        ],
        example: 'At 4, 8 and 16 bits the ripple adder is 20, 40 and 80 gates at depths 19, 35 '
          + 'and 67 — the depth doubling with the width.'
      },
      {
        term: 'Generate and propagate turn the carry chain into a prefix scan',
        diagram: {
          definition: [
            'flowchart LR',
            '    A(["a_i"]) --> G["g = a AND b<br/>generates a carry"]',
            '    B(["b_i"]) --> G',
            '    A --> P["p = a XOR b<br/>propagates one"]',
            '    B --> P',
            '    G --> C["c_(i+1) = g OR (p AND c_i)"]',
            '    P --> C',
            '    CI(["c_i"]) --> C',
            '    C -->|"ripple: a chain of these"| CH["depth grows with n"]',
            '    C -.->|"the recurrence is associative"| TR["so it can be a tree:<br/>depth grows with log n"]'
          ].join('\n'),
          caption: 'Generate and propagate depend only on the operands, so every bit computes '
            + 'them at once. The carry recurrence over them is associative, which is exactly '
            + 'the condition for evaluating it as a balanced tree instead of a chain.'
        },
        plain: 'A bit generates a carry when both operands are 1 and passes one on when exactly one is.',
        formal: 'c_(i+1) = g_i or (p_i and c_i), where g_i = a_i and b_i, p_i = a_i xor b_i',
        readAs: 'the carry out of a position is generate, or else propagate combined with the carry in.',
        detail: [
          'The recurrence is associative, and any associative recurrence can be evaluated as a '
            + 'balanced tree in logarithmic depth rather than as a chain in linear depth.',
          'That is the same parallel prefix scan the algorithms track spends a section on, and it '
            + 'is why a 64-bit add fits in one cycle.',
          'Recognising an associative recurrence is the single most valuable pattern-match in '
            + 'this milestone.',
          'It is what separates the operations that parallelise from the ones that do not.'
        ],
        example: 'Adding 255 and 1 at 8 bits: one position generates and seven propagate, which '
          + 'is the worst case for a ripple adder and the reason its settling time is 32.'
      },
      {
        term: 'Carry lookahead buys depth with gates, quadratically',
        plain: 'Expand the recurrence so every carry is a two-level expression over g and p.',
        formal: 'c_2 = g_1 or (p_1 and g_0) or (p_1 and p_0 and c_0), and so on for every bit',
        detail: [
          'Each carry becomes constant depth over signals that are all available at once, and the '
            + 'number of terms grows with the square of the width.',
          'That is why no real adder does this across a whole word.',
          'Production designs build lookahead in four-bit blocks and ripple between the blocks, '
            + 'or use a Kogge–Stone prefix tree which is logarithmic depth with a regular layout.',
          'The demo shows the quadratic term becoming unaffordable in three steps.'
        ],
        example: 'Lookahead at 4, 8 and 16 bits is 42, 180 and 1 000 gates against the ripple '
          + 'adder\'s 20, 40 and 80 — for depths of 16, 26 and 44.'
      },
      {
        term: 'Carry select buys speed with duplication instead of fan-in',
        plain: 'Compute the top half twice, for both possible carries, and choose when the truth arrives.',
        formal: 'delay is the lower half plus one multiplexer',
        detail: [
          'It is a different point on the same line, and often the practical one. Duplicating a '
            + 'small ripple adder is cheap and regular, where a wide lookahead term is neither.',
          'The idea generalises. Speculate on the value you are waiting for, compute both answers '
            + 'in parallel, and select when the answer arrives.',
          'That is branch prediction, prefetching and eager evaluation in one sentence.',
          'Its cost is always the wasted half.'
        ],
        example: 'At 16 bits carry select is 129 gates at depth 38, against 80 at depth 67 for '
          + 'ripple and 1 000 at depth 44 for lookahead.'
      },
      {
        term: 'Subtraction is addition, and that is what two\'s complement buys',
        plain: 'Invert the second operand, force the carry in, and the adder computes a minus b.',
        formal: 'a - b = a + (not b) + 1',
        readAs: 'a minus b equals a plus the bitwise complement of b plus one, using the same adder.',
        detail: [
          'There is no subtractor in a datapath.',
          'The sign bit needs no special case, comparison is subtraction with the result '
            + 'discarded, and negation is inversion plus one.',
          'That is why the two\'s-complement range is asymmetric, and why the most negative '
            + 'number has no positive counterpart.',
          'Every one of those facts is a consequence of the representation rather than of the '
            + 'circuit, which is the argument for choosing a representation carefully.'
        ],
        example: 'The ALU section measures 0 minus 128 at 8 bits as 128 with overflow set, '
          + 'because negating the most negative value is not representable.'
      },
      {
        term: 'Multiplication is quadratic in gates and linear in depth',
        plain: 'One AND per pair of bits, then an array of adders to sum the partial products.',
        formal: 'n^2 partial product bits, reduced by n-1 additions',
        readAs: 'the number of partial-product bits is the square of the width of the two operands.',
        detail: [
          'The partial products all appear in one gate delay; the cost is entirely in adding them '
            + 'up.',
          'That is why multiply is three or four cycles where add is one, and why compilers turn '
            + 'a multiply by a constant into shifts and adds.',
          'It is also why Wallace and Dadda trees exist. They reduce the array in logarithmic '
            + 'depth using carry-save adders instead of rippling.',
          'Division is worse still, because its recurrence is not associative and no tree '
            + 'flattens it.'
        ],
        example: 'Array multipliers at 2, 3 and 4 bits are 14, 39 and 76 gates at depths 13, 27 '
          + 'and 41, each verified against every possible product.'
      },
      {
        term: 'Depth is the worst case; settling time is this data',
        plain: 'The clock must assume the worst path because it cannot ask what the operands are.',
        formal: 'critical path = max over all inputs; settling time = the measurement for one transition',
        detail: [
          'A ripple adder given operands with no carries settles in a couple of gate delays.',
          'The same adder given all-ones plus one takes the full chain.',
          'Timing analysis has to budget for the second, which means most cycles waste most of '
            + 'their period.',
          'That gap between typical and worst is why asynchronous and variable-latency designs '
            + 'keep being proposed, and why they keep losing to the simplicity of a fixed clock.'
        ],
        example: 'The 8-bit ripple adder has a critical path of 35 gate delays and settles in '
          + '32 on the worst-case transition the demo drives.'
      }
    ],
    'arithmetic-logic-unit': [
      {
        term: 'An ALU is one adder plus a multiplexer, and the sharing is the design',
        plain: 'Build the expensive structure once and select among cheap paths beside it.',
        formal: 'result = mux(op1, adder_output, mux(op0, and_output, xor_output))',
        detail: 'The wide, slow, expensive structure is the carry chain. AND and XOR are one '
          + 'gate per bit with no chain at all, so adding them costs almost nothing next to the '
          + 'adder they sit beside. The pattern — one expensive shared unit, several cheap '
          + 'paths, a multiplexer to choose — recurs in a floating-point unit sharing a '
          + 'multiplier between multiply and fused multiply-add, and in any well-factored piece '
          + 'of software with one hot path and several thin wrappers.',
        example: 'An 8-bit ALU is 92 gates at depth 47; the ripple adder inside it is 40 gates '
          + 'at depth 35, so three more operations and four flags cost 52 gates and 12 delays.'
      },
      {
        term: 'The operation code configures the datapath, not just the output select',
        plain: 'The low bit inverts the second operand and supplies the carry in.',
        formal: 'operand = b xor op0; carry in = op0; so op0 = 1 computes a - b',
        detail: 'This is the neatest trick in a simple ALU and it is worth seeing once: the '
          + 'same wire that selects "subtract" also reconfigures the adder to perform it, '
          + 'because inverting b and adding one is negation. Nothing is spent on decoding, and '
          + 'the subtract path costs one XOR per bit. The general lesson is that encoding a '
          + 'control signal well can remove the logic that would otherwise interpret it.',
        example: 'Subtract at 8 bits costs 8 XOR gates — one per bit — on top of the adder.'
      },
      {
        term: 'Carry and overflow are the same event read as unsigned and as signed',
        diagram: {
          definition: [
            'flowchart TD',
            '    ADD["a + b in n bits"] --> C{"did it need bit n?"}',
            '    C -->|"yes"| CF["carry = 1<br/>the UNSIGNED answer did not fit"]',
            '    ADD --> V{"same-signed operands,<br/>differently-signed result?"}',
            '    V -->|"yes"| OF["overflow = 1<br/>the SIGNED answer did not fit"]',
            '    CF -.->|"255 + 1 at 8 bits"| E1["carry set, overflow clear<br/>as signed: -1 + 1 = 0, correct"]',
            '    OF -.->|"127 + 1 at 8 bits"| E2["overflow set, carry clear<br/>as unsigned: 128, correct"]'
          ].join('\n'),
          caption: 'One addition, two verdicts. The hardware does not know which reading you '
            + 'meant, so it computes both and lets the branch instruction choose.'
        },
        plain: 'Carry means the unsigned result did not fit; overflow means the signed one did not.',
        formal: 'carry = carry out of the top bit; overflow = carry into the top bit xor carry out of it',
        readAs: 'overflow is set when the carry entering the sign bit differs from the carry leaving it.',
        detail: 'The same addition can set one flag, the other, both or neither, and which one '
          + 'your program should read depends on a type the hardware never saw. That gap is '
          + 'where a large share of integer bugs live: C defines unsigned wraparound and leaves '
          + 'signed overflow undefined, so the compiler may assume it cannot happen, and mixing '
          + 'the two readings in one expression produces a bug that only appears at the '
          + 'boundary.',
        example: '255 + 1 at 8 bits sets carry and zero; 127 + 1 sets overflow and negative. '
          + 'Neither is an error — they are answers to different questions.'
      },
      {
        term: 'Zero is a wide NOR, and it runs after everything else',
        plain: 'Deciding every result bit is 0 needs a tree over the whole word.',
        formal: 'zero = not (r_0 or r_1 or ... or r_(n-1))',
        readAs: 'the zero flag is the negation of the or taken over every bit of the result word.',
        detail: 'The tree cannot start until the result is final, so the zero flag is later '
          + 'than the result it describes. That is why a compare-and-branch is sometimes a '
          + 'cycle longer than an arithmetic instruction, and why some architectures make the '
          + 'branch read the operands directly rather than a flag. It is also a reminder that a '
          + 'reduction over a word is not free: the same log-depth tree appears in a population '
          + 'count, a parity check and a match line.',
        example: 'The flag logic in the 8-bit ALU is 12 gates of the 92, and the zero tree is '
          + 'the deepest part of it.'
      },
      {
        term: 'Flags for the logic operations are forced, not inherited',
        plain: 'The adder still runs during an AND; its carry is meaningless, so it is driven low.',
        formal: 'carry_out = adder_carry and (not op1); the same for overflow',
        detail: 'The adder is not switched off — there is no such thing — its output is simply '
          + 'not selected, so whatever it computed is still sitting on a wire. Letting that '
          + 'reach the carry flag would produce a flag that is stale rather than wrong, which is '
          + 'worse: a wrong value is a bug you can find, and a stale one is a value that '
          + 'happens to be right most of the time. Two AND gates buy the difference.',
        example: 'AND and XOR on the demo\'s operands both report carry and overflow clear, '
          + 'whatever the adder alongside them computed.'
      },
      {
        term: 'Condition codes are shared mutable state, with the costs that implies',
        plain: 'Every arithmetic instruction writes them and the next branch reads them.',
        formal: 'an implicit destination register written by most instructions',
        detail: 'An out-of-order machine must rename the flag register exactly as it renames '
          + 'general registers, and a branch depends on whichever instruction wrote them last — '
          + 'a dependency that is invisible in the source. That is why some architectures '
          + 'dropped flags entirely and made comparison an instruction that writes a general '
          + 'register: it turns an implicit global into an explicit value, which is the same '
          + 'refactor a program does when it replaces a module-level variable with a parameter.',
        example: 'The demo\'s instruction-set table connects each flag to the branch that reads '
          + 'it and the bug that misreading it causes.'
      },
      {
        term: 'Every extra operation is another input on a multiplexer in the critical path',
        plain: 'The result mux sits in front of every result bit.',
        formal: 'k operations need a k:1 select per bit, of depth log2(k)',
        readAs: 'selecting among k operations costs about log-two-of-k gate delays in front of every bit.',
        detail: 'An ALU with sixteen operations pays for them in depth even when the program '
          + 'only ever adds, which is why complex operations live in separate functional units '
          + 'with their own latency rather than being folded into the ALU. The general shape is '
          + 'familiar from software: a hot function with a large switch pays the dispatch cost '
          + 'on every call, and splitting the rare cases out makes the common path shorter.',
        example: 'Result multiplexing in the 8-bit ALU is 16 gates — two 2:1 multiplexers per '
          + 'bit — and 2 of the 47 gate delays.'
      },
      {
        term: 'A block this size can be verified exhaustively, and it should be',
        plain: 'Ten inputs is 1 024 combinations of operands and operation.',
        formal: 'a 4-bit ALU has 2^4 x 2^4 x 4 = 1024 cases',
        readAs: 'sixteen values of a, sixteen of b and four operations, which is one thousand and twenty-four cases.',
        detail: 'The reference is written from the definitions of the operations and the flags '
          + 'rather than from the circuit, which is what makes agreement mean something. At '
          + 'eight bits the space is 262 144 and the demo samples it with a fixed seed and '
          + 'reports the count — which is the honest form of the same claim. "Sampled 300 of '
          + '262 144, seeded, reproducible" is checkable; "well tested" is not.',
        example: 'The 4-bit ALU matches the reference on all 1 024 cases; the 8-bit version is '
          + 'sampled 300 times with a stated seed.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
