/**
 * Taking a floating-point number apart, and putting the exact value back
 * together.
 *
 * The central fact this module exists to make concrete is that a finite double
 * is not an approximation of a real number - it *is* a rational number,
 * exactly, and a very specific one: an integer of at most 53 bits times a
 * power of two. `0.1` is not "0.1 with a bit of error"; it is exactly
 * 3602879701896397 / 2^55, which written out in full is
 * 0.1000000000000000055511151231257827021181583404541015625. Every confusing
 * thing about floating point becomes ordinary once that number is on the
 * screen, which is why `exactDecimal` here prints all of it rather than
 * rounding to something readable.
 *
 * The second fact is spacing. Representable doubles are not evenly spaced -
 * they are evenly spaced *within a binade* and the spacing doubles at every
 * power of two. That single sentence explains why `x + 1 === x` above 2^53,
 * why summing a large value and a small one loses the small one, and why a
 * tolerance of 1e-9 is generous at 1.0 and meaningless at 1e9. `ulp` measures
 * the local spacing, and every comparison worth writing is expressed in it.
 *
 * `nextAfter` walks the representation rather than the value, because the bit
 * pattern of a positive double increases monotonically with the value: the
 * exponent field sits above the mantissa field, so a mantissa that carries
 * into the exponent is exactly the step from the top of one binade to the
 * bottom of the next. Subnormals fall out for free - the implicit leading one
 * is what would break, and at the subnormal boundary there is no implicit one
 * to break.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FloatInspect = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);

  const MANTISSA_BITS = 52;
  const EXPONENT_BITS = 11;
  const BIAS = 1023;
  const MANTISSA_MASK = (1n << 52n) - 1n;
  const SIGN_BIT = 1n << 63n;

  function bitsOf(x) {
    view.setFloat64(0, x);
    return view.getBigUint64(0);
  }

  function fromBits(bits) {
    view.setBigUint64(0, bits & 0xffffffffffffffffn);
    return view.getFloat64(0);
  }

  /**
   * The three fields, plus what they mean. `exponent` is the unbiased one and
   * `significand` includes the implicit leading bit for a normal number and
   * omits it for a subnormal - which is the entire difference between the two
   * classes.
   */
  function decompose(x) {
    const bits = bitsOf(x);
    const sign = Number(bits >> 63n);
    const biased = Number((bits >> 52n) & 0x7ffn);
    const fraction = bits & MANTISSA_MASK;
    const subnormal = biased === 0;

    return {
      value: x,
      bits: bits,
      sign: sign,
      signValue: sign === 1 ? -1 : 1,
      biasedExponent: biased,
      exponent: subnormal ? 1 - BIAS : biased - BIAS,
      fraction: fraction,
      significand: subnormal ? fraction : fraction | (1n << 52n),
      implicitOne: !subnormal,
      scale: subnormal ? -1074 : biased - 1075,
      kind: classify(x, biased, fraction)
    };
  }

  function classify(x, biased, fraction) {
    if (biased === 0x7ff) return fraction === 0n ? 'infinity' : 'nan';
    if (biased === 0) return fraction === 0n ? 'zero' : 'subnormal';
    return 'normal';
  }

  /** The bit pattern as three labelled groups. */
  function fields(x) {
    const bits = bitsOf(x);
    let text = bits.toString(2);
    while (text.length < 64) text = '0' + text;
    return {
      sign: text.slice(0, 1),
      exponent: text.slice(1, 1 + EXPONENT_BITS),
      mantissa: text.slice(1 + EXPONENT_BITS),
      hex: '0x' + bits.toString(16).padStart(16, '0')
    };
  }

  /* ------------------------------------------------------------ the value */

  function gcd(a, b) {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) { const t = x % y; x = y; y = t; }
    return x;
  }

  /** The exact rational this double is, in lowest terms. */
  function exactRational(x) {
    if (!Number.isFinite(x)) return null;
    const parts = decompose(x);
    const magnitude = parts.significand;
    const signed = parts.sign === 1 ? -magnitude : magnitude;

    if (parts.scale >= 0) {
      return { numerator: signed << BigInt(parts.scale), denominator: 1n };
    }
    const denominator = 1n << BigInt(-parts.scale);
    const divisor = gcd(signed, denominator);
    return {
      numerator: divisor === 0n ? 0n : signed / divisor,
      denominator: divisor === 0n ? 1n : denominator / divisor
    };
  }

  /**
   * The exact decimal expansion, in full. It always terminates: the
   * denominator is a power of two, and multiplying by the matching power of
   * five turns it into a power of ten. That is why `0.1` has 55 decimal
   * places - one for each factor of two in its denominator.
   */
  function exactDecimal(x) {
    if (!Number.isFinite(x)) return String(x);
    const parts = decompose(x);
    const sign = parts.sign === 1 ? '-' : '';
    if (parts.significand === 0n) return sign + '0';

    if (parts.scale >= 0) return sign + (parts.significand << BigInt(parts.scale)).toString();
    const places = -parts.scale;
    let digits = (parts.significand * (5n ** BigInt(places))).toString();
    while (digits.length <= places) digits = '0' + digits;
    const whole = digits.slice(0, digits.length - places);
    const rest = digits.slice(digits.length - places).replace(/0+$/, '');
    return sign + whole + (rest.length > 0 ? '.' + rest : '');
  }

  /* ----------------------------------------------------------- neighbours */

  /**
   * The next representable double from `x` in the direction of `y`. Walking
   * the bit pattern is not a shortcut - for positive values the integer
   * ordering of the bits IS the ordering of the values, because the exponent
   * field sits above the mantissa field.
   */
  function nextAfter(x, y) {
    if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
    if (x === y) return y;
    if (x === 0) return y > 0 ? 5e-324 : -5e-324;

    const bits = bitsOf(x);
    const away = (y > x) === (x > 0);
    const step = away ? 1n : -1n;
    /* Crossing zero from the smallest subnormal has to land on the signed
       zero of the same side rather than on the sign bit of the other. */
    if (!away && (bits & ~SIGN_BIT) === 0n) return x;
    return fromBits(bits + step);
  }

  function nextUp(x) { return nextAfter(x, Infinity); }
  function nextDown(x) { return nextAfter(x, -Infinity); }

  /**
   * The gap between `x` and the next representable value further from zero.
   *
   * The "further from zero" is a real choice and it is the one the standard's
   * `ulp` makes for ordinary values. At an exact power of two the two gaps
   * differ by a factor of two - the numbers below 1.0 are twice as dense as
   * the numbers above it - so `spacingBelow` is reported separately rather
   * than averaged into a single misleading answer.
   */
  function ulp(x) {
    if (Number.isNaN(x)) return NaN;
    if (!Number.isFinite(x)) return Infinity;
    const magnitude = Math.abs(x);
    if (magnitude === 0) return 5e-324;
    return nextUp(magnitude) - magnitude;
  }

  function spacingBelow(x) {
    const magnitude = Math.abs(x);
    if (magnitude === 0) return 5e-324;
    return magnitude - nextDown(magnitude);
  }

  /** How many representable doubles lie between a and b - the ULP distance,
   *  which is the only float comparison that behaves the same at every
   *  magnitude. */
  function ulpsBetween(a, b) {
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    const ordered = function (value) {
      const bits = bitsOf(value);
      return (bits & SIGN_BIT) !== 0n ? SIGN_BIT - (bits & ~SIGN_BIT) : SIGN_BIT + bits;
    };
    const difference = ordered(a) - ordered(b);
    return difference < 0n ? -difference : difference;
  }

  function neighbours(x) {
    return { below: nextDown(x), value: x, above: nextUp(x),
      gapAbove: ulp(x), gapBelow: spacingBelow(x) };
  }

  /* -------------------------------------------------------------- binary32 */

  function toFloat32(x) {
    f32[0] = x;
    return f32[0];
  }

  function float32Bits(x) {
    f32[0] = x;
    return u32[0] >>> 0;
  }

  function float32Fields(x) {
    const bits = float32Bits(x);
    let text = (bits >>> 0).toString(2);
    while (text.length < 32) text = '0' + text;
    return { sign: text.slice(0, 1), exponent: text.slice(1, 9), mantissa: text.slice(9),
      hex: '0x' + (bits >>> 0).toString(16).padStart(8, '0') };
  }

  /** What a round trip through binary32 costs, in ULPs of the original. */
  function narrowingError(x) {
    const narrowed = toFloat32(x);
    return {
      original: x,
      narrowed: narrowed,
      absolute: Math.abs(narrowed - x),
      relative: x === 0 ? 0 : Math.abs((narrowed - x) / x),
      ulps: ulpsBetween(x, narrowed)
    };
  }

  /* ----------------------------------------------------------- landmarks */

  const LANDMARKS = {
    epsilon: Number.EPSILON,
    maxSafeInteger: Number.MAX_SAFE_INTEGER,
    minNormal: 2.2250738585072014e-308,
    maxSubnormal: 2.225073858507201e-308,
    minSubnormal: 5e-324,
    max: Number.MAX_VALUE
  };

  /**
   * The spacing at a series of magnitudes: the table that makes "integers stop
   * being exact above 2^53" a measurement rather than a slogan.
   */
  function spacingTable(exponents) {
    return exponents.map(function (exponent) {
      const value = Math.pow(2, exponent);
      const gap = ulp(value);
      return {
        exponent: exponent,
        value: value,
        gap: gap,
        integersExact: gap <= 1,
        nextInteger: value + 1 !== value
      };
    });
  }

  /** Does adding one to this value change it at all? */
  function incrementSurvives(x) {
    return x + 1 !== x;
  }

  return {
    MANTISSA_BITS: MANTISSA_BITS,
    EXPONENT_BITS: EXPONENT_BITS,
    BIAS: BIAS,
    LANDMARKS: LANDMARKS,
    bitsOf: bitsOf,
    fromBits: fromBits,
    decompose: decompose,
    fields: fields,
    exactRational: exactRational,
    exactDecimal: exactDecimal,
    nextAfter: nextAfter,
    nextUp: nextUp,
    nextDown: nextDown,
    ulp: ulp,
    spacingBelow: spacingBelow,
    ulpsBetween: ulpsBetween,
    neighbours: neighbours,
    toFloat32: toFloat32,
    float32Bits: float32Bits,
    float32Fields: float32Fields,
    narrowingError: narrowingError,
    spacingTable: spacingTable,
    incrementSurvives: incrementSurvives
  };
}));
