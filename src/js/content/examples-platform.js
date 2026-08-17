/**
 * Worked examples for the platform sections.
 *
 * Every figure stated in a `result` is recomputed independently by
 * tests/unit/worked-examples.test.js, so editing a setup without editing the
 * arithmetic fails the build.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'code-engine': [
      {
        title: 'Predict whether a run fits the budget, before running it',
        goal: 'Turn "it feels slow" into an arithmetic prediction the harness can check.',
        setup: 'hasDuplicate over n = 20 000 distinct values, quadratic version, 1.2 s budget. ' +
          'Assume a comparison costs about 2 ns in a warm loop.',
        steps: [
          {
            do: 'Count the comparisons the quadratic version performs.',
            why: 'The inner loop runs over every later element, so the count is a triangular number.',
            work: 'comparisons = n(n − 1)/2\n' +
              '            = 20000 × 19999 / 2\n' +
              '            = 199,990,000',
            result: 'About 2.0 × 10⁸ comparisons.'
          },
          {
            do: 'Convert to time at 2 ns per comparison.',
            why: 'A rough per-operation cost is enough to decide whether the budget is even close.',
            work: '199,990,000 × 2 ns = 399,980,000 ns\n' +
              '                     ≈ 0.400 s',
            result: 'About 0.40 s if every comparison really costs 2 ns.'
          },
          {
            do: 'Compare against the observed behaviour.',
            why: 'The prediction says "close to the budget", and the run times out - so the constant ' +
              'is larger than 2 ns here.',
            work: 'budget           = 1.2 s\n' +
              'predicted        ≈ 0.40 s\n' +
              'observed         > 1.2 s (terminated)\n' +
              '⇒ effective cost > 6 ns per comparison',
            result: 'The model was optimistic by roughly 3×, which is normal for array reads in a browser.'
          },
          {
            do: 'Compute the linear version instead.',
            why: 'A Set turns the inner scan into one hash operation per element.',
            work: 'operations = n = 20,000\n' +
              'ratio      = 199,990,000 / 20,000 ≈ 10,000×',
            result: 'Four orders of magnitude fewer operations - not a constant-factor fix.'
          }
        ],
        answer: 'The quadratic version needs ~2.0 × 10⁸ comparisons against a 1.2 s budget and is ' +
          'terminated; the linear version needs 2.0 × 10⁴ operations, about 10 000× fewer.'
      },
      {
        title: 'Size a step budget so it separates the two algorithms',
        goal: 'Pick an opsLimit that accepts every reasonable binary search and rejects a linear scan.',
        setup: 'A search lab graded on ops.cmp. The array is sorted, and the grader may hand the ' +
          'learner anything from 1 024 to 65 536 elements; the worked figures use 4 096.',
        steps: [
          {
            do: 'Count binary search across the whole range the lab offers.',
            why: 'Each comparison halves the interval, so the count is a logarithm and barely moves ' +
              'with n.',
            work: 'n = 1,024:  ⌈log₂ 1024⌉ + 1  = 10 + 1 = 11 comparisons\n' +
              'n = 4,096:  ⌈log₂ 4096⌉ + 1  = 12 + 1 = 13\n' +
              'n = 65,536: ⌈log₂ 65536⌉ + 1 = 16 + 1 = 17',
            result: '64× more data costs 6 more comparisons.'
          },
          {
            do: 'Count the linear scan on the same array.',
            why: 'It inspects elements until it meets the key, so the count is the position of the key.',
            work: 'worst case  = n = 4,096\n' +
              'average hit = (n + 1)/2 = 2,048.5\n' +
              'ratio to binary at n = 4,096: 4096 / 13 = 315×',
            result: 'Two counts on the same input, 315× apart.'
          },
          {
            do: 'Put the budget between them, with headroom.',
            why: 'A budget that only just fits one correct implementation fails another that is also ' +
              'correct.',
            work: 'opsLimit = 20\n' +
              'binary at 65,536: 17 of 20 used, 3 spare\n' +
              'linear at 4,096:  stops after 20 of 4,096 elements = 0.49% of the array',
            result: 'One constant covers every size the lab can generate.'
          },
          {
            do: 'Price the implementation style the budget is quietly assuming.',
            why: 'A three-way binary search that compares twice per step is correct and costs twice ' +
              'as much.',
            work: 'two comparisons per halving: 2 × 16 + 1 = 33 at n = 65,536\n' +
              '33 > 20 ⇒ rejected by the budget above\n' +
              'raising the budget to 33 still leaves 4096 / 33 = 124× against the linear scan',
            result: 'The budget encodes a style; 33 keeps the separation and stops arguing about it.'
          },
          {
            do: 'Note what the step budget cannot see at all.',
            why: 'It counts calls to instrumented primitives, so uninstrumented work is invisible to it.',
            work: 'while (true) {} calls ops.cmp 0 times\n' +
              '⇒ the step budget never fires\n' +
              '⇒ the 1.2 s wall clock terminates the worker instead\n' +
              'at ~2 ns per iteration that is ≈ 6 × 10⁸ iterations of nothing',
            result: 'The two budgets are not redundant: one bounds work, the other bounds time.'
          }
        ],
        answer: 'Binary search costs 11 to 17 comparisons over the whole range while a linear scan ' +
          'costs up to 4 096, so a budget of 20 accepts one and stops the other after 0.49% of the ' +
          'array. Allow two comparisons per step and 33 still leaves a 124× margin — and neither ' +
          'number can stop a loop that calls no instrumented primitive, which is what the wall clock ' +
          'is for.'
      }
    ],

    'js-systems': [
      {
        title: 'Read a float64 by hand',
        goal: 'Decode an IEEE 754 double from its bytes, so the format stops being a black box.',
        setup: 'The value 1.5 stored little-endian in eight bytes: 00 00 00 00 00 00 F8 3F.',
        steps: [
          {
            do: 'Reassemble the 64 bits from the little-endian bytes.',
            why: 'The lowest-address byte is the least significant, so reading left to right reverses it.',
            work: 'bytes (low → high): 00 00 00 00 00 00 F8 3F\n' +
              'as a 64-bit word:   0x3FF8000000000000',
            result: '0x3FF8000000000000'
          },
          {
            do: 'Split the word into sign, exponent and mantissa.',
            why: 'binary64 is 1 sign bit, 11 exponent bits and 52 mantissa bits.',
            work: 'sign     = 0                       (bit 63)\n' +
              'exponent = 0x3FF = 1023              (bits 62-52)\n' +
              'mantissa = 0x8000000000000 = 2⁵¹    (bits 51-0)',
            result: 'sign 0, biased exponent 1023, mantissa 2⁵¹.'
          },
          {
            do: 'Apply the bias and the implicit leading one.',
            why: 'A normal double is (1 + m/2⁵²) × 2^(e − 1023).',
            work: 'e − 1023 = 1023 − 1023 = 0\n' +
              'm / 2⁵²  = 2⁵¹ / 2⁵² = 0.5\n' +
              'value    = (1 + 0.5) × 2⁰ = 1.5',
            result: '1.5, exactly.'
          },
          {
            do: 'Find the gap between representable neighbours here.',
            why: 'The spacing is what "precision" actually means at a given magnitude.',
            work: 'ulp = 2^(e − 1023 − 52) = 2^(−52)\n' +
              '    ≈ 2.22 × 10⁻¹⁶',
            result: 'Neighbouring doubles near 1.5 are 2⁻⁵² apart.'
          },
          {
            do: 'Repeat the spacing calculation at 2⁵³.',
            why: 'This is where integers stop being exact, which is the practical consequence.',
            work: 'at 2⁵³: e − 1023 = 53\n' +
              'ulp = 2^(53 − 52) = 2\n' +
              '⇒ 2⁵³ + 1 is not representable',
            result: 'Above 2⁵³ the representable integers step by 2, so 2⁵³ + 1 === 2⁵³.'
          }
        ],
        answer: '0x3FF8000000000000 is 1.5; the gap between doubles is 2⁻⁵² there and 2 at 2⁵³, which ' +
          'is exactly why MAX_SAFE_INTEGER is 2⁵³ − 1.'
      },
      {
        title: 'Follow 0.1 + 0.2 to the bit that decides it',
        goal: 'Explain not just that 0.1 + 0.2 ≠ 0.3, but why the answer lands above 0.3 and not below.',
        setup: 'Three doubles: 0.1 = 0x3FB999999999999A, 0.2 = 0x3FC999999999999A and the nearest ' +
          'double to 0.3, 0x3FD3333333333333.',
        steps: [
          {
            do: 'Write down what is actually stored for 0.1.',
            why: 'One tenth has no finite binary expansion, so it is rounded to 53 significant bits.',
            work: '0x3FB999999999999A\n' +
              '= 0.1000000000000000055511151231257827…\n' +
              'error = +5.551 × 10⁻¹⁸',
            result: 'The stored value is a little above one tenth, not below.'
          },
          {
            do: 'Do the same for 0.2.',
            why: 'Same mantissa, exponent one larger — so the same relative error, twice the absolute one.',
            work: '0x3FC999999999999A\n' +
              '= 0.2000000000000000111022302462515654…\n' +
              'error = +1.110 × 10⁻¹⁷ = exactly 2 × the error in 0.1',
            result: 'Both errors point the same way, so they add instead of cancelling.'
          },
          {
            do: 'Add the two stored values exactly.',
            why: 'IEEE addition forms the exact sum first and rounds once, at the end.',
            work: 'exact sum = 0.3000000000000000166533453693773481…\n' +
              'neighbours: 0x3FD3333333333333 = 0.2999999999999999888977697537484345…\n' +
              '            0x3FD3333333333334 = 0.3000000000000000444089209850062616…',
            result: 'The exact sum falls between two representable doubles.'
          },
          {
            do: 'Break the tie.',
            why: 'The sum is exactly halfway, so the rounding rule — not the arithmetic — picks the answer.',
            work: 'distance down = 2.7756 × 10⁻¹⁷\n' +
              'distance up   = 2.7756 × 10⁻¹⁷   (an exact tie)\n' +
              'round half to even: mantissa …333 is odd, …334 is even\n' +
              '⇒ 0x3FD3333333333334 = 0.30000000000000004',
            result: 'The answer is high because ties round to the even mantissa, which here is the upper one.'
          },
          {
            do: 'Size the tolerance this implies, and where it stops working.',
            why: 'The usual fix is an epsilon, and the usual epsilon is only correct near 1.',
            work: 'gap at 0.3     = 2⁻⁵⁴ = 5.551 × 10⁻¹⁷\n' +
              'Number.EPSILON = 2⁻⁵² = 2.220 × 10⁻¹⁶   (the gap just above 1)\n' +
              'gap at 10⁹     = 2⁻²³ = 1.192 × 10⁻⁷ = 5.4 × 10⁸ × EPSILON\n' +
              '⇒ compare with |a − b| ≤ ε · max(|a|, |b|)',
            result: 'An absolute epsilon calls two neighbouring doubles at 10⁹ "different".'
          }
        ],
        answer: 'The exact sum of the stored 0.1 and 0.2 lands exactly halfway between two doubles, ' +
          'and round-half-to-even takes the even mantissa above it — so the result is ' +
          '0.30000000000000004, one ulp (5.551 × 10⁻¹⁷) above the nearest double to 0.3. Any fix has ' +
          'to scale with magnitude: at 10⁹ neighbouring doubles are 1.192 × 10⁻⁷ apart, half a ' +
          'billion times Number.EPSILON.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
