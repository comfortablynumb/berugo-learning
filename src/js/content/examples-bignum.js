/** Worked examples for arbitrary precision and number theory (M17.7-M17.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'arbitrary-precision': [
      {
        title: 'Where Karatsuba wins, asked three times and answered three ways',
        goal: 'Test the claim "Karatsuba wins above eight limbs" against three cost columns, and ' +
          'find out which of them it is true of.',
        setup: 'Random operands from 64 to 4 096 bits, multiplied both ways, with limb ' +
          'multiplications, total limb work and wall-clock time measured separately.',
        steps: [
          {
            do: 'Count limb multiplications at 128 bits, which is eight limbs.',
            why: 'This is the column the folk claim is about, and the size it names.',
            work: '64 for schoolbook against 52 for Karatsuba',
            result: 'Karatsuba ahead, and the claim looks confirmed'
          },
          {
            do: 'Add the limb-level additions the recursion needed at the same size.',
            why: 'Karatsuba trades one multiplication for several additions, so the additions are part of the cost.',
            work: '64 against 106 — Karatsuba does 1.66× MORE total limb work',
            result: 'the same size, the opposite ranking'
          },
          {
            do: 'Find where total limb work actually crosses.',
            why: 'The crossing is a measurement, and it has moved by more than an order of magnitude.',
            work: '16 384 against 15 977 at 2 048 bits — the first size Karatsuba is ahead',
            result: 'a factor of sixteen higher than the multiplication crossing'
          },
          {
            do: 'Time both at every size in the sweep.',
            why: 'Neither operation count includes the four temporary arrays each recursion level allocates.',
            work: '0.1762 ms against 0.4750 ms at 4 096 bits — schoolbook still 2.7× faster',
            result: 'wall clock has not crossed anywhere in the range'
          },
          {
            do: 'Compare both against the engine’s own multiplication.',
            why: 'To size the whole exercise against what a caller would actually use.',
            work: 'BigInt does the same 4 096-bit product in 0.0565 ms',
            result: 'three times faster than the better of the two, at every size'
          }
        ],
        answer: 'The claim is true of one column and false of the other two, and the column it is ' +
          'true of is the one that flatters the algorithm. Multiplications cross at 128 bits, ' +
          'total limb work at 2 048, and wall clock nowhere in the measured range — because the ' +
          'allocations do not appear in any operation count. Karatsuba is genuinely asymptotically ' +
          'better and this implementation never reaches the size where that pays; a production ' +
          'library does, at a threshold it tunes by measuring exactly this way.'
      },
      {
        title: 'A correction that fires once in half a million, and how to test it anyway',
        goal: 'Invert the first example: instead of a cost that a measurement settles, find a ' +
          'correctness branch that no measurement over random inputs will ever reach.',
        setup: 'Knuth’s algorithm D, run over randomised operands with multi-limb divisors, with ' +
          'the add-back correction counted.',
        steps: [
          {
            do: 'Check correctness first, over 4 000 randomised divisions.',
            why: 'A cost measurement on a wrong implementation is meaningless.',
            work: '0 wrong quotients and 0 wrong remainders against BigInt',
            result: 'the implementation agrees with the oracle everywhere it was asked'
          },
          {
            do: 'Count how often the add-back correction actually fired in a targeted search.',
            why: 'A branch that never runs is untested code, however green the suite is.',
            work: '1 add-back in 500 034 quotient digits — a rate of 2.00e-6',
            result: 'once in half a million opportunities'
          },
          {
            do: 'Compare that against the textbook estimate.',
            why: 'To check the measurement against theory rather than trusting either alone.',
            work: 'Knuth’s estimate is 2 / base, which at base 65 536 is 3.05e-5',
            result: 'the measured rate is fifteen times rarer still'
          },
          {
            do: 'Work out what that means for a test suite.',
            why: 'This is the transferable part, and it is not about long division.',
            work: 'a suite of 4 000 random divisions has roughly a 1 in 40 chance of reaching the branch at all',
            result: 'an implementation that omits the correction passes, ships, and is wrong'
          },
          {
            do: 'Reach the branch deliberately instead.',
            why: 'The only defence against a rare branch is a fixture built to hit it.',
            work: 'two named operand pairs fire the correction on 100% of runs, and both produce the correct quotient',
            result: 'the branch is exercised on every test run rather than occasionally'
          }
        ],
        answer: 'The general lesson has nothing to do with division: a branch that random inputs ' +
          'reach once in half a million opportunities is, for testing purposes, unreachable — and ' +
          'the code that omits it looks identical in every report. The measured rate here is ' +
          '2.00e-6 per quotient digit against Knuth’s already tiny 3.05e-5 estimate. The fix is to ' +
          'find inputs that force the branch and keep them as named fixtures, which is why the two ' +
          'operand pairs are constants in the module rather than something a search hopes to find.'
      }
    ],

    'modular-arithmetic': [
      {
        title: 'A test that is wrong with certainty, and the one extra condition that fixes it',
        goal: 'Measure the Fermat test on the inputs it is worst on, and see exactly what ' +
          'Miller-Rabin adds.',
        setup: 'The eight smallest Carmichael numbers, tested against every base coprime to them, ' +
          'and then against Miller-Rabin.',
        steps: [
          {
            do: 'Run the Fermat test on 561 against every coprime base.',
            why: '561 = 3 × 11 × 17 is composite, so every pass is a false positive.',
            work: '319 of 319 coprime bases report "probable prime" — a rate of 100.0%',
            result: 'the error probability for this input is one, not 2⁻ᵏ'
          },
          {
            do: 'Check whether running more bases helps.',
            why: 'The probabilistic framing says it should, exponentially.',
            work: 'the other seven Carmichael numbers score 767/767, 1 295/1 295, 1 791/1 791 and so on',
            result: 'every base that can pass does pass; more rounds buy nothing'
          },
          {
            do: 'Run Miller-Rabin with the smallest base there is.',
            why: 'To see how much extra work the fix costs.',
            work: 'base 2 rejects all eight',
            result: 'one round, the cheapest possible base, and every one caught'
          },
          {
            do: 'Read the residue sequence Miller-Rabin walks for 561.',
            why: 'The extra condition is visible in the values the Fermat test throws away.',
            work: '263 → 166 → 67 → 1 across 4 squarings',
            result: 'it reaches 1 — which is all Fermat checks — without ever reaching 560'
          },
          {
            do: 'Name what that sequence proves.',
            why: 'A witness is a certificate, not a hint, and it is worth being precise about why.',
            work: '67² ≡ 1 mod 561, and 67 is neither 1 nor 560',
            result: 'a non-trivial square root of one, which a prime modulus does not have'
          }
        ],
        answer: 'The Fermat test checks only the final value of the squaring chain, and Carmichael ' +
          'numbers are exactly the composites that make that value come out right for every ' +
          'coprime base — 319 of 319 for 561. Miller-Rabin looks at the values along the way and ' +
          'rejects any chain that arrives at 1 without passing through −1, because that means ' +
          'somewhere in it is a square root of one that a prime modulus cannot have. Base 2 alone ' +
          'catches all eight, so the fix costs nothing.'
      },
      {
        title: 'Two costs governed by two different quantities',
        goal: 'Invert the first example: instead of two methods that disagree on the answer, take ' +
          'two that always agree and find why their costs diverge by a factor of two thousand.',
        setup: 'A 15-digit semiprime, factored by trial division and by Pollard’s rho, with ' +
          'operations counted for both.',
        steps: [
          {
            do: 'Factor the semiprime and note what it is made of.',
            why: 'The shape of the factorisation is what governs both costs.',
            work: '158 346 127 852 483 = 11 489 279 × 13 782 077 — two seven-digit primes',
            result: 'the smallest factor is about the square root of n'
          },
          {
            do: 'Run trial division with a five-million-operation budget.',
            why: 'Its cost is governed by √n, and √n here is about 12.6 million.',
            work: '5 000 000 operations, budget exhausted, no factor found',
            result: 'it needs roughly 12.6 million and was given five'
          },
          {
            do: 'Run Pollard’s rho on the same number.',
            why: 'Its cost is governed by √p where p is the SMALLEST factor.',
            work: '2 532 operations, and it returns 11 489 279',
            result: 'a factor of 1 975 fewer operations for the same answer'
          },
          {
            do: 'Explain the gap from the birthday bound rather than the measurement.',
            why: 'A measured ratio without a mechanism is a coincidence until it is explained.',
            work: '√p is about 3 390 for p = 11 489 279, and rho took 2 532',
            result: 'the measurement lands where the bound predicts'
          },
          {
            do: 'Select a number with a small factor and repeat.',
            why: 'To confirm the costs are governed by different quantities rather than by size.',
            work: '561 = 3 × 11 × 17 costs trial division 7 operations and rho 1',
            result: 'both collapse, because the smallest factor is 3'
          }
        ],
        answer: 'The two methods always return the same factorisation and their costs are ' +
          'governed by different quantities: √n for trial division and √p for rho, where p is the ' +
          'smallest factor. On a number with any small factor both finish instantly; on a product ' +
          'of two equal-sized primes rho’s advantage shrinks to a constant and trial division is ' +
          'hopeless. That asymmetry is the whole reason an RSA modulus is two primes of the same ' +
          'size — the difficulty is not that the number is large, it is that its smallest factor ' +
          'is as large as its size permits.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
