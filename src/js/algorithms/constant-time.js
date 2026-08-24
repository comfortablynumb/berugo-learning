/**
 * Constant-time programming: two rules, and a measurement that checks them.
 *
 * ⚠ TEACHING CODE. JavaScript cannot make hard timing guarantees — the JIT,
 * garbage collection and the engine's own optimisations all move code around —
 * so these implementations demonstrate the PATTERNS rather than deliver the
 * guarantee. In a language where it matters the same patterns apply and the
 * same measurement is how you check them.
 *
 * The two rules are short enough to memorise:
 *
 * 1. **Never branch on a secret.** A conditional whose predicate depends on
 *    secret data takes different time down each path, and the difference is
 *    measurable — remotely, with enough samples.
 * 2. **Never index memory with a secret.** A table lookup at a secret offset
 *    touches a cache line an attacker can detect through their own timings,
 *    which is Bernstein's attack on table-driven AES.
 *
 * The replacement for both is arithmetic: compute a MASK from the condition and
 * combine both branches with it, so every input takes exactly the same path.
 * The demo attacks a naive comparison byte by byte, recovers a secret token,
 * and then fails against the branchless one — with both timing distributions
 * measured rather than asserted.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ConstantTime = api;
}(this, function () {
  'use strict';

  const DISCLAIMER = 'Teaching implementation: JavaScript cannot guarantee constant time; the '
    + 'patterns are the lesson, not this code.';

  /* ------------------------------------------------------- the primitives */

  /** All ones when the condition is 1, all zeros when it is 0 — computed
   *  arithmetically, with no branch anywhere. */
  function mask(condition) {
    return (-(condition & 1)) >>> 0;
  }

  /** Branchless select: both values are read, and the mask decides which
   *  survives. A ternary would compile to a branch on the secret. */
  function select(condition, whenTrue, whenFalse) {
    const m = mask(condition);

    return ((whenTrue & m) | (whenFalse & ~m)) >>> 0;
  }

  /** 1 if the two 32-bit values are equal, 0 otherwise, with no comparison
   *  operator on the secret. The trick is that x − 1 has its top bit set
   *  exactly when x is zero, after the OR with −x. */
  function equalWords(a, b) {
    const difference = (a ^ b) >>> 0;

    return (((difference | (-difference >>> 0)) >>> 31) ^ 1) & 1;
  }

  /** 1 when a < b for unsigned 32-bit values, branchlessly — the borrow out of
   *  the subtraction, recovered arithmetically (Hacker's Delight 2-12). */
  function lessThan(a, b) {
    const x = a | 0;
    const y = b | 0;

    return ((((~x & y) | (~(x ^ y) & (x - y))) >>> 31) & 1);
  }

  /**
   * The comparison that matters. Every byte is examined, the differences
   * accumulate in one accumulator, and the answer depends on the accumulator
   * at the end — so the running time is a function of the LENGTH and nothing
   * else.
   */
  function equals(a, b) {
    if (a.length !== b.length) return false;
    let difference = 0;

    for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
    return difference === 0;
  }

  /** The one that leaks: it returns as soon as it finds a difference, so its
   *  running time is the length of the matching prefix. That is the oracle. */
  function naiveEquals(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /** How many leading bytes matched — the quantity the naive comparison leaks
   *  through its timing, made explicit so the attack model is checkable. */
  function sharedPrefix(a, b) {
    let count = 0;

    while (count < a.length && count < b.length && a[count] === b[count]) count += 1;
    return count;
  }

  /* --------------------------------------------------- secret-indexed reads */

  /**
   * A table lookup that touches EVERY entry and keeps the one it wanted. It is
   * O(table size) per access rather than O(1), which is why real code uses it
   * only for small tables — and why AES implementations that want to be
   * constant-time use bitslicing or a hardware instruction instead.
   */
  function lookup(table, index) {
    let result = 0;

    for (let i = 0; i < table.length; i += 1) {
      result |= table[i] & mask(equalWords(i, index));
    }
    return result >>> 0;
  }

  /** The version that leaks through the cache: one access, at a secret offset. */
  function naiveLookup(table, index) {
    return table[index];
  }

  /* ------------------------------------------------------- the measurement */

  /**
   * A model of what an attacker measures. Real timing attacks need thousands of
   * samples to see past the noise, and modelling that honestly matters: the
   * signal here is the work the comparison does, plus noise, and the attack
   * succeeds by averaging rather than by reading one clean number.
   */
  function timeComparison(config) {
    const samples = config.samples === undefined ? 200 : config.samples;
    const rng = config.rng;
    const noise = config.noise === undefined ? 1.2 : config.noise;
    let total = 0;

    for (let i = 0; i < samples; i += 1) {
      const work = config.compare(config.secret, config.guess);

      total += work + (rng.next() - 0.5) * 2 * noise;
    }
    return total / samples;
  }

  /** The naive comparison's cost model: it stops at the first difference. */
  function naiveWork(secret, guess) {
    return sharedPrefix(secret, guess) + 1;
  }

  /** The constant-time one always walks the whole buffer. */
  function constantWork(secret, guess) {
    return secret.length;
  }

  /**
   * The attack: for each position, try all 256 byte values and keep the one
   * whose average measured time is highest, because a correct byte makes the
   * comparison run one step further. Byte by byte, the secret falls out — and
   * the whole search is 16 × 256 rather than 2^128.
   */
  function timingAttack(config) {
    const secret = config.secret;
    const recovered = [];
    let measurements = 0;

    for (let position = 0; position < secret.length; position += 1) {
      let best = { byte: 0, time: -Infinity };

      for (let candidate = 0; candidate < 256; candidate += 1) {
        const guess = recovered.concat([candidate])
          .concat(new Array(secret.length - position - 1).fill(0));
        const time = timeComparison({ secret: secret, guess: guess,
          compare: config.compare, rng: config.rng, samples: config.samples,
          noise: config.noise });

        measurements += config.samples === undefined ? 200 : config.samples;
        if (time > best.time) best = { byte: candidate, time: time };
      }
      recovered.push(best.byte);
    }
    return {
      recovered: recovered,
      measurements: measurements,
      succeeded: recovered.every(function (byte, i) { return byte === secret[i]; }),
      searchSpace: secret.length * 256,
      bruteForce: Math.pow(2, secret.length * 8)
    };
  }

  /**
   * The distributions the attacker is separating: mean and spread of the
   * measured cost for a right byte and a wrong one. If the two overlap
   * completely there is no signal, which is what the constant-time version
   * should produce.
   */
  function timingProfile(config) {
    const secret = config.secret;
    const right = [];
    const wrong = [];

    for (let trial = 0; trial < (config.trials === undefined ? 60 : config.trials); trial += 1) {
      const good = secret.slice(0, 1).concat(new Array(secret.length - 1).fill(0));
      const bad = [(secret[0] + 1) & 0xff].concat(new Array(secret.length - 1).fill(0));

      right.push(timeComparison({ secret: secret, guess: good, compare: config.compare,
        rng: config.rng, samples: config.samples, noise: config.noise }));
      wrong.push(timeComparison({ secret: secret, guess: bad, compare: config.compare,
        rng: config.rng, samples: config.samples, noise: config.noise }));
    }
    return {
      right: summarise(right), wrong: summarise(wrong),
      separation: Math.abs(summarise(right).mean - summarise(wrong).mean)
        / Math.max(1e-9, summarise(right).deviation + summarise(wrong).deviation)
    };
  }

  function summarise(values) {
    const mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    let variance = 0;

    values.forEach(function (value) { variance += (value - mean) * (value - mean); });
    return { mean: mean, deviation: Math.sqrt(variance / Math.max(1, values.length - 1)),
      samples: values.length };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    mask: mask, select: select, equalWords: equalWords, lessThan: lessThan,
    equals: equals, naiveEquals: naiveEquals, sharedPrefix: sharedPrefix,
    lookup: lookup, naiveLookup: naiveLookup,
    timeComparison: timeComparison, naiveWork: naiveWork, constantWork: constantWork,
    timingAttack: timingAttack, timingProfile: timingProfile, summarise: summarise
  };
}));
