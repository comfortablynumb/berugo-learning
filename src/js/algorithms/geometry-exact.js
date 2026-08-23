/**
 * Exact evaluation of the two geometric determinants, for when floating point
 * cannot be trusted to get their SIGN right.
 *
 * The sign is all that is ever wanted. `orient2d` asks whether three points
 * turn left, right or not at all; `inCircle` asks whether a fourth point is
 * inside, outside or on the circle through three others. Neither caller wants
 * the magnitude, and every algorithm downstream branches on the sign - which
 * is exactly why a wrong sign is catastrophic rather than imprecise. A hull
 * whose orientation test says "left" for (a, b, c) and "left" again for
 * (a, c, b) is not slightly wrong; it is a contradiction, and the code built
 * on it will loop, crash or emit a polygon with a hole in it.
 *
 * The method here is exact rather than careful. Every finite double is
 * *precisely* an integer times a power of two - that is what the IEEE fields
 * mean - so each coordinate is decomposed into that integer and that exponent
 * and rebuilt as a BigInt scaled by a shared power of two. BigInt arithmetic
 * on integers has no rounding at all. Both determinants are homogeneous in the
 * coordinates (degree 2 and degree 4), so scaling every coordinate by the same
 * positive factor multiplies the result by a positive number and cannot change
 * its sign. That is the whole argument.
 *
 * The scaling is done through the raw bits rather than by multiplying by a
 * power of two and rounding. An earlier version did the latter in two steps to
 * dodge the safe-integer limit, and `Math.round` of a value that was not yet
 * an integer silently corrupted the coordinate - so the "exact" path returned
 * a wrong sign on precisely the inputs it existed to handle.
 *
 * This is the slow path. `geometry-core.js` reaches it only when its
 * floating-point filter cannot prove the sign, which on ordinary data is
 * almost never.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeometryExact = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const view = new DataView(new ArrayBuffer(8));

  const MANTISSA_MASK = (1n << 52n) - 1n;
  const IMPLICIT_BIT = 1n << 52n;
  const SUBNORMAL_EXPONENT = -1074;

  /**
   * A finite double as an exact { significand, exponent } pair, where the
   * value is significand × 2^exponent and significand is a BigInt.
   */
  function decompose(x) {
    if (x === 0) return { significand: 0n, exponent: 0 };
    view.setFloat64(0, x);
    const bits = view.getBigUint64(0);
    const negative = (bits >> 63n) === 1n;
    const biased = Number((bits >> 52n) & 0x7ffn);
    const fraction = bits & MANTISSA_MASK;

    const significand = biased === 0 ? fraction : fraction | IMPLICIT_BIT;
    const exponent = biased === 0 ? SUBNORMAL_EXPONENT : biased - 1075;

    return { significand: negative ? -significand : significand, exponent: exponent };
  }

  function trailingZeros(value) {
    if (value === 0n) return 0;
    let count = 0;
    let bits = value < 0n ? -value : value;
    while ((bits & 1n) === 0n) { bits >>= 1n; count += 1; }
    return count;
  }

  /**
   * How many bits of fraction a double carries: the smallest k for which
   * x · 2^k is a whole number. Zero for an integer, 52 for a value just above
   * 1 with every mantissa bit set.
   */
  function fractionBits(x) {
    if (!Number.isFinite(x) || x === 0) return 0;
    const parts = decompose(x);
    const shift = parts.exponent + trailingZeros(parts.significand);
    return shift >= 0 ? 0 : -shift;
  }

  /** The scale that makes every coordinate in the list an exact integer. */
  function commonScale(values) {
    let bits = 0;
    for (let i = 0; i < values.length; i += 1) {
      const needed = fractionBits(values[i]);
      if (needed > bits) bits = needed;
    }
    return bits;
  }

  /**
   * x · 2^bits as an exact BigInt. `bits` must be at least fractionBits(x),
   * which `commonScale` guarantees, so the shift is never a truncation.
   */
  function toBigInt(x, bits) {
    const parts = decompose(x);
    const shift = parts.exponent + bits;
    if (shift >= 0) return parts.significand << BigInt(shift);
    return parts.significand >> BigInt(-shift);
  }

  function sign(value) {
    if (value > 0n) return 1;
    if (value < 0n) return -1;
    return 0;
  }

  /**
   * Twice the signed area of the triangle a, b, c - positive when the three
   * turn counter-clockwise. The differences are taken in BigInt, after the
   * scaling, so nothing is rounded at any point.
   */
  function orient2d(a, b, c) {
    const bits = commonScale([a.x, a.y, b.x, b.y, c.x, c.y]);
    const ax = toBigInt(a.x, bits), ay = toBigInt(a.y, bits);
    const bx = toBigInt(b.x, bits), by = toBigInt(b.y, bits);
    const cx = toBigInt(c.x, bits), cy = toBigInt(c.y, bits);

    return sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  }

  /**
   * Which of p and q is further from the line through a and b, exactly.
   * Returns 1 when p is further, -1 when q is, 0 when they are equidistant.
   *
   * The distances themselves are never formed. The signed area of a-b-p minus
   * that of a-b-q is the cross product of (b - a) with (p - q), so the whole
   * comparison is one 2x2 determinant - and doing it exactly matters because
   * quickhull picks its apex with it. Ranking by the rounded value instead is
   * correct on integer coordinates and loses hull vertices on points a few
   * units in the last place apart.
   */
  function fartherFromLine(a, b, p, q) {
    const bits = commonScale([a.x, a.y, b.x, b.y, p.x, p.y, q.x, q.y]);
    const ax = toBigInt(a.x, bits), ay = toBigInt(a.y, bits);
    const bx = toBigInt(b.x, bits), by = toBigInt(b.y, bits);
    const px = toBigInt(p.x, bits), py = toBigInt(p.y, bits);
    const qx = toBigInt(q.x, bits), qy = toBigInt(q.y, bits);

    return sign((bx - ax) * (py - qy) - (by - ay) * (px - qx));
  }

  /* The 3x3 determinant of the lifted differences, evaluated exactly. Positive
     when d lies inside the circle through a, b and c, given that a, b, c turn
     counter-clockwise - a caller with the opposite orientation gets the
     opposite sign, which is why every caller checks the orientation first. */
  function inCircle(a, b, c, d) {
    const bits = commonScale([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
    const dx = toBigInt(d.x, bits), dy = toBigInt(d.y, bits);
    const ax = toBigInt(a.x, bits) - dx, ay = toBigInt(a.y, bits) - dy;
    const bx = toBigInt(b.x, bits) - dx, by = toBigInt(b.y, bits) - dy;
    const cx = toBigInt(c.x, bits) - dx, cy = toBigInt(c.y, bits) - dy;

    const alift = ax * ax + ay * ay;
    const blift = bx * bx + by * by;
    const clift = cx * cx + cy * cy;

    return sign(alift * (bx * cy - by * cx) -
      blift * (ax * cy - ay * cx) +
      clift * (ax * by - ay * bx));
  }

  return {
    orient2d: orient2d,
    inCircle: inCircle,
    fartherFromLine: fartherFromLine,
    decompose: decompose,
    fractionBits: fractionBits,
    commonScale: commonScale,
    toBigInt: toBigInt
  };
}));
