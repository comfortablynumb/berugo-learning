/** Reference entries for IEEE 754, its hazards, and exact representations (M17.4-M17.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'ieee-754': {
      summary: 'binary64 as three fields and an exact rational, the spacing that doubles at every ' +
        'power of two, the four classes of value, and the three ways to compare two floats.',
      intuition: 'A finite double is not an approximation of a real number, it is a specific ' +
        'rational one — and the representable ones get twice as far apart at every power of two.',
      formulation: {
        equations: [
          {
            label: 'The layout',
            expr: '1 sign bit, 11 exponent bits biased by 1023, 52 fraction bits',
            terms: [
              { sym: 'normal', meaning: 'stored exponent 1 … 2046; value is ±1.fraction × 2^(e − 1023)' },
              { sym: 'subnormal', meaning: 'stored exponent 0 with a non-zero fraction; no implicit leading one' },
              { sym: 'zero, infinity, NaN', meaning: 'stored exponent 0 or 2047 with a zero or non-zero fraction' },
              { sym: 'why biased', meaning: 'so the whole 64-bit pattern of a positive double increases with its value' }
            ]
          },
          {
            label: 'What 0.1 actually is',
            expr: '3 602 879 701 896 397 / 2⁵⁵',
            terms: [
              { sym: 'stored exponent', meaning: '1019, which is −4 unbiased' },
              { sym: 'significand', meaning: '7 205 759 403 792 794 with the implicit one restored' },
              { sym: 'exact decimal', meaning: '0.1000000000000000055511151231257827021181583404541015625 — fifty-five places' },
              { sym: 'the gap either side', meaning: '1.3878e-17, the same above and below because 0.1 is not a power of two' }
            ]
          },
          {
            label: 'The spacing ladder',
            expr: 'the gap between neighbouring doubles doubles at every power of two',
            terms: [
              { sym: 'at 1.0', meaning: '2.2204e-16, which is 2⁻⁵² and is machine epsilon by definition' },
              { sym: 'at 2⁵²', meaning: 'exactly 1 — every integer is representable' },
              { sym: 'at 2⁵³', meaning: '2 — half the integers are gone and x + 1 = x' },
              { sym: 'at 2⁷⁰', meaning: '262 144 — consecutive representable values a quarter of a million apart' }
            ]
          },
          {
            label: 'Three ways to compare',
            expr: 'absolute, relative, and the count of representable doubles between',
            terms: [
              { sym: '1e9 + 1 against 1e9', meaning: '8 388 608 doubles apart; absolute says different, relative says equal' },
              { sym: '1e-12 against 2e-12', meaning: '4 503 599 627 370 496 apart; absolute says equal, relative says different' },
              { sym: '0.1 + 0.2 against 0.3', meaning: 'exactly 1 double apart' },
              { sym: 'the ULP distance', meaning: 'the only measure defined by the format rather than by a chosen number' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'For a positive double, incrementing the raw pattern gives the next representable value',
          why: 'The exponent field sits above the fraction field and is biased, so a mantissa carry is a binade step.',
          breaks: 'A hand-written nextAfter special-cases four boundaries and gets at least one wrong.'
        },
        {
          name: 'Stepping up from zero lands on the smallest subnormal, not the smallest normal',
          why: 'Gradual underflow is what makes a − b = 0 imply a = b.',
          breaks: 'A gap of 2.2e-308 opens either side of zero and small differences vanish.'
        },
        {
          name: 'The gap below a power of two is half the gap above it',
          why: 'The binade below is packed twice as densely.',
          breaks: 'A ULP-based tolerance is wrong by a factor of two at exactly the values people test with.'
        },
        {
          name: 'Every comparison with a NaN except ≠ is false',
          why: 'The standard requires it, and sorting depends on the comparator being transitive.',
          breaks: 'A NaN in a sort key makes the order implementation-defined and non-repeatable.'
        }
      ],
      complexity: [
        { operation: 'decompose into fields', average: 'one reinterpret and three masks', worst: 'the same for every input class' },
        { operation: 'exact decimal expansion', average: 'digits proportional to the number of factors of two — 55 for 0.1', worst: '1 074 places for the smallest subnormal' },
        { operation: 'nextAfter', average: 'one integer increment of the raw pattern', worst: 'the same across binade and subnormal boundaries' },
        { operation: 'ULP distance', average: 'two pattern reads and a subtraction', worst: '4 503 599 627 370 496 for values a factor of two apart' },
        { operation: 'narrowing to binary32', average: 'discards 29 bits of significand', worst: '107 374 182 doubles of error for 0.1' }
      ],
      failureModes: [
        {
          symptom: 'A tolerance of 1e-9 rejects values that are obviously equal.',
          cause: 'An absolute epsilon is a statement about magnitude and the values are near 10⁹.',
          fix: 'Use a relative tolerance away from zero, or the ULP distance everywhere.'
        },
        {
          symptom: 'A relative tolerance calls two values equal near zero when they differ by a factor of two.',
          cause: 'The denominator vanishes, so every pair near zero is relatively close.',
          fix: 'Fall back to an absolute floor below the smallest magnitude that matters, and say what it is.'
        },
        {
          symptom: 'An identifier arrives in a browser off by one.',
          cause: 'It exceeded 2⁵³ and passed through a JSON number, where the double could not hold it.',
          fix: 'Serialise identifiers above 2⁵³ as strings.'
        },
        {
          symptom: 'A sort produces a different order on every run.',
          cause: 'A NaN in the key makes the comparator non-transitive.',
          fix: 'Reject or partition NaNs before sorting, rather than defining a comparison for them.'
        },
        {
          symptom: 'Numerical code slows down by an order of magnitude on some inputs.',
          cause: 'The values fell into the subnormal range, which some processors handle in microcode.',
          fix: 'Scale the problem, or set flush-to-zero once the accuracy loss is understood and stated.'
        }
      ],
      inTheWild: [
        { system: 'JavaScript', how: 'has one number type and exposes the boundary directly as Number.MAX_SAFE_INTEGER, which is 2⁵³ − 1.' },
        { system: 'The Patriot missile failure at Dhahran', how: 'accumulated a 0.34-second clock drift from a repeated multiplication by an inexact binary tenth over 100 hours.' },
        { system: 'GPUs and inference runtimes', how: 'trade binary64 for binary32, bfloat16 and fp8 deliberately, buying bandwidth with precision that is budgeted rather than assumed.' }
      ],
      sources: [
        { title: 'IEEE 754-2019', author: 'IEEE', note: 'The standard itself: the classes, the rounding modes and the required behaviours.' },
        { title: 'What every computer scientist should know about floating-point arithmetic', author: 'David Goldberg', note: 'The paper that made this material teachable, and still the best single reference.' },
        { title: 'Handbook of Floating-Point Arithmetic', author: 'Muller et al.', note: 'The complete treatment, including the algorithms behind nextAfter and correct rounding.' },
        { title: 'Comparing floating point numbers', author: 'Bruce Dawson', note: 'The ULP-distance comparison, with the boundary cases worked through.' }
      ]
    },

    'floating-point-hazards': {
      summary: 'Summation error, absorption, non-associativity, cancellation and variance, each ' +
        'scored against the exact sum of exactly the doubles involved, computed in BigInt.',
      intuition: 'Reordering an array changes the answer and neither answer is wrong; ' +
        'cancellation cannot be compensated away because the error was there before the subtraction.',
      formulation: {
        equations: [
          {
            label: 'Five methods on 200 001 values',
            expr: 'relative error against the exact sum, and the operation count that bought it',
            terms: [
              { sym: 'naive', meaning: '1.002e-11 relative, 1.002e+5 absolute, 200 001 operations' },
              { sym: 'pairwise', meaning: '4.329e-15, at 202 048 operations — 1% more' },
              { sym: 'Kahan', meaning: '7.126e-17, at 800 004 operations' },
              { sym: 'Neumaier', meaning: 'the same value, at 1 000 005 operations' },
              { sym: 'exact, rounded to a double', meaning: '7.126e-17 — the floor no method returning a double can beat' }
            ]
          },
          {
            label: 'Four orderings of one array',
            expr: 'distance from the exact total, in representable doubles',
            terms: [
              { sym: 'as generated', meaning: '50 078 doubles away' },
              { sym: 'smallest first', meaning: '0 — the correctly rounded total' },
              { sym: 'largest first', meaning: '50 078' },
              { sym: 'shuffled', meaning: '41 434, and 3 distinct sums across the four' },
              { sym: 'Kahan, every ordering', meaning: '0 — which is the real argument for compensation' }
            ]
          },
          {
            label: 'Variance on values clustered at 10⁹',
            expr: 'three formulas, one exact reference',
            terms: [
              { sym: 'sum of squares', meaning: '2.18103808e+4 against a true 8.32836041e-2 — a relative error of 2.619e+5' },
              { sym: 'two pass', meaning: '7.010e-11 relative, and it reads the data twice' },
              { sym: 'Welford', meaning: '1.167e-7 relative, one pass and constant state' },
              { sym: 'why the first fails', meaning: 'both terms are near 2 × 10²³ and the answer is near 0.08' }
            ]
          },
          {
            label: 'Cancellation and absorption',
            expr: 'the quadratic root, and the point where an addend disappears',
            terms: [
              { sym: 'textbook root', meaning: '−7.450580596924e-9, residual 2.549e-1, about 15 significant digits lost' },
              { sym: 'rewritten as −2c / (b + √(b² − 4ac))', meaning: '−1e-8, residual 1.110e-16' },
              { sym: 'the two roots', meaning: '1 541 029 470 702 650 representable doubles apart' },
              { sym: 'absorption at 10¹⁶', meaning: 'the gap is 2, so + 1 changes nothing and + 1.5 does' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every figure is scored against the exact sum of exactly these doubles',
          why: '"These disagree" is not "this is wrong" until something says what the answer was.',
          breaks: 'Two inexact methods compared against each other rank by luck.'
        },
        {
          name: 'The exact row has a non-zero error, and that is the floor',
          why: 'The true total of a list of doubles is generally not itself a double.',
          breaks: 'Treating zero as the target makes compensated summation look like it failed.'
        },
        {
          name: 'The data has a full 53-bit mantissa',
          why: 'Values with 32 significant bits sum exactly below 2²¹ terms, so naive summation scores zero error.',
          breaks: 'The whole section demonstrates the opposite of its claim, silently.'
        },
        {
          name: 'Variance is measured on values far from zero whatever the summation control says',
          why: 'The sum-of-squares failure needs a large offset; on centred data it looks fine.',
          breaks: 'A table reading "no error" reads as evidence that the textbook formula is safe.'
        }
      ],
      complexity: [
        { operation: 'naive summation', average: 'n additions; error grows with n on same-signed data', worst: '1.002e+5 absolute on 200 001 values' },
        { operation: 'pairwise summation', average: 'n additions plus the recursion; error grows with log n', worst: '4.329e-15 relative on the same data' },
        { operation: 'Kahan summation', average: '4n operations; error bound independent of n', worst: 'reaches the correctly rounded total in all four orderings' },
        { operation: 'exact summation in BigInt', average: 'n aligned big-integer additions', worst: 'operands as wide as the exponent range — far slower than any of the above' },
        { operation: 'Welford variance', average: 'one pass, constant state, 1.167e-7 relative', worst: 'four orders of magnitude behind two passes' }
      ],
      failureModes: [
        {
          symptom: 'A batch job and a streaming job report different totals for the same data.',
          cause: 'Different summation orders, and floating-point addition is not associative.',
          fix: 'Compensate, or fix the order and document it; neither total was wrong.'
        },
        {
          symptom: 'A running total stops changing while values are still arriving.',
          cause: 'The addends are below half the gap at the accumulator’s magnitude, so they round away.',
          fix: 'Compensate, or accumulate into buckets by magnitude and combine at the end.'
        },
        {
          symptom: 'A variance comes back negative.',
          cause: 'The sum-of-squares formula subtracted two nearly equal large numbers.',
          fix: 'Use Welford for one pass or subtract the mean first for two; there is no third option.'
        },
        {
          symptom: 'A root of a quadratic has no correct significant digits.',
          cause: '−b + √(b² − 4ac) cancels when 4ac is small next to b².',
          fix: 'Compute the well-conditioned root directly and get the other from the product of the roots.'
        },
        {
          symptom: 'A golden-value test fails after an unrelated refactor.',
          cause: 'The refactor changed the iteration order of a sum.',
          fix: 'Assert a tolerance in ULPs, or compensate so the sum is order-independent.'
        }
      ],
      inTheWild: [
        { system: 'NumPy', how: 'uses pairwise summation in `np.sum`, which is why it is more accurate than a Python loop over the same array and costs nothing extra.' },
        { system: 'Every streaming metrics system', how: 'rediscovers Welford’s algorithm, because a percentile pipeline cannot make two passes over data it has already dropped.' },
        { system: 'Spark and MapReduce jobs', how: 'produce order-dependent totals by construction, which is why financial aggregations in them are done in fixed point.' }
      ],
      sources: [
        { title: 'Further remarks on reducing truncation errors', author: 'William Kahan', note: 'The one-page note the compensation is named after.' },
        { title: 'Rundungsfehleranalyse einiger Verfahren zur Summation endlicher Summen', author: 'Arnold Neumaier', note: 'The variant that fixes the case where the addend is larger than the running sum.' },
        { title: 'Note on a method for calculating corrected sums of squares and products', author: 'B. P. Welford', note: 'Two pages, 1962, and still the answer.' },
        { title: 'Accuracy and Stability of Numerical Algorithms', author: 'Nicholas J. Higham', note: 'The error analysis for all of these, with the bounds derived rather than quoted.' }
      ]
    },

    'fixed-and-decimal': {
      summary: 'What a double ledger actually costs, measured against a rational reference: not ' +
        'cents in the total, but equality — and cents at every multiplication.',
      intuition: 'Summing money in doubles survives any volume a business reaches; applying a rate ' +
        'to it does not, and which rates are safe cannot be read off the rate.',
      formulation: {
        equations: [
          {
            label: 'The double ledger, against an exact rational total',
            expr: 'error in cents, and whether the value still compares equal',
            terms: [
              { sym: '10³ transactions', meaning: '1.019e-8 of a cent' },
              { sym: '10⁶ transactions', meaning: '6.855e-5 of a cent — still not half a cent' },
              { sym: 'rounds to the right cent', meaning: 'at every size tested' },
              { sym: 'compares equal', meaning: 'at none of them; 442 of 500 independent ledgers, 88.4%' }
            ]
          },
          {
            label: 'Applying a rate',
            expr: 'the product lands a fraction of an ulp below a half-cent boundary',
            terms: [
              { sym: 'at 8.75%', meaning: '2 554 exact ties in 200 000 lines, 1 026 rounded the wrong way, 1 026 cents lost' },
              { sym: 'at 17.5%', meaning: '2 124 lines wrong' },
              { sym: 'at 20% and 8.25%', meaning: '0 wrong — those rates produce no ties the double can fall below' },
              { sym: 'the point', meaning: 'nothing about the rate says which kind it is' }
            ]
          },
          {
            label: 'Six rounding policies over one batch',
            expr: 'drift from the unrounded total, in cents',
            terms: [
              { sym: 'half to even', meaning: '+177.60 — the accounting default' },
              { sym: 'half away from zero', meaning: '+1 459.60, roughly eight times the bias' },
              { sym: 'floor and truncate', meaning: '−98 677.40, identical here and different on negatives' },
              { sym: 'ceiling', meaning: '+98 848.60; the six span 197 526 cents' }
            ]
          },
          {
            label: 'What exactness costs',
            expr: 'rationals have no rounding policy and unbounded operands',
            terms: [
              { sym: '1/1 + 1/2 + … + 1/200', meaning: 'a denominator of 293 bits for a value of 6.878031' },
              { sym: 'per operation', meaning: 'a gcd over numbers that keep growing' },
              { sym: 'where they belong', meaning: 'the test oracle, which is exactly how this milestone uses them' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every claim is scored against an exact rational ledger',
          why: '"The totals differ by four cents" is not evidence until something says what the total was.',
          breaks: 'Two inexact ledgers compared against each other rank by luck.'
        },
        {
          name: 'Addition and comparison on scaled integers are exact and total',
          why: 'It is the property that removes the question rather than shrinking the error.',
          breaks: 'The scale drifts between call sites and the exactness silently stops holding.'
        },
        {
          name: 'Exactly one place in the system makes a rounding decision',
          why: 'The policy is a business rule and has to be reviewable and testable in one place.',
          breaks: 'Three call sites round differently and the discrepancy only shows in aggregate.'
        },
        {
          name: 'The scale is the domain’s smallest indivisible unit',
          why: 'Too coarse forces rounding into the data; too fine puts the scale into every comparison.',
          breaks: 'A tenth-of-a-cent fee cannot be represented at all, so it is rounded before it is stored.'
        }
      ],
      complexity: [
        { operation: 'add scaled integers', average: 'one instruction, exact', worst: 'the same; no policy is consulted' },
        { operation: 'multiply scaled integers', average: 'one multiply plus one rounded division', worst: 'the policy decides, and only on an exact tie' },
        { operation: 'double addition of money', average: 'one instruction, 6.855e-5 of a cent over 10⁶ rows', worst: 'unequal to the exact value on 88.4% of ledgers' },
        { operation: 'double multiplication of money', average: 'one instruction', worst: '1 026 wrong cents in 200 000 lines at 8.75%' },
        { operation: 'exact rational', average: 'a gcd per operation', worst: 'a 293-bit denominator after 200 additions' }
      ],
      failureModes: [
        {
          symptom: 'A total displays correctly and fails an equality check.',
          cause: 'The double is the nearest representable value to the exact total, and not that value.',
          fix: 'Hold money as a scaled integer; comparison then needs no tolerance at all.'
        },
        {
          symptom: 'A tax total is a few dollars short across a large batch.',
          cause: 'The product of an inexact rate and an amount lands just below a half-cent tie, so rounding goes down.',
          fix: 'Apply the rate as an exact ratio over integers and round once, under a named policy.'
        },
        {
          symptom: 'Two reports over the same data differ by cents.',
          cause: 'Two call sites round with different policies, or at different stages of the calculation.',
          fix: 'One rounding function, named from the domain, with the policy as data and a test.'
        },
        {
          symptom: 'A refund behaves differently from a charge of the same size.',
          cause: 'Floor and truncate are identical on positives and differ on negatives.',
          fix: 'Choose a policy that is symmetric about zero, or test the negative case explicitly.'
        },
        {
          symptom: 'An exact-rational calculation slows to a crawl over a long run.',
          cause: 'Denominators grow with the history rather than with the values.',
          fix: 'Use rationals as a test oracle and a scaled integer in the system.'
        }
      ],
      inTheWild: [
        { system: 'Stripe and most payment APIs', how: 'express every amount as an integer in the currency’s smallest unit, so the scale is part of the API rather than a convention.' },
        { system: 'IBM z-series', how: 'implements IEEE 754-2008 decimal64 and decimal128 in hardware, because financial workloads need decimal semantics at speed.' },
        { system: 'SQL NUMERIC and DECIMAL', how: 'are scaled integers with the scale in the column type, which is why a schema migration that changes the scale is a data migration.' }
      ],
      sources: [
        { title: 'IEEE 754-2019, clause 3.5', author: 'IEEE', note: 'The decimal formats, and the rounding attributes including round-half-to-even.' },
        { title: 'What every computer scientist should know about floating-point arithmetic', author: 'David Goldberg', note: 'Section 1 covers why 0.1 is not representable, which is the whole starting point.' },
        { title: 'General Decimal Arithmetic', author: 'Mike Cowlishaw', note: 'The specification behind decimal64, with the case for decimal semantics stated properly.' },
        { title: 'Martin Fowler, Quantity and Money patterns', author: 'Martin Fowler', note: 'Why the unit and the rounding policy belong in a type rather than in convention.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
