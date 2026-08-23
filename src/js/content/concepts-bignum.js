/** Concepts for arbitrary precision and number theory (M17.7-M17.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'arbitrary-precision': [
      {
        term: 'The base is chosen by arithmetic, not by taste',
        plain: 'A limb product plus the running column total has to stay exactly representable.',
        formal: 'at a base of 2¹⁶ a limb product is at most 2³², leaving 21 bits of headroom below 2⁵³',
        detail: 'Schoolbook multiplication forms products of two limbs and adds a column of them ' +
          'into an accumulator, and a double holds integers exactly only up to 2⁵³. Choosing 2³² ' +
          'as the base would make every product overflow that immediately, so the arithmetic ' +
          'would be silently approximate in the one module that must not be — and it would look ' +
          'fine on small operands. The headroom is what bounds how deep a column can get: 21 bits ' +
          'is thousands of limbs, far more than any demo here uses.',
        example: 'The demo multiplies 123 456 789 by 987 654 321 as two-limb numbers in base ' +
          '65 536 and gets 121 932 631 112 635 269, matching BigInt exactly.'
      },
      {
        term: 'Karatsuba trades one multiplication for several additions',
        plain: 'Three half-size products recover what four would, and the recursion pays for it in additions and allocations.',
        formal: 'the exponent drops from 2 to log₂3 ≈ 1.585, at the cost of extra additions at every level',
        readAs: 'Doubling the operand size multiplies schoolbook’s work by four and Karatsuba’s by ' +
          'about three, so the gap widens with size — and the additions the recursion needs grow too.',
        detail: 'Splitting each operand into a high and a low half, the middle term of the product ' +
          'can be recovered from the other two plus one extra product of the sums, so three ' +
          'multiplications do the work of four. That is a genuine asymptotic improvement and it ' +
          'is not free: each level allocates four temporary arrays and performs several ' +
          'full-width additions and subtractions. The recursion floor exists because below it ' +
          'that overhead exceeds the saving outright.',
        example: 'At 4 096 bits the demo measures 65 536 limb multiplications for schoolbook ' +
          'against 13 834 for Karatsuba — 4.74× fewer.'
      },
      {
        term: 'The crossover is three different sizes, and only one of them is what you pay',
        plain: 'Count only multiplications and Karatsuba wins at 128 bits; count everything and it wins at 2 048; time it and it has not won yet.',
        formal: 'measured: multiplications cross at 128 bits, total limb work at 2 048 bits, wall clock at no size in the sweep',
        detail: 'This is where the folk claim comes from. "Karatsuba wins above eight limbs" is ' +
          'true of exactly one column, and it is the column that flatters the algorithm. Adding ' +
          'the limb-level additions moves the crossing by a factor of sixteen, and timing it moves ' +
          'the crossing out of the measured range entirely, because the recursion’s allocations ' +
          'do not appear in any operation count. An implementation is not faster because its ' +
          'asymptotics are better; the only way to know is to count all of the work and then time ' +
          'it anyway.',
        example: 'At 512 bits the demo reports 1.97× fewer multiplications, 0.66× on total limb ' +
          'work, and 0.26× on wall clock — three numbers, two of them below one.'
      },
      {
        term: 'Division is the operation that is genuinely hard',
        plain: 'Every quotient digit is an estimate from the top two limbs, and the estimate can be wrong.',
        formal: 'Knuth’s algorithm D normalises so the leading divisor limb is at least half the base, which bounds the error at two',
        detail: 'Without the normalising shift the quotient estimate can be off by an arbitrary ' +
          'amount, and the correction loop becomes unbounded. With it, the estimate is at most ' +
          'two too large, so at most two corrections are needed — and a third case remains where ' +
          'the subtraction still goes negative, which is the add-back. Every part of the algorithm ' +
          'exists to make a specific error bound hold, which is why it reads as arbitrary until ' +
          'you know which bound each step is protecting.',
        example: 'The demo runs 4 000 randomised divisions against BigInt and reports 0 wrong ' +
          'quotients and 0 wrong remainders.'
      },
      {
        term: 'The add-back is too rare for random testing to reach',
        plain: 'It fires once in half a million quotient digits, so leaving it out passes every randomised test.',
        formal: 'measured 1 add-back in 500 034 quotient digits — a rate of 2.00e-6, below Knuth’s 2/base estimate of 3.05e-5',
        detail: 'This is the general lesson rather than a fact about long division: a branch that ' +
          'random inputs reach once in half a million opportunities is, for testing purposes, ' +
          'unreachable — and an implementation that omits it ships, passes everything, and fails ' +
          'on an input a user supplies a year later. The only defence is a fixture built ' +
          'deliberately to reach it, which is why the two operand pairs that trigger it every time ' +
          'are named constants in the module rather than something a search hopes to stumble on.',
        example: 'The demo’s two fixtures each fire the correction on every run, and produce the ' +
          'correct quotient and remainder.'
      },
      {
        term: 'Square-and-multiply leaks the exponent’s population count',
        plain: 'One squaring per bit and one multiplication per SET bit, so the operation count names how many bits are one.',
        formal: 'for 65 537: 17 bits, 2 set, 17 squarings, 2 multiplications — the counts match exactly',
        detail: 'The squaring count is the exponent’s bit length, which is usually public; the ' +
          'multiplication count is its population count, which for a private exponent is not. An ' +
          'attacker who can time the operation, or watch its power draw, reads that count ' +
          'directly. This is why 65 537 is the standard public exponent — two set bits, everybody ' +
          'knows, nothing leaks — and why a private exponent must never go through this algorithm ' +
          'as written. M23 is about the fix.',
        example: 'The demo compares 65 537 with 131 071 — both 17 bits, so both cost 17 ' +
          'squarings — and they cost 2 multiplications against 17.'
      },
      {
        term: 'Montgomery form replaces a division with a shift',
        plain: 'Work with x·R mod n instead of x, and the modular reduction becomes arithmetic on the low bits.',
        formal: 'entering and leaving the form costs two multiplications, so it pays only when many operations happen inside it',
        detail: 'A modular multiplication is a multiplication plus a reduction, and the reduction ' +
          'is a division — the expensive operation. Montgomery’s trick picks a radix R that is a ' +
          'power of two, so dividing by R is a shift, and arranges the arithmetic so the ' +
          'reduction only ever divides by R. The conversion at each end is the overhead, which is ' +
          'exactly why modular exponentiation is the canonical use: hundreds of operations happen ' +
          'between one entry and one exit.',
        example: 'The demo checks Montgomery form against the plain algorithm on every run and ' +
          'reports the same value with 34 reductions for a 17-bit exponent.'
      },
      {
        term: 'The platform’s big integers are fast and are not constant time',
        plain: 'BigInt beats both implementations here by three to five times, and its work depends on the values.',
        formal: 'at 4 096 bits: 0.0565 ms for BigInt against 0.1762 and 0.4750 ms',
        detail: 'The engine’s implementation is compiled code with a real carry instruction and a ' +
          'proper multiplication algorithm, so writing your own is a learning exercise rather ' +
          'than an optimisation. What is worth knowing is what it does not promise: the work ' +
          'depends on the operand values, so an equality check on a secret leaks through timing, ' +
          'and there is no way to ask for a constant-time comparison. That is the moment a ' +
          'general-purpose big-integer type stops being the right tool, and it arrives as soon as ' +
          'one of the integers is a key.',
        example: 'The demo’s BigInt column beats schoolbook at every size in the sweep, from 64 ' +
          'bits to 4 096.'
      }
    ],

    'modular-arithmetic': [
      {
        term: 'A Fermat test is not a primality test, and on a Carmichael number it is not probabilistic either',
        plain: 'Every base coprime to 561 passes, so the false-positive rate for that input is one.',
        formal: 'measured: 319 of 319 coprime bases pass for 561, 767 of 767 for 1105, 1 295 of 1 295 for 1729',
        detail: 'The framing "a probabilistic test with error 2⁻ᵏ" is about random bases on ' +
          'arbitrary inputs, and it collapses completely on the inputs it is most likely to be ' +
          'handed by an adversary. Carmichael numbers satisfy Fermat’s congruence for every base ' +
          'coprime to them — that is Korselt’s criterion — so running more bases changes nothing ' +
          'at all. They are also enumerable, so the adversary does not have to be lucky.',
        example: 'The demo’s table puts all eight Carmichael numbers at exactly 100.0%.'
      },
      {
        term: 'Miller-Rabin asks for a square root of one, which is what closes the hole',
        plain: 'In a prime modulus the only square roots of 1 are ±1, so anything else is a proof of compositeness.',
        formal: 'write n − 1 = d × 2ˢ; a prime has a^d ≡ 1 or some a^(d·2ⁱ) ≡ −1',
        readAs: 'Pull all the factors of two out of n minus one; then for a prime, raising the ' +
          'base to what is left either already gives one, or gives minus one somewhere along the ' +
          'chain of squarings that follows.',
        detail: 'That extra condition is the entire difference from the Fermat test. A composite ' +
          'that arrives at 1 without passing through −1 has just produced a square root of one ' +
          'that is neither 1 nor n − 1, and a prime modulus has no such thing — so the witness is ' +
          'a certificate rather than a hint. It is also why the residue sequence is worth ' +
          'displaying: the Fermat test looks only at the last value, and every bit of the ' +
          'information is in the values before it.',
        example: 'For 561 the demo shows 263 → 166 → 67 → 1 for base 2: it reaches 1, which is ' +
          'what Fermat checks, without ever reaching 560.'
      },
      {
        term: 'Below 2⁶⁴ Miller-Rabin is deterministic, and quoting an error rate is a misunderstanding',
        plain: 'Small fixed witness sets have been verified exhaustively against every composite under a bound.',
        formal: 'twelve fixed bases decide primality for every input below 2⁶⁴; two bases suffice below 1 373 653',
        detail: 'These sets are facts about the integers rather than heuristics, established by ' +
          'exhaustive search, and they turn a probabilistic algorithm into a decision procedure ' +
          'over a bounded range. A 64-bit primality check therefore needs no randomness, no ' +
          'repetition and no confidence interval — and code that runs "forty random rounds" on a ' +
          '64-bit input is doing more work for a weaker guarantee. Above 2⁶⁴ the probabilistic ' +
          'framing returns and is the right one.',
        example: 'The demo’s witness set for 561 is one base, and base 2 rejects all eight ' +
          'Carmichael numbers in the table.'
      },
      {
        term: 'Trial division costs the square root of n; Pollard’s rho costs the square root of the smallest factor',
        plain: 'One is governed by the number and the other by its easiest factor, which is why they diverge so wildly.',
        formal: 'on a 15-digit semiprime: 5 000 000 operations without finishing, against 2 532 — a factor of 1 975',
        detail: 'The rho sequence x → x² + c mod n is a pseudorandom walk, so by the birthday ' +
          'bound it repeats a residue modulo a factor p after about √p steps — long before it ' +
          'repeats modulo n — and Floyd’s cycle detection turns that repeat into a gcd that ' +
          'reveals p — about 3 390 steps for a factor of 11 489 279. The consequence is the ' +
          'whole shape of practical factoring: a large number ' +
          'with one small factor collapses instantly, and a product of two equal-sized primes does ' +
          'not. That is precisely why an RSA modulus is built the second way.',
        example: 'The demo factors 158 346 127 852 483 into 11 489 279 × 13 782 077, with trial ' +
          'division exhausting a five-million-operation budget and rho finishing in 2 532.'
      },
      {
        term: 'The linear sieve marks each composite once and leaves its smallest factor behind',
        plain: 'Only ever mark a composite from its smallest prime factor, and the table it builds turns factorising into lookups.',
        formal: 'to 10⁶: 2 122 048 marks for the classic sieve against 921 501 — one per composite — for 4× the memory',
        detail: 'The classic sieve crosses out each composite once per distinct prime factor, so ' +
          'the total work is n times the sum of the reciprocals of the primes — about n log log n. ' +
          'The linear sieve restricts marking so each composite is reached exactly once, and the ' +
          'prime that reached it is recorded, which means factorising any number under the limit ' +
          'becomes a walk down an array with no arithmetic at all. It pays for that with an ' +
          'integer per entry instead of a bit.',
        example: 'The demo finds the same 78 498 primes both ways, at 976.6 KB against 3.8 MB.'
      },
      {
        term: 'Extended Euclid produces the inverse, and the inverse exists only when the gcd is one',
        plain: 'Solving a·x + n·y = gcd gives x as a’s inverse whenever the gcd comes out as one.',
        formal: 'a⁻¹ mod n exists exactly when gcd(a, n) = 1, and the extended algorithm returns it',
        readAs: 'A number has a reciprocal in modular arithmetic only when it shares no factor ' +
          'with the modulus, and the extended Euclidean algorithm computes that reciprocal as a ' +
          'by-product of finding the shared factor.',
        detail: 'Division in modular arithmetic is multiplication by an inverse, and the inverse ' +
          'is where the arithmetic stops being total: two thirds of the residues modulo 12 have ' +
          'no inverse at all. That is why prime moduli are so convenient — every non-zero residue ' +
          'is then invertible — and why a composite modulus turns "divide" into "check first". ' +
          'Stein’s binary gcd computes the same answer with shifts and subtractions instead of ' +
          'divisions, which matters on hardware without a divider.',
        example: 'The demo measures Euclid at 14.06 divisions per pair and Stein at 77.06 shifts ' +
          'and subtractions, with 0 disagreements over 4 000 pairs.'
      },
      {
        term: 'The Chinese remainder theorem is only correct while the moduli are wide enough',
        plain: 'Residues modulo coprime numbers pin down one value — modulo their product, and no further.',
        formal: 'the reconstruction is exact only while the product of the moduli exceeds the value',
        detail: 'This is the condition people forget, and when it fails nothing raises an error: ' +
          'the answer comes back wrapped and looks exactly like a valid answer. It matters because ' +
          'CRT is the standard way to run a computation that would overflow — do it modulo several ' +
          'small primes and reassemble — and the reassembly is only the true value if the product ' +
          'of the primes is larger than any intermediate the computation produces, not just the ' +
          'final one.',
        example: 'The demo rebuilds 1 234 567 from six residues whose moduli multiply to 7 436 429, ' +
          'and reports the range covered at each step so the condition is visible.'
      },
      {
        term: 'Modular exponentiation is what makes the asymmetry usable',
        plain: 'Raising to a huge power modulo n costs the exponent’s bit length, while undoing it costs a factorisation.',
        formal: 'modPow is O(log e) modular multiplications; recovering e from the result is the discrete logarithm problem',
        detail: 'Every public-key scheme in ordinary use rests on a pair like this: an operation ' +
          'that is cheap in one direction and believed expensive in the other. Fast exponentiation ' +
          'is the cheap direction and it is elementary — square and multiply, one step per bit. ' +
          'The expensive direction is not proved expensive, which is the honest statement: RSA and ' +
          'Diffie-Hellman rest on the absence of a fast algorithm rather than on a proof that none ' +
          'exists, and a quantum computer of sufficient size would supply one.',
        example: 'The demo computes 3 raised to 123 456 789 modulo 1 000 000 007 in 27 squarings ' +
          'and 16 multiplications.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
