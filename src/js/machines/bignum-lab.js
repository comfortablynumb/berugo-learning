/**
 * BignumLab - the harness for arbitrary precision and the number theory built
 * on it (M17.7 and M17.8).
 *
 * The oracle throughout is `BigInt`. Every limb-level result is compared
 * against the same computation done by the engine, and the comparison is a
 * reported count rather than an exception - a multiplication that is wrong in
 * one limb produces a number that looks exactly as plausible as the right one,
 * and a harness that throws on the first mismatch cannot say whether the bug
 * fires once or on every input.
 *
 * The crossover measurement deserves a warning, because it is the one people
 * quote wrongly. Karatsuba does asymptotically fewer *limb multiplications*
 * and strictly more additions, allocations and recursive calls, so the three
 * columns cross at three different sizes: multiplications at 128 bits, total
 * limb work at 2 048, and wall-clock time not at all within the range the
 * demo sweeps. All three are reported, because picking the flattering column
 * is how "Karatsuba wins above eight limbs" became something people repeat.
 *
 * On the number-theory side the interesting comparisons are all
 * "same answer, wildly different cost": trial division against Pollard's rho
 * on a semiprime, the plain sieve against the linear sieve, Euclid against
 * Stein. And one comparison is "same cost, different answer" - the Fermat test
 * against Miller-Rabin on a Carmichael number, which is the whole reason the
 * second test exists.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.BignumLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Big = scope && scope.Bignum ? scope.Bignum : require('../algorithms/bignum.js');
  const Theory = scope && scope.NumberTheory ? scope.NumberTheory
    : require('../algorithms/number-theory.js');
  const Bench = scope && scope.BenchHarness ? scope.BenchHarness
    : require('./bench-harness.js');
  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* -------------------------------------------------- 17.7 arbitrary precision */

  /** A random integer of exactly `bits` bits, so the size sweep is honest. */
  function randomInteger(bits, rng) {
    let value = 1n;
    for (let i = 1; i < bits; i += 1) value = (value << 1n) | BigInt(rng.int(2));
    return value;
  }

  const ALGORITHMS = [
    { id: 'schoolbook', label: 'schoolbook', kernel: 'schoolbook' },
    { id: 'karatsuba', label: 'Karatsuba', kernel: 'karatsuba' }
  ];

  /**
   * One multiplication, both ways, against `BigInt`. `limbOps` is the
   * multiplication count and `adds` the addition count, and they move in
   * opposite directions - which is the entire content of the crossover.
   */
  function multiplicationRun(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 31);
    const bits = settings.bits || 512;
    const a = randomInteger(bits, rng);
    const b = randomInteger(bits, rng);
    const expected = a * b;

    return {
      bits: bits,
      limbs: Big.fromBigInt(a).limbs.length,
      rows: ALGORITHMS.map(function (algorithm) {
        const stats = Big.counter();
        const product = Big.mul(Big.fromBigInt(a), Big.fromBigInt(b),
          { algorithm: algorithm.kernel, stats: stats });
        return {
          id: algorithm.id, label: algorithm.label,
          limbOps: stats.limbOps, adds: stats.adds, allocations: stats.allocations,
          correct: Big.toBigInt(product) === expected
        };
      })
    };
  }

  /**
   * The crossover sweep. Three columns per size because the answer differs by
   * column: limb multiplications cross early, total limb-level work crosses
   * later, and wall-clock time is the one a caller actually pays.
   */
  function crossoverSweep(options) {
    const settings = options || {};
    const sizes = settings.sizes || [64, 128, 256, 512, 1024, 2048, 4096];
    const rng = Random.seeded(settings.seed || 31);
    const harness = Bench.createHarness({ runs: settings.runs || 7, warmup: 2, sink: true });

    return sizes.map(function (bits) {
      return crossoverRow(bits, rng, harness);
    });
  }

  function crossoverRow(bits, rng, harness) {
    const a = Big.fromBigInt(randomInteger(bits, rng));
    const b = Big.fromBigInt(randomInteger(bits, rng));
    const counts = ALGORITHMS.map(function (algorithm) {
      const stats = Big.counter();
      Big.mul(a, b, { algorithm: algorithm.kernel, stats: stats });
      return { id: algorithm.id, limbOps: stats.limbOps, adds: stats.adds,
        total: stats.limbOps + stats.adds };
    });
    const timings = ALGORITHMS.map(function (algorithm) {
      return harness.run({ label: algorithm.id,
        task: function () { return Big.mul(a, b, { algorithm: algorithm.kernel }); } }).medianMs;
    });
    const native = harness.run({ label: 'BigInt',
      task: function () { return Big.toBigInt(a) * Big.toBigInt(b); } }).medianMs;

    return {
      bits: bits, limbs: a.limbs.length,
      schoolbookOps: counts[0].limbOps, karatsubaOps: counts[1].limbOps,
      schoolbookTotal: counts[0].total, karatsubaTotal: counts[1].total,
      schoolbookMs: timings[0], karatsubaMs: timings[1], nativeMs: native,
      opsRatio: counts[0].limbOps / Math.max(1, counts[1].limbOps),
      totalRatio: counts[0].total / Math.max(1, counts[1].total),
      timeRatio: timings[0] / Math.max(1e-9, timings[1])
    };
  }

  /**
   * Division against `BigInt` over randomised operands, including the
   * boundary cases a hand-written test skips: a one-limb divisor, a divisor
   * larger than the numerator, and operands that differ by one limb.
   */
  function divisionAudit(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 37);
    const trials = settings.trials || 4000;
    const state = { wrongQuotients: 0, wrongRemainders: 0, addBacks: 0, examples: [] };

    for (let i = 0; i < trials; i += 1) {
      const numeratorBits = 1 + rng.int(settings.maximumBits || 400);
      const denominatorBits = 1 + rng.int(numeratorBits + 16);
      divisionTrial(randomInteger(numeratorBits, rng), randomInteger(denominatorBits, rng), state);
    }
    return {
      trials: trials,
      wrongQuotients: state.wrongQuotients,
      wrongRemainders: state.wrongRemainders,
      addBacks: state.addBacks,
      addBackRate: state.addBacks / trials,
      examples: state.examples
    };
  }

  function divisionTrial(a, b, state) {
    const result = Big.div(Big.fromBigInt(a), Big.fromBigInt(b));
    const quotient = Big.toBigInt(result.quotient);
    const remainder = Big.toBigInt(result.remainder);
    state.addBacks += result.addBacks;
    if (quotient !== a / b) state.wrongQuotients += 1;
    if (remainder !== a % b) state.wrongRemainders += 1;
    if (result.addBacks > 0 && state.examples.length < 4) {
      state.examples.push({ numeratorBits: a.toString(2).length,
        denominatorBits: b.toString(2).length, addBacks: result.addBacks });
    }
  }

  /**
   * The add-back is famously rare, and "rare" has to be a number or the claim
   * is folklore. The divisors here are deliberately multi-limb and normalised
   * at the top - a single-limb divisor takes the short path and can never
   * reach the correction at all, which is how an earlier version of this
   * search reported zero and proved nothing.
   *
   * The measured rate is about one add-back per half-million quotient digits,
   * which is the point: a division routine that omits the correction passes
   * every test built from random operands. `fixtures` runs the two operand
   * pairs that trigger it every time, so the branch is exercised deliberately
   * rather than hopefully.
   */
  function addBackSearch(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 101);
    const budget = settings.budget || 200000;
    const state = { addBacks: 0, firstAt: null, digits: 0, wrong: 0 };

    for (let i = 0; i < budget; i += 1) searchOne(rng, i, state);
    return {
      budget: budget,
      addBacks: state.addBacks,
      firstAt: state.firstAt,
      quotientDigits: state.digits,
      wrong: state.wrong,
      ratePerDigit: state.addBacks / Math.max(1, state.digits),
      knuthEstimate: 2 / Big.BASE,
      fixtures: fixtureRuns()
    };
  }

  /** A divisor whose top limb is at least half the base, so the normalising
   *  shift is zero and the estimate is at its most delicate. */
  function normalisedLimbs(count, rng) {
    const limbs = [];
    for (let i = 0; i < count; i += 1) limbs.push(rng.int(Big.BASE));
    limbs[count - 1] = (Big.BASE / 2) + rng.int(Big.BASE / 2);
    return limbs;
  }

  function searchOne(rng, index, state) {
    const divisorLimbs = 2 + rng.int(3);
    const numeratorLimbs = divisorLimbs + 1 + rng.int(3);
    const a = Big.toBigInt({ sign: 1, limbs: normalisedLimbs(numeratorLimbs, rng) });
    const b = Big.toBigInt({ sign: 1, limbs: normalisedLimbs(divisorLimbs, rng) });
    const result = Big.div(Big.fromBigInt(a), Big.fromBigInt(b));

    state.digits += result.quotient.limbs.length;
    if (Big.toBigInt(result.quotient) !== a / b) state.wrong += 1;
    if (Big.toBigInt(result.remainder) !== a % b) state.wrong += 1;
    if (result.addBacks === 0) return;
    state.addBacks += result.addBacks;
    if (state.firstAt === null) state.firstAt = index + 1;
  }

  function fixtureRuns() {
    return Big.ADD_BACK_FIXTURES.map(function (fixture) {
      const a = Big.toBigInt({ sign: 1, limbs: fixture.u });
      const b = Big.toBigInt({ sign: 1, limbs: fixture.v });
      const result = Big.div(Big.fromBigInt(a), Big.fromBigInt(b));
      return {
        label: fixture.label,
        addBacks: result.addBacks,
        quotientCorrect: Big.toBigInt(result.quotient) === a / b,
        remainderCorrect: Big.toBigInt(result.remainder) === a % b
      };
    });
  }

  /** The limbs of a small multiplication, for the stepper to display. */
  function limbTrace(a, b) {
    const left = Big.fromBigInt(BigInt(a));
    const right = Big.fromBigInt(BigInt(b));
    const partials = [];
    for (let i = 0; i < left.limbs.length; i += 1) {
      const row = [];
      let carry = 0;
      for (let j = 0; j < right.limbs.length; j += 1) {
        const value = left.limbs[i] * right.limbs[j] + carry;
        row.push({ index: i + j, product: left.limbs[i] * right.limbs[j],
          low: value & (Big.BASE - 1), carry: Math.floor(value / Big.BASE) });
        carry = Math.floor(value / Big.BASE);
      }
      partials.push({ limb: i, digit: left.limbs[i], row: row });
    }
    return {
      left: left.limbs, right: right.limbs, base: Big.BASE,
      partials: partials,
      product: Big.toBigInt(Big.mul(left, right)),
      expected: BigInt(a) * BigInt(b)
    };
  }

  /** Modular exponentiation, plain and in Montgomery form, both checked. */
  function modPowRun(options) {
    const settings = options || {};
    const modulus = BigInt(settings.modulus || 1000000007);
    const base = BigInt(settings.base || 3);
    const exponent = BigInt(settings.exponent || 123456789);
    const plain = Big.modPow(base % modulus, exponent, modulus);
    const montgomery = Big.montgomeryPow(base % modulus, exponent, modulus);

    return {
      modulus: modulus, base: base, exponent: exponent,
      value: plain.value,
      agree: plain.value === montgomery.value,
      exponentBits: exponent.toString(2).length,
      setBits: exponent.toString(2).replace(/0/g, '').length,
      plain: plain.stats,
      montgomery: montgomery.stats,
      /* The squaring count is the exponent's bit length and the multiplication
         count is its population count - which is why a public exponent of
         65537, with two set bits, is chosen and a private one is not. */
      squaringsMatchBits: plain.stats.squarings === exponent.toString(2).length,
      multipliesMatchPopcount: plain.stats.multiplications ===
        exponent.toString(2).replace(/0/g, '').length
    };
  }

  /* --------------------------------------------------- 17.8 number theory */

  /** Trial division against Pollard's rho on the same number. */
  function factorRace(value, options) {
    const settings = options || {};
    const n = BigInt(value);
    const trial = Theory.trialDivision(n, settings.trialBudget || 5000000);
    const rho = Theory.pollardRho(n, { budget: settings.rhoBudget || 400000 });
    const full = Theory.factorise(n, { trialBudget: 2000 });

    return {
      value: n,
      factors: full.factors,
      complete: full.complete,
      trialOperations: trial.operations,
      trialComplete: trial.complete,
      rhoOperations: rho.operations,
      rhoFactor: rho.factor,
      rhoExhausted: !!rho.exhausted,
      speedup: rho.factor === null ? null : trial.operations / Math.max(1, rho.operations),
      smallestFactor: full.factors.length > 0 ? full.factors[0] : null
    };
  }

  /** A semiprime of two primes of the given bit size - rho's hard case, and
   *  the shape every RSA modulus has for exactly this reason. */
  function semiprime(bits, seed) {
    const rng = Random.seeded(seed || 43);
    return nextPrimeAt(bits, rng) * nextPrimeAt(bits, rng);
  }

  function nextPrimeAt(bits, rng) {
    let candidate = randomInteger(bits, rng) | 1n;
    while (!Theory.millerRabin(candidate).prime) candidate += 2n;
    return candidate;
  }

  /**
   * The Fermat test and Miller-Rabin on the same numbers. On a Carmichael
   * number every coprime base passes the Fermat test, so the "probability" of
   * a false positive is one - and Miller-Rabin's extra condition catches it
   * with the smallest base it tries.
   */
  function primalityTable(options) {
    const settings = options || {};
    const numbers = settings.numbers || Theory.CARMICHAEL.slice(0, 8);
    return numbers.map(function (n) { return primalityRow(BigInt(n)); });
  }

  function primalityRow(n) {
    let coprimeBases = 0;
    let fermatPasses = 0;
    for (let base = 2n; base < n && base < 4000n; base += 1n) {
      const result = Theory.fermatTest(n, base);
      if (result.shared) continue;
      coprimeBases += 1;
      if (result.passes) fermatPasses += 1;
    }
    /* The witness has to come from the Miller-Rabin rounds themselves.
       `millerRabin` trial-divides by the small primes first and returns
       whichever of those divides n - for 561 that is 3, which is a FACTOR and
       not a Miller-Rabin witness at all. Reporting it in a column headed
       "witness" beside a column of Miller-Rabin results is two true numbers
       that read as one wrong one. */
    const trail = millerRabinTrail(n);
    return {
      n: n,
      factors: Theory.factorise(n).factors,
      coprimeBases: coprimeBases,
      fermatPasses: fermatPasses,
      fermatFoolRate: coprimeBases === 0 ? 0 : fermatPasses / coprimeBases,
      millerSaysPrime: trail.prime,
      millerWitness: trail.witness,
      millerReason: trail.reason,
      witnessSet: Theory.witnessesFor(n).length
    };
  }

  /** The witness trail for one number: what each base decided and why. */
  function millerRabinTrail(value, bases) {
    const n = BigInt(value);
    const chosen = bases || Theory.witnessesFor(n);
    const rows = [];
    for (let i = 0; i < chosen.length; i += 1) {
      const round = Theory.millerRabinRound(n, chosen[i] % n === 0n ? 2n : chosen[i]);
      rows.push({ base: chosen[i], probablePrime: round.probablePrime,
        reason: round.reason || 'passed', squarings: round.rounds,
        trail: round.trail.map(function (step) { return step.value; }) });
      if (!round.probablePrime) break;
    }
    /* The verdict comes from THIS trail rather than from a fresh call, because
       `millerRabin` short-circuits on trial division by the small primes and
       would report a different witness from the one the rows show. Two
       correct answers that disagree about the reason are worse in a teaching
       table than one answer with its working shown. */
    const caught = rows.filter(function (row) { return !row.probablePrime; })[0];
    return { n: n, rows: rows, prime: !caught, witness: caught ? caught.base : null,
      reason: caught ? caught.reason : null,
      agreesWithFullTest: !caught === Theory.millerRabin(n, bases).prime,
      deterministic: !bases, witnessCount: chosen.length };
  }

  /** The two sieves on the same limit: same primes, different write counts. */
  function sieveRace(limit) {
    const classic = Theory.sieveEratosthenes(limit);
    const linear = Theory.linearSieve(limit);
    return {
      limit: limit,
      primes: classic.primes.length,
      agree: classic.primes.length === linear.primes.length &&
        classic.primes[classic.primes.length - 1] === linear.primes[linear.primes.length - 1],
      classicWrites: classic.writes,
      linearWrites: linear.writes,
      writeRatio: classic.writes / Math.max(1, linear.writes),
      classicBytes: classic.bytes,
      linearBytes: linear.bytes,
      byteRatio: linear.bytes / Math.max(1, classic.bytes)
    };
  }

  /** Euclid against Stein on the same pairs. */
  function gcdRace(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 47);
    let euclidSteps = 0;
    let binarySteps = 0;
    let disagreements = 0;

    for (let i = 0; i < (settings.trials || 5000); i += 1) {
      const a = randomInteger(1 + rng.int(settings.bits || 64), rng);
      const b = randomInteger(1 + rng.int(settings.bits || 64), rng);
      const euclid = Theory.gcd(a, b);
      const binary = Theory.binaryGcd(a, b);
      euclidSteps += euclid.steps;
      binarySteps += binary.steps;
      if (euclid.value !== binary.value) disagreements += 1;
    }
    return { trials: settings.trials || 5000, euclidSteps: euclidSteps,
      binarySteps: binarySteps, disagreements: disagreements,
      euclidMean: euclidSteps / (settings.trials || 5000),
      binaryMean: binarySteps / (settings.trials || 5000) };
  }

  /**
   * The Chinese remainder theorem as a reconstruction: split a value into its
   * residues modulo several coprime numbers, then rebuild it. The rebuilt
   * value has to be the original, and the moduli's product has to exceed it -
   * which is the condition people forget, and the one that makes the answer
   * silently wrong when it fails.
   */
  function crtRun(value, moduli) {
    const n = BigInt(value);
    const congruences = moduli.map(function (modulus) {
      return { residue: n % BigInt(modulus), modulus: BigInt(modulus) };
    });
    const rebuilt = Theory.crt(congruences);
    return {
      value: n,
      congruences: congruences,
      rebuilt: rebuilt.value,
      modulus: rebuilt.modulus,
      wideEnough: rebuilt.modulus !== null && rebuilt.modulus > n,
      correct: rebuilt.value === n,
      steps: rebuilt.steps || []
    };
  }

  return {
    ALGORITHMS: ALGORITHMS,
    randomInteger: randomInteger,
    multiplicationRun: multiplicationRun,
    crossoverSweep: crossoverSweep,
    divisionAudit: divisionAudit,
    addBackSearch: addBackSearch,
    limbTrace: limbTrace,
    modPowRun: modPowRun,
    factorRace: factorRace,
    semiprime: semiprime,
    primalityTable: primalityTable,
    millerRabinTrail: millerRabinTrail,
    sieveRace: sieveRace,
    gcdRace: gcdRace,
    crtRun: crtRun
  };
}));
