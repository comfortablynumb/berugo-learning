/**
 * Fixed-width integer arithmetic, done exactly and then narrowed.
 *
 * Every operation here computes the true mathematical answer in BigInt first
 * and only then decides what a machine of a given width would have stored.
 * That order is the whole design. Writing the wrap directly - masking as you
 * go, or leaning on JavaScript's `| 0` - gets the common cases right and then
 * disagrees with real hardware at exactly the boundaries the section is about,
 * and the disagreement is invisible because both answers look like integers.
 * With the exact value in hand, "did it overflow" is a comparison against the
 * representable range rather than a bit trick to be argued about, and the
 * three overflow policies (wrap, saturate, trap) become three ways of reading
 * one exact number instead of three separate implementations.
 *
 * Values cross the boundary of this module as BigInt. Numbers are accepted and
 * converted, because a demo binds to a text input, but nothing internal is a
 * double: a 64-bit width has values a double cannot represent, and a module
 * that silently rounds them is teaching the opposite of its own lesson.
 *
 * Carry and overflow are different flags and the difference is the point.
 * Carry is the unsigned story - did the result leave the range 0 .. 2^n - 1.
 * Overflow is the signed story - did it leave -2^(n-1) .. 2^(n-1) - 1. One
 * adder computes both, the ALU raises both, and which one the program should
 * have looked at is decided by the types in the source, not by the hardware.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IntegerOps = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const WIDTHS = [8, 16, 32, 64];

  function toBig(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.trunc(value));
    return BigInt(value);
  }

  /** The representable range of a width, as exact BigInts. */
  function width(bits, signed) {
    const span = 1n << BigInt(bits);
    return {
      bits: bits,
      signed: !!signed,
      span: span,
      min: signed ? -(span >> 1n) : 0n,
      max: signed ? (span >> 1n) - 1n : span - 1n
    };
  }

  /** The bit pattern of a value at this width, read back as the width says. */
  function wrap(value, w) {
    const raw = toBig(value) & (w.span - 1n);
    if (!w.signed) return raw;
    return raw >= (w.span >> 1n) ? raw - w.span : raw;
  }

  /** The same bit pattern read as unsigned, whatever the width claims to be. */
  function pattern(value, w) {
    return toBig(value) & (w.span - 1n);
  }

  function inRange(value, w) {
    return value >= w.min && value <= w.max;
  }

  /**
   * Both flags come from the BIT PATTERNS, which is what an ALU actually has.
   *
   * This is worth stating because the obvious shortcut is wrong. Taking the
   * operands as values, adding them, and asking whether the answer left the
   * unsigned range gives the right carry for positive operands and the wrong
   * one everywhere else: at eight bits (-1) + 1 is 0, which is inside
   * 0 .. 255, so that model reports no carry - and the hardware raises one,
   * because the patterns 0xFF and 0x01 add to 0x100 and something came out of
   * the top bit. The canonical sentence of this whole section, "0xFF + 0x01
   * carries and does not overflow", is false under the shortcut and true here.
   *
   * So each operation is computed twice: once reading both patterns as
   * unsigned, which produces `carry`, and once reading them as two's
   * complement, which produces `overflow`. Both are defined whatever the
   * width claims to be signed or unsigned, because the adder computes both
   * whatever the source code claimed - and which of them was the error is
   * exactly the thing the type decides and the hardware cannot.
   */
  function signedOf(raw, w) {
    return raw >= (w.span >> 1n) ? raw - w.span : raw;
  }

  function report(readings, w) {
    const signedRange = width(w.bits, true);
    const unsignedRange = width(w.bits, false);
    const exact = w.signed ? readings.signed : readings.unsigned;
    return {
      exact: exact,
      value: wrap(exact, w),
      pattern: pattern(exact, w),
      carry: !inRange(readings.unsigned, unsignedRange),
      overflow: !inRange(readings.signed, signedRange),
      wrapped: !inRange(exact, w)
    };
  }

  /** The two readings of one operation, as one object. */
  function readingsFor(a, b, w, combine) {
    const pa = pattern(a, w);
    const pb = pattern(b, w);
    return {
      unsigned: combine(pa, pb),
      signed: combine(signedOf(pa, w), signedOf(pb, w))
    };
  }

  function add(a, b, w) {
    return report(readingsFor(a, b, w, function (x, y) { return x + y; }), w);
  }

  function sub(a, b, w) {
    return report(readingsFor(a, b, w, function (x, y) { return x - y; }), w);
  }

  function mul(a, b, w) {
    return report(readingsFor(a, b, w, function (x, y) { return x * y; }), w);
  }

  function negate(a, w) {
    return sub(0n, a, w);
  }

  /**
   * Division is the operation with a hole in it, and the hole is not the one
   * everybody names. Dividing by zero is undefined and everybody checks it;
   * INT_MIN / -1 is a second undefined case that traps on x86 with the same
   * signal, because the true quotient is one past the top of the range. It is
   * the asymmetry of two's complement showing up as a crash.
   */
  function div(a, b, w) {
    const pb = pattern(b, w);
    const divisor = w.signed ? signedOf(pb, w) : pb;
    if (divisor === 0n) return { trap: 'divide by zero', exact: null, value: null };

    const pa = pattern(a, w);
    const dividend = w.signed ? signedOf(pa, w) : pa;
    const exact = dividend / divisor;
    const result = report({ signed: exact, unsigned: exact }, w);
    if (w.signed && !inRange(exact, w)) result.trap = 'quotient is not representable';
    return result;
  }

  /** Clamp to the range rather than wrap: what saturating arithmetic does, and
   *  what audio and fixed-point pipelines want. */
  function saturate(exact, w) {
    if (exact < w.min) return w.min;
    if (exact > w.max) return w.max;
    return exact;
  }

  /** The checked policy: an answer, or nothing at all. */
  function checked(exact, w) {
    return inRange(exact, w) ? exact : null;
  }

  /** All three policies for one exact value, side by side. */
  function policies(exact, w) {
    return {
      wrapping: wrap(exact, w),
      saturating: saturate(exact, w),
      checked: checked(exact, w),
      trapping: inRange(exact, w) ? exact : null,
      overflowed: !inRange(exact, w)
    };
  }

  /**
   * Widening a value keeps its meaning only if the sign bit is replicated.
   * Zero extension is the other choice and it is right for unsigned sources;
   * picking the wrong one turns -1 into 255, which is the classic `char` bug.
   */
  function signExtend(value, fromBits, toBits) {
    const from = width(fromBits, true);
    return wrap(wrap(value, from), width(toBits, true));
  }

  function zeroExtend(value, fromBits, toBits) {
    return wrap(pattern(value, width(fromBits, false)), width(toBits, false));
  }

  /** The bit pattern as a string, grouped in bytes so the reader can find the
   *  sign bit without counting from the left. */
  function bitString(value, w) {
    const raw = pattern(value, w);
    let out = '';
    for (let i = w.bits - 1; i >= 0; i -= 1) {
      out += ((raw >> BigInt(i)) & 1n) === 1n ? '1' : '0';
      if (i % 8 === 0 && i !== 0) out += ' ';
    }
    return out;
  }

  function bitArray(value, w) {
    const raw = pattern(value, w);
    const out = [];
    for (let i = w.bits - 1; i >= 0; i -= 1) out.push(Number((raw >> BigInt(i)) & 1n));
    return out;
  }

  function hexString(value, w) {
    const digits = w.bits / 4;
    let out = pattern(value, w).toString(16).toUpperCase();
    while (out.length < digits) out = '0' + out;
    return out;
  }

  /**
   * The bytes a machine would store, in the order it would store them.
   * Endianness is not a property of the number - it is a property of the
   * mapping from a number to addresses, which is why it only becomes visible
   * when the bytes are read back by something that disagrees.
   */
  function toBytes(value, w, littleEndian) {
    const raw = pattern(value, w);
    const out = [];
    for (let i = 0; i < w.bits / 8; i += 1) out.push(Number((raw >> BigInt(8 * i)) & 0xffn));
    return littleEndian ? out : out.reverse();
  }

  function fromBytes(bytes, w, littleEndian) {
    const ordered = littleEndian ? bytes.slice() : bytes.slice().reverse();
    let raw = 0n;
    for (let i = ordered.length - 1; i >= 0; i -= 1) raw = (raw << 8n) | BigInt(ordered[i] & 0xff);
    return wrap(raw, w);
  }

  /** Write it one way, read it the other: the whole of the endianness bug. */
  function endianRoundTrip(value, w) {
    const little = toBytes(value, w, true);
    const big = toBytes(value, w, false);
    return {
      little: little,
      big: big,
      littleReadAsBig: fromBytes(little, w, false),
      bigReadAsLittle: fromBytes(big, w, true),
      agree: little.join(',') === big.join(',')
    };
  }

  /**
   * JavaScript's bitwise operators are defined on int32, so `|`, `&`, `^`,
   * `<<` and `>>` first convert their operands with ToInt32 - a wrap, not a
   * clamp and not an error. `>>>` is the one that yields uint32. This is why
   * `1 << 31` is negative and `x | 0` is a truncating cast rather than a
   * no-op, and why a hash function written with `*` silently loses bits above
   * 2^53 while the same function written with `Math.imul` does not.
   */
  function coerceInt32(x) {
    return x | 0;
  }

  function coerceUint32(x) {
    return x >>> 0;
  }

  /**
   * The same multiplication three ways: the exact product, what a double
   * stores, and what int32 multiplication gives. The gap between the first two
   * opens at 2^53 and never closes.
   */
  function multiplyThreeWays(a, b) {
    const exact = BigInt(a) * BigInt(b);
    const asDouble = a * b;
    const safe = Number.isSafeInteger(asDouble);
    return {
      exact: exact,
      asDouble: asDouble,
      doubleIsExact: safe && BigInt(asDouble) === exact,
      imul: Math.imul(a, b),
      imulMatches: BigInt(Math.imul(a, b)) === wrap(exact, width(32, true))
    };
  }

  /**
   * Positions on the two's-complement number wheel. The wheel is the whole
   * explanation of the format: the bit patterns run 0 upwards, the signed
   * reading cuts the circle at the halfway point, and the one discontinuity in
   * the signed reading - between the largest positive and the most negative -
   * is exactly where signed overflow happens.
   */
  function wheel(w, samples) {
    const count = Math.min(samples || 16, Number(w.span));
    const step = Number(w.span) / count;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const raw = BigInt(Math.round(i * step)) & (w.span - 1n);
      out.push({
        raw: raw,
        signed: wrap(raw, width(w.bits, true)),
        unsigned: raw,
        angle: (2 * Math.PI * Number(raw)) / Number(w.span)
      });
    }
    return out;
  }

  /**
   * The asymmetry, stated as data rather than as a sentence. There is exactly
   * one more negative value than positive, so negation is not a total function
   * on a signed width: -INT_MIN is not representable and wraps to itself.
   */
  function asymmetry(w) {
    const signed = width(w.bits, true);
    return {
      min: signed.min,
      max: signed.max,
      negatedMin: wrap(-signed.min, signed),
      negationIsIdentity: wrap(-signed.min, signed) === signed.min,
      absOfMinIsNegative: wrap(-signed.min, signed) < 0n,
      positives: signed.max,
      negatives: -signed.min
    };
  }

  return {
    WIDTHS: WIDTHS,
    width: width,
    wrap: wrap,
    pattern: pattern,
    inRange: inRange,
    signedOf: signedOf,
    add: add,
    sub: sub,
    mul: mul,
    div: div,
    negate: negate,
    saturate: saturate,
    checked: checked,
    policies: policies,
    signExtend: signExtend,
    zeroExtend: zeroExtend,
    bitString: bitString,
    bitArray: bitArray,
    hexString: hexString,
    toBytes: toBytes,
    fromBytes: fromBytes,
    endianRoundTrip: endianRoundTrip,
    coerceInt32: coerceInt32,
    coerceUint32: coerceUint32,
    multiplyThreeWays: multiplyThreeWays,
    wheel: wheel,
    asymmetry: asymmetry,
    toBig: toBig
  };
}));
