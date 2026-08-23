/**
 * The arithmetic that cryptography, hashing and the Chinese-remainder tricks
 * in the data-systems track are all built from.
 *
 * Two things here are worth stating up front because they are where the
 * material is usually taught wrongly.
 *
 * **A Fermat test is not a primality test.** It checks that a^(n-1) = 1 mod n
 * for some base a, which every prime satisfies - and so does every Carmichael
 * number, for every base coprime to n. 561, 1105 and 1729 pass the Fermat test
 * against every base they do not share a factor with, so a "probabilistic
 * primality test" built on Fermat is not probabilistic at all on those inputs:
 * it is wrong with certainty. Miller-Rabin closes the hole by looking at the
 * square roots of one along the way, and this module runs both so the
 * difference is a column in a table rather than a footnote.
 *
 * **Miller-Rabin can be deterministic.** The "probable prime" framing is about
 * random bases on arbitrary inputs. For a bounded range, small fixed witness
 * sets have been verified exhaustively, and for anything below 2^64 twelve
 * fixed bases decide primality outright. A 64-bit primality check needs no
 * randomness and no probability, and quoting an error rate for it is a
 * misunderstanding worth costing a paragraph to remove.
 *
 * Everything operates on BigInt. Trial division and the sieves would be faster
 * on numbers, but a module that changes its type at 2^53 has a seam in the
 * middle of the material it is teaching about; the sieves take a Number bound
 * because a sieve of 10^7 entries is a typed array either way.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.NumberTheory = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Big = scope && scope.Bignum ? scope.Bignum : require('./bignum.js');

  function absBig(value) { return value < 0n ? -value : value; }

  /* ------------------------------------------------------------------ gcd */

  function gcd(a, b) {
    let x = absBig(a);
    let y = absBig(b);
    let steps = 0;
    while (y !== 0n) { const t = x % y; x = y; y = t; steps += 1; }
    return { value: x, steps: steps };
  }

  /**
   * Stein's binary gcd: no division at all, only subtraction and shifts.
   * It does more iterations than Euclid and each is far cheaper, which is the
   * trade - and on hardware without a divider it is the only option.
   */
  function binaryGcd(a, b) {
    let x = absBig(a);
    let y = absBig(b);
    if (x === 0n) return { value: y, steps: 0 };
    if (y === 0n) return { value: x, steps: 0 };
    let shift = 0n;
    let steps = 0;
    while (((x | y) & 1n) === 0n) { x >>= 1n; y >>= 1n; shift += 1n; steps += 1; }
    while ((x & 1n) === 0n) { x >>= 1n; steps += 1; }
    while (y !== 0n) {
      while ((y & 1n) === 0n) { y >>= 1n; steps += 1; }
      if (x > y) { const t = x; x = y; y = t; }
      y -= x;
      steps += 1;
    }
    return { value: x << shift, steps: steps };
  }

  /** Bezout's identity as a computation: g = a*x + b*y. */
  function extendedGcd(a, b) {
    let previous = absBig(a);
    let current = absBig(b);
    let px = 1n, cx = 0n, py = 0n, cy = 1n;
    let steps = 0;

    while (current !== 0n) {
      const quotient = previous / current;
      const nextValue = previous - quotient * current;
      const nextX = px - quotient * cx;
      const nextY = py - quotient * cy;
      previous = current; current = nextValue;
      px = cx; cx = nextX;
      py = cy; cy = nextY;
      steps += 1;
    }
    return { g: previous, x: px, y: py, steps: steps };
  }

  function modInverse(value, modulus) {
    const found = extendedGcd(((value % modulus) + modulus) % modulus, modulus);
    if (found.g !== 1n) return null;
    return ((found.x % modulus) + modulus) % modulus;
  }

  /**
   * The Chinese remainder theorem: congruences with pairwise coprime moduli
   * pin down exactly one residue modulo their product. Combined pairwise so
   * the intermediate values stay small, and returning null the moment two
   * moduli are not coprime rather than producing a plausible wrong answer.
   */
  function crt(congruences) {
    let residue = 0n;
    let modulus = 1n;
    const steps = [];

    for (let i = 0; i < congruences.length; i += 1) {
      const item = congruences[i];
      const inverse = modInverse(modulus % item.modulus, item.modulus);
      if (inverse === null) return { value: null, modulus: null, reason: 'moduli are not coprime' };
      const difference = ((item.residue - residue) % item.modulus + item.modulus) % item.modulus;
      residue += modulus * ((difference * inverse) % item.modulus);
      modulus *= item.modulus;
      residue = ((residue % modulus) + modulus) % modulus;
      steps.push({ residue: residue, modulus: modulus });
    }
    return { value: residue, modulus: modulus, steps: steps };
  }

  function modPow(base, exponent, modulus) {
    return Big.modPow(((base % modulus) + modulus) % modulus, exponent, modulus).value;
  }

  /* ------------------------------------------------------------- testing */

  /** a^(n-1) mod n. One for a prime, and one for a Carmichael number too. */
  function fermatTest(n, base) {
    if (n < 2n) return { passes: false, value: null };
    if (gcd(base, n).value !== 1n) return { passes: false, value: null, shared: true };
    const value = modPow(base, n - 1n, n);
    return { passes: value === 1n, value: value };
  }

  const CARMICHAEL = [561n, 1105n, 1729n, 2465n, 2821n, 6601n, 8911n, 10585n, 15841n,
    29341n, 41041n, 46657n, 52633n, 62745n, 63973n, 75361n];

  /**
   * The witness sets that make Miller-Rabin deterministic below a bound. Each
   * has been verified exhaustively against every composite under its limit;
   * they are facts about the integers, not heuristics.
   */
  const WITNESS_SETS = [
    { below: 2047n, bases: [2n] },
    { below: 1373653n, bases: [2n, 3n] },
    { below: 9080191n, bases: [31n, 73n] },
    { below: 25326001n, bases: [2n, 3n, 5n] },
    { below: 3215031751n, bases: [2n, 3n, 5n, 7n] },
    { below: 4759123141n, bases: [2n, 7n, 61n] },
    { below: 1122004669633n, bases: [2n, 13n, 23n, 1662803n] },
    { below: 3474749660383n, bases: [2n, 3n, 5n, 7n, 11n, 13n] },
    { below: 341550071728321n, bases: [2n, 3n, 5n, 7n, 11n, 13n, 17n] },
    { below: 3825123056546413051n, bases: [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n] },
    { below: 18446744073709551616n,
      bases: [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n] }
  ];

  function witnessesFor(n) {
    for (let i = 0; i < WITNESS_SETS.length; i += 1) {
      if (n < WITNESS_SETS[i].below) return WITNESS_SETS[i].bases;
    }
    return WITNESS_SETS[WITNESS_SETS.length - 1].bases;
  }

  /**
   * One Miller-Rabin round. Write n - 1 as d * 2^s; a composite is caught
   * unless a^d is already 1 or one of the s squarings passes through -1. That
   * second condition is the whole difference from Fermat: it is asking for a
   * *non-trivial square root of one*, which a prime modulus does not have.
   */
  function millerRabinRound(n, base) {
    const trail = [];
    let d = n - 1n;
    let s = 0;
    while ((d & 1n) === 0n) { d >>= 1n; s += 1; }

    let x = modPow(base, d, n);
    trail.push({ step: 'a^d', value: x });
    if (x === 1n || x === n - 1n) return { probablePrime: true, trail: trail, rounds: s };

    for (let i = 1; i < s; i += 1) {
      x = (x * x) % n;
      trail.push({ step: 'square ' + i, value: x });
      if (x === n - 1n) return { probablePrime: true, trail: trail, rounds: s };
      if (x === 1n) return { probablePrime: false, trail: trail, rounds: s, reason: 'a non-trivial square root of 1' };
    }
    return { probablePrime: false, trail: trail, rounds: s, reason: 'never reached −1' };
  }

  function millerRabin(n, bases) {
    if (n < 2n) return { prime: false, witness: null, tried: [] };
    const small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
    for (let i = 0; i < small.length; i += 1) {
      if (n === small[i]) return { prime: true, witness: null, tried: [], deterministic: true };
      if (n % small[i] === 0n) return { prime: false, witness: small[i], tried: [], trivial: true };
    }
    const chosen = bases || witnessesFor(n);
    const tried = [];
    for (let i = 0; i < chosen.length; i += 1) {
      const round = millerRabinRound(n, chosen[i] % n === 0n ? 2n : chosen[i]);
      tried.push({ base: chosen[i], probablePrime: round.probablePrime, reason: round.reason });
      if (!round.probablePrime) return { prime: false, witness: chosen[i], tried: tried };
    }
    return { prime: true, witness: null, tried: tried, deterministic: !bases };
  }

  /* -------------------------------------------------------------- sieves */

  /** The classic sieve, counting the writes so the "each composite is crossed
   *  out once per distinct prime factor" cost is visible. */
  function sieveEratosthenes(limit) {
    const marks = new Uint8Array(limit + 1);
    const primes = [];
    let writes = 0;
    for (let i = 2; i <= limit; i += 1) {
      if (marks[i] === 1) continue;
      primes.push(i);
      for (let j = i * i; j <= limit; j += i) { marks[j] = 1; writes += 1; }
    }
    return { primes: primes, marks: marks, writes: writes, bytes: limit + 1 };
  }

  /**
   * The linear sieve crosses each composite out exactly once, by only ever
   * marking it from its *smallest* prime factor. It also leaves that factor
   * behind, so factorising anything under the limit becomes a walk down an
   * array with no arithmetic at all.
   */
  function linearSieve(limit) {
    const smallest = new Int32Array(limit + 1);
    const primes = [];
    let writes = 0;
    for (let i = 2; i <= limit; i += 1) {
      if (smallest[i] === 0) { smallest[i] = i; primes.push(i); }
      for (let p = 0; p < primes.length; p += 1) {
        const prime = primes[p];
        if (prime > smallest[i] || prime * i > limit) break;
        smallest[prime * i] = prime;
        writes += 1;
      }
    }
    return { primes: primes, smallest: smallest, writes: writes, bytes: 4 * (limit + 1) };
  }

  /** Factorise using a linear sieve's smallest-factor table: no division by
   *  trial, just repeated lookups. */
  function factorBySieve(value, smallest) {
    const factors = [];
    let n = value;
    while (n > 1) { factors.push(smallest[n]); n = n / smallest[n]; }
    return factors;
  }

  /* ---------------------------------------------------------- factoring */

  function trialDivision(n, budget) {
    const limit = budget === undefined ? Infinity : budget;
    const factors = [];
    let value = absBig(n);
    let divisor = 2n;
    let operations = 0;

    while (divisor * divisor <= value && operations < limit) {
      operations += 1;
      if (value % divisor === 0n) { factors.push(divisor); value /= divisor; continue; }
      divisor += divisor === 2n ? 1n : 2n;
    }
    if (value > 1n && operations < limit) factors.push(value);
    return { factors: factors, operations: operations,
      complete: operations < limit, remaining: value };
  }

  /**
   * Pollard's rho. The sequence x -> x^2 + c mod n is a pseudorandom walk, so
   * by the birthday bound it repeats a residue modulo a factor p after about
   * sqrt(p) steps - long before it repeats modulo n. Floyd's tortoise and hare
   * detects that, and the gcd of the difference is the factor. The whole cost
   * is sqrt of the SMALLEST factor rather than of n, which is why it finds the
   * small factor of a large number instantly and why RSA moduli are two primes
   * of the same size.
   */
  function pollardRho(n, options) {
    const settings = options || {};
    const budget = settings.budget || 200000;
    if (n % 2n === 0n) return { factor: 2n, operations: 1, trivial: true };
    let c = BigInt(settings.c || 1);
    let attempts = 0;
    let operations = 0;

    while (attempts < (settings.restarts || 8)) {
      const run = rhoAttempt(n, c, budget - operations);
      operations += run.operations;
      if (run.factor !== null && run.factor !== n) {
        return { factor: run.factor, operations: operations, c: c, attempts: attempts + 1 };
      }
      c += 1n;
      attempts += 1;
      if (operations >= budget) break;
    }
    return { factor: null, operations: operations, exhausted: true, attempts: attempts };
  }

  function rhoAttempt(n, c, budget) {
    let tortoise = 2n;
    let hare = 2n;
    let divisor = 1n;
    let operations = 0;
    const step = function (x) { return (x * x + c) % n; };

    while (divisor === 1n && operations < budget) {
      tortoise = step(tortoise);
      hare = step(step(hare));
      divisor = gcd(absBig(tortoise - hare), n).value;
      operations += 1;
    }
    if (divisor === 1n || divisor === n) return { factor: null, operations: operations };
    return { factor: divisor, operations: operations };
  }

  /** Full factorisation: peel small factors by trial division, then recurse
   *  with rho on what is left. */
  function factorise(n, options) {
    const settings = options || {};
    const small = trialDivision(absBig(n), settings.trialBudget || 2000);

    /* Trial division either finished - in which case its factor list is the
       whole answer, final cofactor included - or ran out of budget with the
       small factors already peeled off and the hard part in `remaining`. */
    if (small.complete) {
      return { factors: small.factors, operations: small.operations, complete: true };
    }
    return rhoDescend(small.remaining, small.factors.slice(),
      { operations: small.operations, options: settings });
  }

  function rhoDescend(value, factors, state) {
    if (value === 1n) {
      factors.sort(function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); });
      return { factors: factors, operations: state.operations, complete: true };
    }
    if (millerRabin(value).prime) {
      factors.push(value);
      return rhoDescend(1n, factors, state);
    }
    const found = pollardRho(value, state.options);
    state.operations += found.operations;
    if (found.factor === null) {
      return { factors: factors, operations: state.operations, complete: false, remaining: value };
    }
    const left = rhoDescend(found.factor, factors, state);
    if (!left.complete) return left;
    return rhoDescend(value / found.factor, factors, state);
  }

  /** Euler's totient from the factorisation: how many residues below n are
   *  coprime to it, which is the exponent modular arithmetic runs in. */
  function totient(n) {
    const found = factorise(n);
    if (!found.complete) return null;
    let value = n;
    let previous = 0n;
    for (let i = 0; i < found.factors.length; i += 1) {
      const prime = found.factors[i];
      if (prime === previous) continue;
      previous = prime;
      value = (value / prime) * (prime - 1n);
    }
    return value;
  }

  return {
    CARMICHAEL: CARMICHAEL,
    WITNESS_SETS: WITNESS_SETS,
    gcd: gcd,
    binaryGcd: binaryGcd,
    extendedGcd: extendedGcd,
    modInverse: modInverse,
    crt: crt,
    modPow: modPow,
    fermatTest: fermatTest,
    witnessesFor: witnessesFor,
    millerRabinRound: millerRabinRound,
    millerRabin: millerRabin,
    sieveEratosthenes: sieveEratosthenes,
    linearSieve: linearSieve,
    factorBySieve: factorBySieve,
    trialDivision: trialDivision,
    pollardRho: pollardRho,
    factorise: factorise,
    totient: totient
  };
}));
