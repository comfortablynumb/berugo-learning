/** Reference entries for the adders and the ALU (M33.4-M33.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'arithmetic-circuits': {
      summary: 'Ripple-carry, carry-lookahead and carry-select adders and an array multiplier, '
        + 'all built from two-input gates, measured in gates, transistors and critical-path '
        + 'depth at 4, 8 and 16 bits, and checked against integer arithmetic — exhaustively '
        + 'where the input space allows and by a seeded sample with a stated count where it '
        + 'does not.',
      intuition: 'Addition is a prefix scan: the carry recurrence is associative, so it can be '
        + 'a tree instead of a chain, and every fast adder is a different way of spending gates '
        + 'to shorten that chain.',
      formulation: {
        equations: [
          {
            label: 'Three adders as the word doubles',
            expr: 'width · ripple gates/depth · lookahead · select',
            terms: [
              { sym: '4 bits', meaning: '20 / 19 · 42 / 16 · 33 / 14' },
              { sym: '8 bits', meaning: '40 / 35 · 180 / 26 · 65 / 22' },
              { sym: '16 bits', meaning: '80 / 67 · 1 000 / 44 · 129 / 38' }
            ]
          },
          {
            label: 'The carry recurrence',
            expr: 'c_(i+1) = g_i or (p_i and c_i), with g_i = a_i and b_i, p_i = a_i xor b_i',
            readAs: 'the carry out of a bit is generate, or propagate combined with the carry in',
            terms: [
              { sym: 'g_i', meaning: 'generate: both operand bits are 1' },
              { sym: 'p_i', meaning: 'propagate: exactly one operand bit is 1' },
              { sym: 'associativity', meaning: 'is what allows a log-depth tree instead of a linear chain' }
            ]
          },
          {
            label: 'The array multiplier, checked exactly',
            expr: 'width · partial products · gates · depth · products checked',
            terms: [
              { sym: '2 bits', meaning: '4 · 14 · 13 · 16' },
              { sym: '3 bits', meaning: '9 · 39 · 27 · 64' },
              { sym: '4 bits', meaning: '16 · 76 · 41 · 256 — 3.8 times the adder\'s gates' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every adder is checked against integer addition, not against another adder',
          why: 'Two circuits with the same bug agree perfectly.',
          breaks: 'The oracle adds JavaScript numbers; the netlist ripples carries through gates.'
        },
        {
          name: 'A sampled check reports its seed and its denominator',
          why: '"Sampled 400 of 131 072, seeded" is checkable; "well tested" is not.',
          breaks: 'At 4 bits the check is exhaustive over all 512 vectors and says so instead.'
        },
        {
          name: 'The critical path is structural and the settling time is measured',
          why: 'A ripple adder\'s delay depends on the data; the clock cannot ask what the data is.',
          breaks: 'The demo reports both: 35 gate delays of path, 32 measured on the worst transition.'
        }
      ],
      complexity: [
        { operation: 'ripple carry', average: 'gates proportional to the width, depth proportional to it too', worst: 'the same; the worst case is a full carry chain' },
        { operation: 'carry lookahead', average: 'depth grows slowly, gates grow with the square of the width', worst: 'unaffordable past a small block, which is why real designs are hybrid' },
        { operation: 'carry select', average: 'about 1.5 times the ripple gates for about half its depth', worst: 'the same; the duplication is structural' },
        { operation: 'array multiplier', average: 'gates with the square of the width, depth linearly', worst: 'the same; Wallace trees reduce the depth to logarithmic' },
        { operation: 'division', average: 'a non-associative recurrence: one step per bit', worst: 'no tree flattens it, which is why it is the slowest instruction' }
      ],
      failureModes: [
        {
          symptom: 'A 64-bit lookahead adder is enormous and still not fast enough.',
          cause: 'The term count grows with the square of the width, and fan-in limits turn each term into a tree.',
          fix: 'Build lookahead in four-bit blocks and ripple between them, or use a Kogge-Stone prefix tree.'
        },
        {
          symptom: 'A design meets timing in simulation and fails on one operand pair.',
          cause: 'Simulation exercised typical data; the carry chain\'s worst case is all-ones plus one.',
          fix: 'Use static timing analysis, which covers every input pattern structurally.'
        },
        {
          symptom: 'Subtraction produces a wrong answer at the boundary of the word.',
          cause: 'The carry in was not forced when inverting the operand, so it computed a + not b.',
          fix: 'Tie the invert control and the carry in to the same signal — the demo\'s ALU does exactly that.'
        },
        {
          symptom: 'A multiply-heavy loop is far slower than an add-heavy one at the same instruction count.',
          cause: 'The multiplier is a quadratic array with linear depth; the adder is a log-depth prefix network.',
          fix: 'Strength-reduce constants to shifts and adds, and expect no such rewrite for variable divisors.'
        }
      ],
      inTheWild: [
        'Kogge-Stone and Brent-Kung prefix adders, the log-depth structures in every modern datapath.',
        'Booth recoding and Wallace trees, which halve the partial-product rows and reduce them in log depth.',
        'Compiler strength reduction: x * 10 becoming shifts and adds, x / 10 becoming a reciprocal multiply.',
        'The instruction latency tables in optimisation manuals, which are these depths measured in cycles.'
      ],
      sources: [
        { title: 'Kogge and Stone — A parallel algorithm for the efficient solution of a general class of recurrence equations (1973)', note: 'addition as a prefix scan' },
        { title: 'Brent and Kung — A regular layout for parallel adders (1982)', note: 'the layout-aware answer to the same problem' },
        { title: 'Ercegovac and Lang — Digital Arithmetic', note: 'the standard reference for adders, multipliers and dividers' },
        { title: 'Warren — Hacker\'s Delight', note: 'the software side: division by constants, and why it is a multiply' }
      ]
    },
    'arithmetic-logic-unit': {
      summary: 'An n-bit ALU with four operations and four flags, built from a ripple adder '
        + 'plus per-bit multiplexing, with the operation code doubling as the invert control '
        + 'and the carry in; checked exhaustively at 4 bits over all 1 024 operand-and-operation '
        + 'combinations against a reference written from the definitions, and by seeded sample '
        + 'above that.',
      intuition: 'Build the expensive structure once and select among the cheap paths beside '
        + 'it; the flags are the hardware admitting it does not know whether your numbers are '
        + 'signed.',
      formulation: {
        equations: [
          {
            label: 'Where the 8-bit ALU\'s 92 gates go',
            expr: 'part · gates · depth · share',
            terms: [
              { sym: 'the ripple adder', meaning: '40 gates, depth 35 — 43%' },
              { sym: 'operand inversion', meaning: '8 gates, depth 1 — 9%' },
              { sym: 'the AND and XOR paths', meaning: '16 gates, depth 1 — 17%' },
              { sym: 'result multiplexing', meaning: '16 gates, depth 2 — 17%' },
              { sym: 'the four flags', meaning: '12 gates — 13%, and the zero tree is the deepest' }
            ]
          },
          {
            label: 'The flags, defined',
            expr: 'flag · when it is set',
            terms: [
              { sym: 'zero', meaning: 'every result bit is 0 — a NOR tree over the word' },
              { sym: 'negative', meaning: 'the top result bit is 1 — a wire' },
              { sym: 'carry', meaning: 'carry out of the top bit: the unsigned answer did not fit' },
              { sym: 'overflow', meaning: 'carry into the top bit differs from carry out of it' }
            ]
          },
          {
            label: 'Corner cases at 8 bits',
            expr: 'case · result · flags',
            terms: [
              { sym: '255 + 1', meaning: '0 · zero, carry — signed this is −1 + 1 = 0' },
              { sym: '127 + 1', meaning: '128 · negative, overflow — unsigned it is correct' },
              { sym: '0 − 1', meaning: '255 · negative; carry CLEAR means a borrow occurred' },
              { sym: '0 − 128', meaning: '128 · negative, overflow — no positive counterpart exists' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Carry and overflow are forced low for the logic operations',
          why: 'The adder is still running; its carry has nothing to do with an AND.',
          breaks: 'A stale flag is worse than a wrong one, because it is right most of the time.'
        },
        {
          name: 'Subtraction uses the same adder, with op0 as both invert and carry in',
          why: 'a − b is a + not b + 1, so no subtractor exists in the datapath.',
          breaks: 'The demo measures the cost as one XOR per bit and nothing else.'
        },
        {
          name: 'The reference is written from the definitions of the flags',
          why: 'Deriving the oracle from the circuit makes agreement meaningless.',
          breaks: 'Overflow in the model is "same-signed operands, differently-signed result", not an XOR of carries.'
        }
      ],
      complexity: [
        { operation: 'the ALU as a whole', average: 'the adder\'s depth plus the result multiplexer', worst: 'the same; the operation select is always paid' },
        { operation: 'adding an operation', average: 'one more input on the per-bit result mux', worst: 'another level of mux depth in front of every result bit' },
        { operation: 'the zero flag', average: 'a log-depth tree over the word, after the result', worst: 'the same, and it is why compare-and-branch can cost a cycle more' },
        { operation: 'flag renaming in an out-of-order core', average: 'one more architectural register to rename', worst: 'a serialising dependency between every arithmetic instruction and the next branch' }
      ],
      failureModes: [
        {
          symptom: 'A signed comparison behaves correctly until the operands straddle the sign boundary.',
          cause: 'The branch read the carry flag, which answers the unsigned question.',
          fix: 'Use the overflow-aware condition; the two flags answer different questions about the same bits.'
        },
        {
          symptom: 'A loop with a signed induction variable is optimised in a way that surprises you.',
          cause: 'Signed overflow is undefined in C, so the compiler assumes it cannot happen.',
          fix: 'Use unsigned types where wraparound is intended, and explicit checks where it is not.'
        },
        {
          symptom: 'A subtract leaves the carry flag set and the code treats that as an error.',
          cause: 'On this convention a CLEAR carry after a subtract means a borrow occurred.',
          fix: 'Read the architecture\'s definition; some machines invert this flag and call it borrow.'
        },
        {
          symptom: 'Adding two ALU operations slows the whole processor down.',
          cause: 'Every operation is another input on a multiplexer in front of every result bit.',
          fix: 'Put rare or complex operations in a separate functional unit with its own latency.'
        }
      ],
      inTheWild: [
        'x86 and ARM condition codes, and the flag renaming an out-of-order core must do because of them.',
        'RISC-V, which has no flags at all: comparisons write a general register instead.',
        'The compare instruction, which on almost every architecture is a subtract with the result discarded.',
        'Undefined signed overflow in C and C++, which exists because checking it costs an instruction.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design', note: 'the canonical ALU build-up this section follows' },
        { title: 'Intel and ARM architecture reference manuals, the condition-code chapters', note: 'where the flag definitions are normative' },
        { title: 'Warren — Hacker\'s Delight', note: 'overflow detection without a flag, and other two\'s-complement identities' },
        { title: 'Regehr — A Guide to Undefined Behavior in C and C++', note: 'why the language left signed overflow undefined' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
