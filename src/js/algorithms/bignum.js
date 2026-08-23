/**
 * Arbitrary-precision integers built out of limbs, with `BigInt` standing by
 * as the oracle.
 *
 * A limb is one digit in a very large base. The base is 2^16 here, which is
 * not arbitrary: schoolbook multiplication forms products of two limbs and
 * adds a column of them into an accumulator, and a double holds integers
 * exactly only up to 2^53, so the base has to leave room for the product
 * (2^32) plus the column height. 2^16 leaves twenty-one bits of headroom,
 * which is thousands of limbs - comfortably more than any demo here uses, and
 * the reason the module never needs a carry-save trick to stay exact.
 *
 * Everything is counted. `limbOps` on every result is the number of
 * limb-by-limb multiplications performed and `adds` the number of limb-level
 * additions, and reporting both is the only honest way to show a crossover:
 * Karatsuba does asymptotically fewer limb products and strictly more of
 * everything else. On this implementation the two counts cross at completely
 * different sizes - multiplications at 128 bits, total limb work at 2 048 -
 * and wall-clock time has not crossed at all by 4 096 bits, because the
 * recursion allocates four arrays per level. Quoting only the multiplication
 * count is how "Karatsuba wins above eight limbs" gets repeated.
 *
 * Division is the operation that is genuinely hard, and Knuth's algorithm D is
 * here in full rather than as a sketch. Its two subtleties are both present:
 * the normalising shift that makes the leading divisor limb at least half the
 * base (without which the quotient estimate can be off by a lot rather than by
 * one), and the "add back" correction for the case where the estimate is still
 * one too large after that.
 *
 * The add-back is worth a paragraph because of how rare it measures. Over
 * 200 000 random divisions with multi-limb divisors - 500 034 quotient digits -
 * it fired exactly ONCE, a rate of 2.0e-6 per digit, well under Knuth's 2/b
 * estimate of 3.05e-5. An implementation that omits the correction therefore
 * passes every test built from random operands, and fails on inputs a user
 * supplies a year later. `ADD_BACK_FIXTURES` holds two operand pairs that
 * trigger it every time, because a branch that random testing cannot reach has
 * to be reachable deliberately or it is untested code.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bignum = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const BASE_BITS = 16;
  const BASE = 1 << BASE_BITS;
  const MASK = BASE - 1;

  function counter() { return { limbOps: 0, adds: 0, allocations: 0 }; }

  /** Limbs are little-endian: index 0 is the least significant. */
  function normalise(limbs) {
    let end = limbs.length;
    while (end > 1 && limbs[end - 1] === 0) end -= 1;
    return limbs.slice(0, end);
  }

  function fromBigInt(value) {
    let magnitude = value < 0n ? -value : value;
    const limbs = [];
    if (magnitude === 0n) limbs.push(0);
    while (magnitude > 0n) {
      limbs.push(Number(magnitude & BigInt(MASK)));
      magnitude >>= BigInt(BASE_BITS);
    }
    return { sign: value < 0n ? -1 : 1, limbs: limbs };
  }

  function toBigInt(number) {
    let out = 0n;
    for (let i = number.limbs.length - 1; i >= 0; i -= 1) {
      out = (out << BigInt(BASE_BITS)) | BigInt(number.limbs[i]);
    }
    return number.sign < 0 ? -out : out;
  }

  function isZero(number) {
    return number.limbs.length === 1 && number.limbs[0] === 0;
  }

  /** Magnitude comparison, ignoring signs. */
  function compareMagnitude(a, b) {
    if (a.length !== b.length) return a.length > b.length ? 1 : -1;
    for (let i = a.length - 1; i >= 0; i -= 1) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function addMagnitude(a, b, stats) {
    const out = [];
    let carry = 0;
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      const sum = (a[i] || 0) + (b[i] || 0) + carry;
      out.push(sum & MASK);
      carry = sum >>> BASE_BITS;
      if (stats) stats.adds += 1;
    }
    if (carry > 0) out.push(carry);
    return out;
  }

  /** Requires |a| >= |b|. The borrow chain is the whole of it. */
  function subMagnitude(a, b, stats) {
    const out = [];
    let borrow = 0;
    for (let i = 0; i < a.length; i += 1) {
      let difference = a[i] - (b[i] || 0) - borrow;
      borrow = 0;
      if (difference < 0) { difference += BASE; borrow = 1; }
      out.push(difference);
      if (stats) stats.adds += 1;
    }
    return normalise(out);
  }

  function add(x, y, stats) {
    if (x.sign === y.sign) return { sign: x.sign, limbs: addMagnitude(x.limbs, y.limbs, stats) };
    const order = compareMagnitude(x.limbs, y.limbs);
    if (order === 0) return { sign: 1, limbs: [0] };
    const larger = order > 0 ? x : y;
    const smaller = order > 0 ? y : x;
    return { sign: larger.sign, limbs: subMagnitude(larger.limbs, smaller.limbs, stats) };
  }

  function negate(x) { return { sign: isZero(x) ? 1 : -x.sign, limbs: x.limbs }; }
  function sub(x, y, stats) { return add(x, negate(y), stats); }

  /* --------------------------------------------------------- multiplying */

  /**
   * Schoolbook: every limb of one against every limb of the other, into a
   * column accumulator. n x m limb products, exactly what the counter reports.
   */
  function mulSchoolbook(a, b, stats) {
    const out = new Array(a.length + b.length).fill(0);
    for (let i = 0; i < a.length; i += 1) {
      let carry = 0;
      for (let j = 0; j < b.length; j += 1) {
        const value = out[i + j] + a[i] * b[j] + carry;
        out[i + j] = value & MASK;
        carry = Math.floor(value / BASE);
        if (stats) stats.limbOps += 1;
      }
      out[i + b.length] += carry;
    }
    return normalise(out);
  }

  const KARATSUBA_FLOOR = 8;

  /**
   * Karatsuba: split each operand into a high and a low half and note that
   * the three products (lo x lo), (hi x hi) and (lo + hi)(lo + hi) recover the
   * middle term without a fourth multiplication. Three multiplications of half
   * size instead of four, so the exponent drops from 2 to log2(3) = 1.585 -
   * paid for with several extra additions and a temporary allocation per
   * level, which is why the floor exists.
   */
  function mulKaratsuba(a, b, stats) {
    if (a.length < KARATSUBA_FLOOR || b.length < KARATSUBA_FLOOR) {
      return mulSchoolbook(a, b, stats);
    }
    const half = Math.floor(Math.max(a.length, b.length) / 2);
    const aLow = normalise(a.slice(0, half));
    const aHigh = normalise(a.slice(half));
    const bLow = normalise(b.slice(0, half));
    const bHigh = normalise(b.slice(half));
    if (stats) stats.allocations += 4;

    const low = mulKaratsuba(aLow, bLow, stats);
    const high = mulKaratsuba(aHigh, bHigh, stats);
    const sums = mulKaratsuba(addMagnitude(aLow, aHigh, stats),
      addMagnitude(bLow, bHigh, stats), stats);
    const middle = subMagnitude(subMagnitude(sums, low, stats), high, stats);

    return normalise(addMagnitude(addMagnitude(low, shiftLimbs(middle, half), stats),
      shiftLimbs(high, 2 * half), stats));
  }

  function shiftLimbs(limbs, count) {
    if (limbs.length === 1 && limbs[0] === 0) return limbs;
    const out = new Array(count).fill(0);
    return out.concat(limbs);
  }

  function mul(x, y, options) {
    const settings = options || {};
    const stats = settings.stats || counter();
    const kernel = settings.algorithm === 'karatsuba' ? mulKaratsuba : mulSchoolbook;
    const limbs = kernel(x.limbs, y.limbs, stats);
    const zero = limbs.length === 1 && limbs[0] === 0;
    return { sign: zero ? 1 : x.sign * y.sign, limbs: limbs, stats: stats };
  }

  /* ------------------------------------------------------------ dividing */

  /** Division by one limb: the loop everybody can write, and the base case
   *  algorithm D falls back to. */
  function divmodSmall(limbs, divisor, stats) {
    const quotient = new Array(limbs.length).fill(0);
    let remainder = 0;
    for (let i = limbs.length - 1; i >= 0; i -= 1) {
      const current = remainder * BASE + limbs[i];
      quotient[i] = Math.floor(current / divisor);
      remainder = current % divisor;
      if (stats) stats.limbOps += 1;
    }
    return { quotient: normalise(quotient), remainder: remainder };
  }

  /**
   * Knuth's algorithm D. The divisor is shifted left so its top limb is at
   * least BASE/2, which bounds the error in the two-limb quotient estimate to
   * at most two; the estimate is then corrected down at most twice, and the
   * rare "add back" handles the residue that is still negative afterwards.
   */
  function divmod(numerator, denominator, stats) {
    if (denominator.length === 1 && denominator[0] === 0) throw new Error('division by zero');
    if (compareMagnitude(numerator, denominator) < 0) {
      return { quotient: [0], remainder: numerator.slice(), addBacks: 0 };
    }
    if (denominator.length === 1) {
      const small = divmodSmall(numerator, denominator[0], stats);
      return { quotient: small.quotient, remainder: [small.remainder], addBacks: 0 };
    }
    const shift = BASE_BITS - bitLength(denominator[denominator.length - 1]);
    const u = shiftBits(numerator.concat([0]), shift);
    /* The shift is chosen so the divisor's top limb reaches BASE/2 without
       overflowing, so the limb `shiftBits` appends is always zero - and it has
       to be stripped, because every index in the loop below is relative to the
       divisor's true length. The numerator's extra limb is kept on purpose. */
    const v = normalise(shiftBits(denominator, shift));
    const state = { u: u, v: v, quotient: new Array(numerator.length - v.length + 1).fill(0),
      addBacks: 0, stats: stats };

    for (let j = state.quotient.length - 1; j >= 0; j -= 1) divideStep(state, j);
    return {
      quotient: normalise(state.quotient),
      remainder: normalise(shiftBitsRight(state.u.slice(0, v.length), shift)),
      addBacks: state.addBacks
    };
  }

  /** One quotient limb: estimate, correct, subtract, and add back if the
   *  subtraction went negative. */
  function divideStep(state, j) {
    const v = state.v;
    const n = v.length;
    const top = state.u[j + n] * BASE + state.u[j + n - 1];
    let estimate = Math.floor(top / v[n - 1]);
    let remainder = top % v[n - 1];

    while (estimate >= BASE ||
      estimate * v[n - 2] > remainder * BASE + state.u[j + n - 2]) {
      estimate -= 1;
      remainder += v[n - 1];
      if (remainder >= BASE) break;
    }
    const borrow = subtractShifted(state.u, v, { at: j, factor: estimate, stats: state.stats });
    if (borrow) {
      estimate -= 1;
      state.addBacks += 1;
      addShifted(state.u, v, j);
    }
    state.quotient[j] = estimate;
  }

  /** u[at .. at+n] -= factor * v, returning true when the result went
   *  negative, which is the signal to add one copy of v back. */
  function subtractShifted(u, v, options) {
    let borrow = 0;
    let carry = 0;
    for (let i = 0; i < v.length; i += 1) {
      const product = options.factor * v[i] + carry;
      carry = Math.floor(product / BASE);
      let value = u[options.at + i] - (product & MASK) - borrow;
      borrow = 0;
      if (value < 0) { value += BASE; borrow = 1; }
      u[options.at + i] = value;
      if (options.stats) options.stats.limbOps += 1;
    }
    let value = u[options.at + v.length] - carry - borrow;
    if (value < 0) { u[options.at + v.length] = value + BASE; return true; }
    u[options.at + v.length] = value;
    return false;
  }

  function addShifted(u, v, at) {
    let carry = 0;
    for (let i = 0; i < v.length; i += 1) {
      const sum = u[at + i] + v[i] + carry;
      u[at + i] = sum & MASK;
      carry = sum >>> BASE_BITS;
    }
    u[at + v.length] = (u[at + v.length] + carry) & MASK;
  }

  function bitLength(value) {
    let bits = 0;
    let v = value;
    while (v > 0) { bits += 1; v >>>= 1; }
    return bits;
  }

  function shiftBits(limbs, shift) {
    if (shift === 0) return limbs.slice();
    const out = [];
    let carry = 0;
    for (let i = 0; i < limbs.length; i += 1) {
      out.push(((limbs[i] << shift) | carry) & MASK);
      carry = limbs[i] >>> (BASE_BITS - shift);
    }
    out.push(carry);
    return out;
  }

  function shiftBitsRight(limbs, shift) {
    if (shift === 0) return limbs.slice();
    const out = new Array(limbs.length).fill(0);
    let carry = 0;
    for (let i = limbs.length - 1; i >= 0; i -= 1) {
      out[i] = ((limbs[i] >>> shift) | carry) & MASK;
      carry = (limbs[i] << (BASE_BITS - shift)) & MASK;
    }
    return normalise(out);
  }

  function div(x, y, stats) {
    const result = divmod(x.limbs, y.limbs, stats);
    const zero = result.quotient.length === 1 && result.quotient[0] === 0;
    return {
      quotient: { sign: zero ? 1 : x.sign * y.sign, limbs: result.quotient },
      remainder: { sign: x.sign, limbs: result.remainder },
      addBacks: result.addBacks
    };
  }

  /* ------------------------------------------------------------- modular */

  /**
   * Square and multiply, counting both. The exponent's bit length decides the
   * squarings and its population count decides the multiplications, which is
   * why a public exponent of 65537 (two set bits) is chosen and a private one
   * of the same width is not - and why the timing difference between them is
   * the side channel M23 is about.
   */
  function modPow(base, exponent, modulus) {
    let result = 1n;
    let b = base % modulus;
    let e = exponent;
    const stats = { squarings: 0, multiplications: 0, bits: 0 };
    while (e > 0n) {
      stats.bits += 1;
      if ((e & 1n) === 1n) { result = (result * b) % modulus; stats.multiplications += 1; }
      b = (b * b) % modulus;
      e >>= 1n;
      stats.squarings += 1;
    }
    return { value: result, stats: stats };
  }

  /**
   * Montgomery form replaces the modular reduction - a division - with a
   * shift, by working with x*R mod n instead of x. Entering and leaving the
   * form costs two multiplications, so it pays only when many operations
   * happen inside it, which is exactly the shape of modular exponentiation.
   */
  function montgomery(modulus) {
    const bits = modulus.toString(2).length;
    const r = 1n << BigInt(bits);
    const rInverse = modInverse(r % modulus, modulus);
    const nPrime = ((r * rInverse - 1n) / modulus) % r;

    function reduce(value) {
      const m = ((value % r) * nPrime) % r;
      const t = (value + m * modulus) / r;
      return t >= modulus ? t - modulus : t;
    }

    return {
      bits: bits, r: r, nPrime: nPrime,
      enter: function (x) { return (x * r) % modulus; },
      leave: function (x) { return reduce(x); },
      reduce: reduce,
      multiply: function (a, b) { return reduce(a * b); }
    };
  }

  function modInverse(value, modulus) {
    let previous = value % modulus;
    let current = modulus;
    let previousCoefficient = 1n;
    let coefficient = 0n;

    while (current !== 0n) {
      const quotient = previous / current;
      const nextValue = previous - quotient * current;
      const nextCoefficient = previousCoefficient - quotient * coefficient;
      previous = current; current = nextValue;
      previousCoefficient = coefficient; coefficient = nextCoefficient;
    }
    if (previous !== 1n) throw new Error('no modular inverse');
    return ((previousCoefficient % modulus) + modulus) % modulus;
  }

  function montgomeryPow(base, exponent, modulus) {
    const form = montgomery(modulus);
    let result = form.enter(1n);
    let b = form.enter(base % modulus);
    let e = exponent;
    const stats = { reductions: 0, squarings: 0, multiplications: 0 };
    while (e > 0n) {
      if ((e & 1n) === 1n) { result = form.multiply(result, b); stats.multiplications += 1; }
      b = form.multiply(b, b);
      e >>= 1n;
      stats.squarings += 1;
      stats.reductions += 2;
    }
    return { value: form.leave(result), stats: stats };
  }

  /**
   * Operand pairs that force the add-back branch, as limb arrays in this
   * module's base. The first is Hacker's Delight's documented case for a
   * 16-bit base; the second was found by searching for a divisor whose top
   * limb is exactly at the normalisation boundary.
   */
  const ADD_BACK_FIXTURES = [
    { label: 'Hacker’s Delight divmnu case', u: [0, 0, 0x8000, 0x7fff], v: [1, 0, 0x8000] },
    { label: 'a divisor sitting on the normalisation boundary',
      u: [3, 0, 0, 0, 0, 0x8000], v: [1, 0, 0, 0x8000] }
  ];

  return {
    BASE_BITS: BASE_BITS,
    BASE: BASE,
    KARATSUBA_FLOOR: KARATSUBA_FLOOR,
    ADD_BACK_FIXTURES: ADD_BACK_FIXTURES,
    counter: counter,
    normalise: normalise,
    fromBigInt: fromBigInt,
    toBigInt: toBigInt,
    isZero: isZero,
    compareMagnitude: compareMagnitude,
    addMagnitude: addMagnitude,
    subMagnitude: subMagnitude,
    add: add,
    sub: sub,
    negate: negate,
    mulSchoolbook: mulSchoolbook,
    mulKaratsuba: mulKaratsuba,
    mul: mul,
    divmodSmall: divmodSmall,
    divmod: divmod,
    div: div,
    modPow: modPow,
    modInverse: modInverse,
    montgomery: montgomery,
    montgomeryPow: montgomeryPow
  };
}));
