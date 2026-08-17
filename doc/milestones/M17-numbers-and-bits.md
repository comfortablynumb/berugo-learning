# M17 — Numbers, bits and floating point

> **Track** Algorithms · **Depends on** M01 · **Sections** 10 · **Effort** M

**Outcome.** The representation layer that every other track silently assumes. This is the
milestone that turns "floating point is imprecise" into a precise statement about ULPs, and "bit
tricks are clever" into a working toolkit with measured effects.

**Shared machinery introduced.** `machines/number-lab.js` — bit-level inspection and conversion for
every numeric type, an exact-arithmetic reference (rationals and arbitrary-precision integers) for
comparing against float results, and an error-tracking wrapper that records the accumulated ULP
error through a computation.

---

## Sections

### 17.1 Integer representation
- **Covers** — positional notation and bases, unsigned versus signed, two's complement and why it
  makes the adder work for both, sign extension, wrapping versus saturating versus trapping
  overflow, the asymmetry of INT_MIN, endianness in memory and on the wire, and JavaScript's int32
  coercion rules.
- **Demo** — the bit inspector from M00 extended: type a number, choose a width and a signedness,
  see the bits, the interpretations and the overflow behaviour of each arithmetic operation, with
  the wrap point marked on a number wheel.
- **Diagram** — mermaid diagram of the two's-complement number wheel with the overflow boundary.
- **Lab** — implement `addWithOverflowFlags(a, b, bits)` returning the wrapped result plus carry and
  overflow flags; tests assert agreement with an exact big-integer reference for all boundary cases.
- **Senior insight** — signed overflow is undefined behaviour in C and wraps in JavaScript's int32
  operators; the same expression can be optimised away in one language and produce a negative
  number in the other.

### 17.2 The bit-manipulation toolkit
- **Covers** — masks, set/clear/toggle/test, extracting and inserting bit fields, `x & (x - 1)` and
  `x & -x`, popcount by SWAR, count leading and trailing zeros, next power of two, Gray codes,
  De Bruijn sequences for bit-scan, branchless min/max/abs, and bit reversal.
- **Demo** — trick explorer: pick a trick, see the bit pattern transform step by step with the
  intermediate values, and a proof sketch of why it works; a counter compares operation counts
  against the loop-based equivalent.
- **Diagram** — mermaid diagram of the SWAR popcount's pairwise-sum stages.
- **Lab** — implement popcount via SWAR and `ctz` via a De Bruijn multiply-and-lookup; tests assert
  agreement with naive loops for all 2¹⁶ low words and randomised 32-bit values.
- **Senior insight** — these are not micro-optimisations in isolation; they are the primitives that
  bitset algorithms, allocators, GC mark bitmaps and chess engines are built out of.

### 17.3 Bitsets and SWAR algorithms
- **Covers** — bitsets over typed arrays, set operations as word-wise AND/OR/XOR, iterating set bits
  efficiently, rank/select over words (linking to M09), bitboards for board games, SWAR parallel
  arithmetic within a word, and the memory-bandwidth argument for bitsets over hash sets.
- **Demo** — a sieve and a graph-reachability computation implemented with a bitset and with a
  `Set`, showing memory, operation counts and time; a chess-style bitboard demo computes attack
  masks with shifts and masks.
- **Diagram** — mermaid diagram of a word-wise set intersection over a bitset.
- **Lab** — implement bitset union, intersection and `forEachSetBit` using `x & -x`; tests assert
  set-semantics equality with a reference `Set` over randomised operations.
- **Senior insight** — a bitset of 1 million elements is 125 KB and fits in L2; the equivalent hash
  set is megabytes and misses constantly. Density is the deciding question.

### 17.4 IEEE 754
- **Covers** — binary32 and binary64 layout, the implicit leading one, exponent bias, normal and
  subnormal numbers, signed zeros, infinities and NaN (quiet and signalling, NaN payloads), the
  five rounding modes with round-half-to-even as default, machine epsilon versus ULP, and the
  spacing of representable numbers.
- **Demo** — a float dissector: type a value, see sign/exponent/mantissa, the exact rational value
  it represents, the neighbouring representable values, and the ULP gap at that magnitude on a log
  number line.
- **Diagram** — mermaid diagram of the binary64 field layout with the bias applied.
- **Lab** — implement `ulp(x)` and `nextAfter(x, y)` using bit manipulation of the raw
  representation; tests assert monotonicity, correct behaviour at zero, at subnormal boundaries and
  at infinity.
- **Senior insight** — 0.1 + 0.2 ≠ 0.3 is the shallow version; the useful version is that the gap
  between representable doubles at 10¹⁶ is 2, so integer arithmetic silently stops being exact
  above 2⁵³.

### 17.5 Floating-point hazards
- **Covers** — catastrophic cancellation and how to reformulate around it (the quadratic formula,
  variance computation), absorption, non-associativity and why parallel reductions are
  non-deterministic, comparing floats (absolute, relative, ULP-based), Kahan and Neumaier
  compensated summation, pairwise summation, and error accumulation over iterations.
- **Demo** — summation lab: sum a million values by naive, pairwise, Kahan and exact methods, with
  the running error against the exact result plotted; a reordering control shows the answer change
  with order.
- **Diagram** — mermaid flowchart of the Kahan compensation step.
- **Lab** — implement Kahan summation and the numerically stable variance (Welford); tests assert
  the relative error stays below a threshold on adversarial inputs where naive methods fail
  outright.
- **Senior insight** — "the totals differ between the batch job and the streaming job" is almost
  always summation order, not a bug in either. Welford's algorithm is the fix people rediscover
  every few years.

### 17.6 Fixed point, decimal and rational arithmetic
- **Covers** — fixed-point representation and scaling, why money must not be binary floating point,
  decimal floating point (IEEE 754-2008 decimal64), integer-cents arithmetic, rounding policies
  (banker's, half-up) and their regulatory consequences, rational arithmetic with normalisation, and
  the cost of each.
- **Demo** — a money calculator run three ways (double, integer cents, decimal) over a stream of
  transactions with the divergence tracked, plus a rounding-policy selector showing the aggregate
  difference over 10⁶ operations.
- **Diagram** — mermaid decision flowchart for choosing a numeric representation by domain.
- **Lab** — implement a fixed-point type with correct multiply (with rounding) and divide; tests
  assert exact agreement with a rational reference for a transaction fixture.
- **Senior insight** — the rounding policy is a business rule and it belongs in one function with a
  test, not scattered across formatting code where each site rounds slightly differently.

### 17.7 Arbitrary-precision arithmetic
- **Covers** — limb representation and base choice, addition and subtraction with carries,
  schoolbook multiplication, Karatsuba (from M11) and the crossover, Toom–Cook and FFT-based
  multiplication (previewing M18), division algorithms (Knuth's algorithm D, Newton-based
  reciprocal), modular exponentiation with Montgomery form, and JavaScript's `BigInt` semantics and
  performance.
- **Demo** — bignum stepper: multiply two large numbers with the algorithm selected, watch the limb
  operations and the count, and see the crossover point measured against `BigInt`.
- **Diagram** — mermaid diagram of limb-wise multiplication with carry propagation.
- **Lab** — implement bignum division by a single limb and long division by a multi-limb divisor;
  tests assert quotient and remainder against `BigInt` for randomised operands.
- **Senior insight** — `BigInt` is not constant time and not side-channel safe; M23 explains why
  that matters the moment a big integer holds a private key.

### 17.8 Modular arithmetic and number theory
- **Covers** — modular arithmetic laws, gcd and the extended Euclidean algorithm, modular inverses,
  the Chinese remainder theorem, Fermat's little theorem and Euler's totient, fast exponentiation,
  primality testing (trial division, Fermat, Miller–Rabin with deterministic witness sets), the
  sieve of Eratosthenes and linear sieves, and Pollard's rho for factorisation.
- **Demo** — number laboratory: factor an integer with trial division and Pollard's rho side by
  side with operation counts; a Miller–Rabin view shows the witnesses tried and the composite
  certificate when found; a sieve visualiser marks composites as it runs.
- **Diagram** — mermaid flowchart of Miller–Rabin's witness loop and its possible outcomes.
- **Lab** — implement `modPow` and Miller–Rabin with the deterministic witness set for 64-bit
  inputs; tests assert exact agreement with a known prime list up to 10⁶ and correct handling of
  Carmichael numbers.
- **Senior insight** — Carmichael numbers pass the Fermat test for every coprime base, which is why
  Fermat testing alone is not a primality test — and why the deterministic Miller–Rabin witness
  sets are worth knowing by heart for bounded ranges.

### 17.9 Random number generation
- **Covers** — what "random" means for a PRNG, linear congruential generators and their lattice
  structure, xorshift, PCG, splitmix64, Mersenne Twister and its state size, period versus quality,
  statistical test suites (TestU01, PractRand) at a conceptual level, CSPRNGs and when you need one,
  seeding and reproducibility, uniform ranges without modulo bias, Fisher–Yates shuffling, and
  sampling from non-uniform distributions.
- **Demo** — generator comparison: scatter plots of consecutive pairs (showing LCG lattice
  structure), bit-level heat maps, period and speed, plus a modulo-bias demonstrator that makes the
  bias visible with a small modulus.
- **Diagram** — mermaid flowchart of rejection sampling for an unbiased bounded range.
- **Lab** — implement unbiased `randomInt(n)` by rejection and Fisher–Yates shuffle; tests assert
  uniformity of both over 10⁶ samples within a chi-squared threshold, and the naive modulo version
  fails the same test.
- **Senior insight** — `Math.floor(Math.random() * n)` is fine; `rand() % n` in a fixed-width
  generator is biased, and the bias is largest exactly when n is close to the generator's range.

### 17.10 Integer algorithms in practice
- **Covers** — overflow-safe arithmetic patterns, checked and saturating operations, safe midpoint
  computation, division and modulo semantics for negatives across languages, bit-packing multiple
  fields into one word, ID design (sequential, UUID versions, ULID, Snowflake) and their locality
  and privacy properties, and hashing versus encoding of identifiers.
- **Demo** — ID generator comparison: sequential, UUIDv4, UUIDv7, ULID and Snowflake generated live
  with sortability, collision probability, index-locality simulation and information leakage
  summarised per scheme.
- **Diagram** — mermaid diagram of a Snowflake ID's bit layout.
- **Lab** — implement a Snowflake-style generator with a timestamp, machine id and sequence,
  including clock-regression handling; tests assert monotonicity, uniqueness under 10⁵ rapid calls
  and correct behaviour when the clock steps backwards.
- **Senior insight** — random UUIDs as primary keys destroy B-tree insert locality (M51 measures
  it); time-ordered IDs exist for that reason, and they leak creation time in exchange.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/integer-ops.js` | Widths, overflow flags, saturating and checked arithmetic |
| `src/js/algorithms/bit-tricks.js` | Popcount, ctz/clz, De Bruijn, Gray code, bit reversal |
| `src/js/algorithms/bitset.js` | Word-backed set with iteration and rank |
| `src/js/algorithms/float-inspect.js` | Decompose, ULP, nextAfter, exact rational value |
| `src/js/algorithms/summation.js` | Naive, pairwise, Kahan, Neumaier, Welford |
| `src/js/algorithms/fixed-decimal.js` | Fixed point, decimal, rational with rounding policies |
| `src/js/algorithms/bignum.js` | Limbs, multiplication family, division, Montgomery |
| `src/js/algorithms/number-theory.js` | gcd, CRT, modPow, Miller–Rabin, sieves, Pollard rho |
| `src/js/algorithms/prng.js` | LCG, xorshift, PCG, splitmix, Mersenne Twister, distributions |
| `src/js/algorithms/id-generators.js` | UUID v4/v7, ULID, Snowflake |
| `src/js/machines/number-lab.js` | Exact references and error tracking |
| `src/js/viz/bit-view.js` | Bit-field rendering with per-bit interaction |

---

## Acceptance criteria

- [ ] Every bit trick is validated exhaustively over 16-bit inputs and randomly over 32-bit inputs
      against a naive reference.
- [ ] `ulp` and `nextAfter` are correct at zero, subnormal boundaries, powers of two and infinity.
- [ ] Compensated summation is asserted against an exact rational sum on inputs where naive
      summation loses more than 1% — the naive version must fail the same assertion.
- [ ] Bignum operations agree with `BigInt` over randomised operands including zero, one-limb and
      sign-boundary cases.
- [ ] Miller–Rabin's deterministic witness set is verified against a prime table and Carmichael
      fixtures.
- [ ] The uniformity tests pass for the unbiased sampler and fail for the modulo version, both
      asserted.
- [ ] Snowflake IDs remain monotonic and unique under a scripted clock regression.

---

## Sources

- IEEE 754-2019 — the standard itself
- Goldberg — *What every computer scientist should know about floating-point arithmetic*
- Muller et al. — *Handbook of Floating-Point Arithmetic*
- Warren — *Hacker's Delight*
- Knuth — *The Art of Computer Programming*, volume 2
- O'Neill — *PCG: a family of simple fast space-efficient statistically good algorithms for random number generation*
- Lemire — *Fast random integer generation in an interval*
