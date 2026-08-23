/** Reference entries for arbitrary precision and number theory (M17.7-M17.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'arbitrary-precision': {
      summary: 'Limb representation and the base that makes it exact, two multiplication ' +
        'algorithms whose crossover depends on which column you count, Knuth’s algorithm D with ' +
        'the correction random testing cannot reach, and what square-and-multiply leaks.',
      intuition: '"Karatsuba wins above eight limbs" is true of the multiplication count and false ' +
        'of total work and of wall clock, which is why all three are on the table.',
      formulation: {
        equations: [
          {
            label: 'The base',
            expr: 'a limb product plus the running column must stay exactly representable',
            terms: [
              { sym: 'chosen base', meaning: '2¹⁶, so a product is at most 2³²' },
              { sym: 'headroom', meaning: '21 bits below 2⁵³, which bounds the column depth at thousands of limbs' },
              { sym: 'if 2³² were chosen', meaning: 'every product would exceed 2⁵³ and the arithmetic would be silently approximate' },
              { sym: 'checked', meaning: '123 456 789 × 987 654 321 = 121 932 631 112 635 269, matching BigInt' }
            ]
          },
          {
            label: 'The three crossovers',
            expr: 'schoolbook against Karatsuba, measured three ways',
            terms: [
              { sym: 'limb multiplications', meaning: 'cross at 128 bits — 64 against 52' },
              { sym: 'total limb work', meaning: 'cross at 2 048 bits — 16 384 against 15 977' },
              { sym: 'wall clock', meaning: 'no crossing in the sweep; at 4 096 bits, 0.1762 ms against 0.4750 ms' },
              { sym: 'the engine’s BigInt', meaning: '0.0565 ms at 4 096 bits — faster than both at every size' }
            ]
          },
          {
            label: 'Algorithm D',
            expr: 'normalise, estimate from the top two limbs, correct at most twice, add back if still negative',
            terms: [
              { sym: 'the normalising shift', meaning: 'makes the leading divisor limb at least half the base, bounding the estimate error at two' },
              { sym: 'the add-back', meaning: 'measured 1 in 500 034 quotient digits — a rate of 2.00e-6' },
              { sym: 'Knuth’s estimate', meaning: '2 / base = 3.05e-5, fifteen times more often than measured' },
              { sym: 'the fixtures', meaning: 'two named operand pairs that fire it on 100% of runs' }
            ]
          },
          {
            label: 'Square and multiply',
            expr: 'one squaring per bit, one multiplication per SET bit',
            terms: [
              { sym: 'exponent 65 537', meaning: '17 bits, 2 set — 17 squarings, 2 multiplications' },
              { sym: 'exponent 131 071', meaning: 'the same 17 bits, so the same 17 squarings, and 17 multiplications' },
              { sym: 'what leaks', meaning: 'the population count of the exponent, directly from the operation count' },
              { sym: 'Montgomery form', meaning: 'trades the modular reduction for a shift; two multiplications to enter and leave' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every limb-level result is compared against BigInt',
          why: 'A multiplication wrong in one limb produces a number as plausible as the right one.',
          breaks: 'The error is discovered by a user rather than by the suite.'
        },
        {
          name: 'The divisor is normalised to at least half the base before estimating',
          why: 'It is what bounds the quotient-digit estimate error at two.',
          breaks: 'The correction loop becomes unbounded and the algorithm can fail to terminate.'
        },
        {
          name: 'The add-back branch is exercised by a fixture, not by chance',
          why: 'At 2.00e-6 per quotient digit no randomised suite reaches it reliably.',
          breaks: 'An implementation without the correction passes every test and is wrong on real input.'
        },
        {
          name: 'Both operation counts are reported, along with a timing',
          why: 'The three cross at three different sizes and only one is what a caller pays.',
          breaks: 'A tuning threshold copied from the flattering column makes the library slower.'
        }
      ],
      complexity: [
        { operation: 'schoolbook multiplication', average: 'n × m limb products — 65 536 at 4 096 bits', worst: 'the same; there is no data dependence' },
        { operation: 'Karatsuba multiplication', average: 'about n^1.585 limb products — 13 834 at 4 096 bits', worst: '49 374 total limb operations, above schoolbook’s until 2 048 bits' },
        { operation: 'division by one limb', average: 'one division per limb of the numerator', worst: 'the same' },
        { operation: 'algorithm D', average: 'a quotient digit per limb of the quotient, each two corrections at most', worst: 'one add-back per 500 034 digits on random operands' },
        { operation: 'modular exponentiation', average: 'log₂(e) squarings and popcount(e) multiplications', worst: 'every bit set: 2 log₂(e) modular multiplications' }
      ],
      failureModes: [
        {
          symptom: 'Products are correct on small operands and wrong on large ones.',
          cause: 'The base is too large, so a limb product plus the column exceeds 2⁵³.',
          fix: 'Pick the base from the accumulator width, not from convenience, and test at full length.'
        },
        {
          symptom: 'A long division returns a quotient one too large on rare inputs.',
          cause: 'The add-back correction was omitted, and randomised tests never reached it.',
          fix: 'Implement the correction and keep a fixture that forces it on every run.'
        },
        {
          symptom: 'A "faster" multiplication makes the library slower.',
          cause: 'The crossover threshold was taken from the multiplication count rather than from a timing.',
          fix: 'Measure all three columns on the target machine and pick the threshold from wall clock.'
        },
        {
          symptom: 'A cryptographic operation is faster for some keys than others.',
          cause: 'Square-and-multiply performs one multiplication per set bit of the exponent.',
          fix: 'Use a constant-time ladder; a general-purpose big-integer type cannot provide one.'
        },
        {
          symptom: 'A modular exponentiation is dominated by its reductions.',
          cause: 'Each reduction is a division, and there are two per bit of the exponent.',
          fix: 'Enter Montgomery form once and stay in it; the two conversions amortise immediately.'
        }
      ],
      inTheWild: [
        { system: 'GMP', how: 'switches between schoolbook, Karatsuba, three Toom-Cook variants and FFT multiplication at thresholds tuned per architecture by measurement.' },
        { system: 'JavaScript BigInt', how: 'is fast and explicitly not constant time, which is why the Web Crypto API exists rather than expecting you to build RSA out of it.' },
        { system: 'OpenSSL', how: 'keeps a separate constant-time modular exponentiation path for private-key operations, with the exponent’s bits never steering a branch.' }
      ],
      sources: [
        { title: 'The Art of Computer Programming, volume 2, section 4.3.1', author: 'Donald Knuth', note: 'Algorithm D in full, including the add-back and the probability estimate for it.' },
        { title: 'Multiplication of multidigit numbers on automata', author: 'Karatsuba and Ofman', note: 'The original three-multiplication split.' },
        { title: 'Modular multiplication without trial division', author: 'Peter Montgomery', note: 'Four pages, and the reason every modular exponentiation is written this way.' },
        { title: 'Hacker’s Delight, chapter 9', author: 'Henry S. Warren, Jr.', note: 'divmnu, the multi-word division routine, with the add-back test cases used here.' }
      ]
    },

    'modular-arithmetic': {
      summary: 'Modular arithmetic, the extended Euclidean algorithm, the Chinese remainder ' +
        'theorem, and the primality and factoring algorithms — with the Fermat test measured on ' +
        'the inputs where it is wrong with certainty.',
      intuition: 'On a Carmichael number the Fermat test has an error probability of one, not 2⁻ᵏ; ' +
        'and below 2⁶⁴ Miller-Rabin has one of zero.',
      formulation: {
        equations: [
          {
            label: 'The Fermat test on Carmichael numbers',
            expr: 'every coprime base passes, so more rounds buy nothing',
            terms: [
              { sym: '561 = 3 × 11 × 17', meaning: '319 of 319 coprime bases pass — 100.0%' },
              { sym: '1105, 1729, 2465', meaning: '767/767, 1 295/1 295, 1 791/1 791 — all 100.0%' },
              { sym: 'Korselt’s criterion', meaning: 'why: n is squarefree and p − 1 divides n − 1 for every prime factor p' },
              { sym: 'and they are enumerable', meaning: 'so an adversary choosing the input does not have to be lucky' }
            ]
          },
          {
            label: 'What Miller-Rabin adds',
            expr: 'write n − 1 = d × 2ˢ and watch the squaring chain, not just its end',
            terms: [
              { sym: 'the extra condition', meaning: 'a prime has a^d ≡ 1, or reaches −1 at some squaring' },
              { sym: 'for 561, base 2', meaning: '263 → 166 → 67 → 1: reaches 1 without reaching 560' },
              { sym: 'what that proves', meaning: '67² ≡ 1 and 67 is neither 1 nor 560 — a square root of one a prime cannot have' },
              { sym: 'measured', meaning: 'base 2 alone rejects all eight Carmichael numbers in the table' }
            ]
          },
          {
            label: 'Deterministic witness sets',
            expr: 'exhaustively verified, so below the bound there is no error rate to quote',
            terms: [
              { sym: 'below 2 047', meaning: 'base 2 alone' },
              { sym: 'below 1 373 653', meaning: 'bases 2 and 3' },
              { sym: 'below 3 215 031 751', meaning: 'bases 2, 3, 5 and 7' },
              { sym: 'below 2⁶⁴', meaning: 'the first twelve primes' }
            ]
          },
          {
            label: 'Two factoring costs, two governing quantities',
            expr: '√n for trial division, √p for Pollard’s rho where p is the SMALLEST factor',
            terms: [
              { sym: 'on a 15-digit semiprime', meaning: '5 000 000 operations without finishing, against 2 532 — 1 975×' },
              { sym: 'the birthday bound', meaning: '√p is about 3 390 for p = 11 489 279, and rho took 2 532' },
              { sym: 'on 561', meaning: '7 operations against 1 — both collapse when the smallest factor is 3' },
              { sym: 'why RSA uses equal primes', meaning: 'it maximises the smallest factor for a given modulus size' }
            ]
          },
          {
            label: 'Sieves and gcds',
            expr: 'the same answers at different costs',
            terms: [
              { sym: 'sieve of Eratosthenes to 10⁶', meaning: '2 122 048 marks, 976.6 KB' },
              { sym: 'linear sieve', meaning: '921 501 marks — one per composite — at 3.8 MB, and it leaves the smallest factor behind' },
              { sym: 'Euclid', meaning: '14.06 divisions per pair' },
              { sym: 'Stein’s binary gcd', meaning: '77.06 shifts and subtractions per pair, and no division at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A Miller-Rabin witness is a certificate, not a hint',
          why: 'It exhibits a square root of one that a prime modulus cannot have.',
          breaks: 'Reporting a trial-division factor in a column headed "witness" conflates two different proofs.'
        },
        {
          name: 'The deterministic witness set is chosen from the input’s magnitude',
          why: 'Each set is verified only below its own bound.',
          breaks: 'Using a small set above its bound turns a decision procedure back into a guess, silently.'
        },
        {
          name: 'A modular inverse exists exactly when the gcd is one',
          why: 'Division is multiplication by an inverse, and the inverse is where the arithmetic stops being total.',
          breaks: 'CRT returns a plausible wrong answer when two moduli share a factor.'
        },
        {
          name: 'The product of the CRT moduli exceeds every value being reconstructed',
          why: 'The reconstruction is exact only modulo that product.',
          breaks: 'The answer comes back wrapped, and it looks exactly like a valid answer.'
        }
      ],
      complexity: [
        { operation: 'gcd, Euclid', average: '14.06 divisions per random 64-bit pair', worst: 'about 1.44 log₂(n) steps, at consecutive Fibonacci numbers' },
        { operation: 'gcd, Stein', average: '77.06 shifts and subtractions per pair', worst: 'more iterations than Euclid, each without a division' },
        { operation: 'modPow', average: 'log₂(e) squarings plus popcount(e) multiplications', worst: '2 log₂(e) modular multiplications' },
        { operation: 'Miller-Rabin, deterministic below 2⁶⁴', average: 'up to 12 rounds, each log₂(n) squarings', worst: 'the full witness set, and the answer is a decision' },
        { operation: 'trial division', average: 'up to √n divisions — 5 000 000 without finishing on a 15-digit semiprime', worst: '√n, reached when n is prime or a semiprime of equal factors' },
        { operation: 'Pollard’s rho', average: 'about √p steps for the smallest factor p — 2 532 on the same semiprime', worst: 'unbounded; it can fail and needs a restart with a new constant' },
        { operation: 'sieve of Eratosthenes to n', average: 'n log log n marks — 2 122 048 at 10⁶', worst: 'the same; it is not data dependent' }
      ],
      failureModes: [
        {
          symptom: 'A primality check accepts a composite however many rounds it runs.',
          cause: 'It is a Fermat test and the input is a Carmichael number.',
          fix: 'Use Miller-Rabin; the extra condition is two lines and catches all of them with base 2.'
        },
        {
          symptom: 'A 64-bit primality check is reported with a confidence level.',
          cause: 'The probabilistic framing was carried over from the unbounded case.',
          fix: 'Use the published witness set for the range; below 2⁶⁴ the answer is a decision.'
        },
        {
          symptom: 'A CRT reconstruction returns a plausible but wrong value.',
          cause: 'The product of the moduli did not exceed the value, so the answer came back wrapped.',
          fix: 'Check the product against the largest intermediate, not just the final result.'
        },
        {
          symptom: 'A modular division silently produces nonsense.',
          cause: 'The divisor shared a factor with the modulus, so no inverse exists.',
          fix: 'Return the gcd from the extended algorithm and refuse when it is not one.'
        },
        {
          symptom: 'Pollard’s rho runs forever on a semiprime.',
          cause: 'Its cost is √p, and for two equal-sized primes that is close to n^(1/4).',
          fix: 'Budget the attempt and restart with a new constant; for large semiprimes rho is the wrong algorithm.'
        }
      ],
      inTheWild: [
        { system: 'Every RSA key generator', how: 'searches for primes with a few rounds of Miller-Rabin after trial division by the small primes, because that filter removes most candidates for almost no work.' },
        { system: 'Competitive programming', how: 'uses the linear sieve for its smallest-prime-factor table, which turns factorising every number under the limit into array lookups.' },
        { system: 'RSA-CRT', how: 'performs the private-key operation modulo p and q separately and reassembles, which is about four times faster and is also the operation fault attacks target.' }
      ],
      sources: [
        { title: 'Probabilistic algorithm for testing primality', author: 'Michael Rabin', note: 'The test, and the bound on how many bases a composite can fool.' },
        { title: 'Strong pseudoprimes to the first eight prime bases', author: 'Jiang and Deng', note: 'One of the exhaustive verifications the deterministic witness sets rest on.' },
        { title: 'A Monte Carlo method for factorization', author: 'John Pollard', note: 'The rho algorithm, and the birthday argument for why it costs √p.' },
        { title: 'The Art of Computer Programming, volume 2, chapter 4.5', author: 'Donald Knuth', note: 'Euclid, Stein, the Chinese remainder theorem and the analysis of all three.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
