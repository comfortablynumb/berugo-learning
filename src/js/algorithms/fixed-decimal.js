/**
 * The three ways to hold a number that is not allowed to drift: scaled
 * integers (fixed point and decimal) and exact rationals.
 *
 * The reason money must not be a double is not that doubles are inaccurate -
 * they are extremely accurate. It is that the errors are *unrepeatable in a
 * way an auditor cannot follow*. 0.1 is not representable, so a ledger of
 * ten-cent items has a different residue depending on the order the rows were
 * added, and two systems that agree on every input can disagree on the total
 * by a cent with no bug in either. A scaled integer removes the question:
 * 10 cents is the integer 10, addition is exact, and the only place a decision
 * is made is where a division or a percentage forces one - which is exactly
 * where the business rule lives and where the test should be.
 *
 * The rounding policy is that decision, and this module makes it a parameter
 * rather than a habit. `roundQuotient` is the single place any inexact result
 * is resolved, and every policy the finance and statistics worlds use goes
 * through it: half up (what people mean by "rounding"), half even (what IEEE
 * 754 and most accounting standards mean), half down, floor, ceiling and
 * truncation. Half-even exists because half-up is biased upwards - over many
 * roundings the ties all go the same way and the total drifts - and the demo
 * measures that drift rather than asserting it.
 *
 * Rationals are the exact answer and the reason nobody uses them: the
 * denominators grow without bound. The module reports the denominator's bit
 * length so that growth is visible rather than theoretical.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FixedDecimal = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const POLICIES = [
    { id: 'half-even', label: 'half to even (banker’s)' },
    { id: 'half-up', label: 'half away from zero' },
    { id: 'half-down', label: 'half towards zero' },
    { id: 'floor', label: 'floor (towards minus infinity)' },
    { id: 'ceil', label: 'ceiling (towards plus infinity)' },
    { id: 'truncate', label: 'truncate (towards zero)' }
  ];

  function absBig(value) { return value < 0n ? -value : value; }

  /**
   * numerator / denominator as an integer, resolved by the named policy.
   * The remainder is compared against half the divisor by doubling it, which
   * keeps everything in integers - comparing `remainder / divisor` against 0.5
   * would put a rounding decision inside a rounding decision.
   */
  function roundQuotient(numerator, denominator, policy) {
    if (denominator === 0n) throw new Error('division by zero');
    const negative = (numerator < 0n) !== (denominator < 0n);
    const top = absBig(numerator);
    const bottom = absBig(denominator);
    const quotient = top / bottom;
    const remainder = top % bottom;

    if (remainder === 0n) return negative ? -quotient : quotient;
    const rounded = roundMagnitude(quotient, remainder * 2n, bottom, { policy: policy, negative: negative });
    return negative ? -rounded : rounded;
  }

  /** `twiceRemainder` against `bottom` is the tie test; `context` carries the
   *  sign, because floor and ceiling are the two policies that need it. */
  function roundMagnitude(quotient, twiceRemainder, bottom, context) {
    const policy = context.policy;
    if (policy === 'truncate') return quotient;
    if (policy === 'floor') return context.negative ? quotient + 1n : quotient;
    if (policy === 'ceil') return context.negative ? quotient : quotient + 1n;
    if (twiceRemainder > bottom) return quotient + 1n;
    if (twiceRemainder < bottom) return quotient;
    if (policy === 'half-up') return quotient + 1n;
    if (policy === 'half-down') return quotient;
    return (quotient & 1n) === 1n ? quotient + 1n : quotient;
  }

  /* ------------------------------------------------------- scaled integers */

  /**
   * A scaled-integer type. `base` is 2 for fixed point (a shift) and 10 for
   * decimal (what money and invoices are denominated in); `places` is how many
   * digits or bits of fraction. Addition and subtraction are exact at any
   * scale; multiplication doubles the scale and has to come back down, which
   * is the one operation where the policy is consulted.
   */
  function scaled(base, places, policy) {
    const unit = BigInt(base) ** BigInt(places);
    const chosen = policy || 'half-even';

    function fromNumber(x) {
      return roundQuotient(BigInt(Math.round(x * Number(unit) * 4096)), 4096n, chosen);
    }

    function fromString(text) { return parseScaled(text, base, places, chosen); }
    function toNumber(value) { return Number(value) / Number(unit); }

    return {
      base: base, places: places, unit: unit, policy: chosen,
      fromNumber: fromNumber,
      fromString: fromString,
      toNumber: toNumber,
      toString: function (value) { return formatScaled(value, base, places); },
      add: function (a, b) { return a + b; },
      sub: function (a, b) { return a - b; },
      mul: function (a, b) { return roundQuotient(a * b, unit, chosen); },
      div: function (a, b) { return roundQuotient(a * unit, b, chosen); },
      scaleBy: function (a, factor) { return roundQuotient(a * factor.numerator, factor.denominator, chosen); }
    };
  }

  function parseScaled(text, base, places, policy) {
    const clean = String(text).trim();
    const dot = clean.indexOf('.');
    if (base !== 10) return scaled(base, places, policy).fromNumber(Number(clean));
    if (dot === -1) return BigInt(clean) * (10n ** BigInt(places));
    const whole = clean.slice(0, dot) || '0';
    const fraction = clean.slice(dot + 1);
    const negative = whole.trim().charAt(0) === '-';
    const padded = (fraction + '0'.repeat(places)).slice(0, places);
    const extra = fraction.slice(places);
    const base10 = BigInt(whole) * (10n ** BigInt(places)) +
      (negative ? -BigInt(padded) : BigInt(padded));
    if (extra.length === 0) return base10;
    const carry = roundQuotient(BigInt(extra), 10n ** BigInt(extra.length), policy);
    return base10 + (negative ? -carry : carry);
  }

  function formatScaled(value, base, places) {
    if (base !== 10) return (Number(value) / Math.pow(base, places)).toString();
    const negative = value < 0n;
    const digits = absBig(value).toString().padStart(places + 1, '0');
    const whole = digits.slice(0, digits.length - places);
    const fraction = places === 0 ? '' : '.' + digits.slice(digits.length - places);
    return (negative ? '-' : '') + whole + fraction;
  }

  /* ------------------------------------------------------------ rationals */

  function gcd(a, b) {
    let x = absBig(a);
    let y = absBig(b);
    while (y !== 0n) { const t = x % y; x = y; y = t; }
    return x;
  }

  function rational(numerator, denominator) {
    const bottom = denominator === undefined ? 1n : BigInt(denominator);
    if (bottom === 0n) throw new Error('rational with a zero denominator');
    const negative = bottom < 0n;
    const top = negative ? -BigInt(numerator) : BigInt(numerator);
    const abs = negative ? -bottom : bottom;
    const divisor = gcd(top, abs) || 1n;
    return { numerator: top / divisor, denominator: abs / divisor };
  }

  function ratAdd(a, b) {
    return rational(a.numerator * b.denominator + b.numerator * a.denominator,
      a.denominator * b.denominator);
  }

  function ratSub(a, b) {
    return rational(a.numerator * b.denominator - b.numerator * a.denominator,
      a.denominator * b.denominator);
  }

  function ratMul(a, b) { return rational(a.numerator * b.numerator, a.denominator * b.denominator); }
  function ratDiv(a, b) { return rational(a.numerator * b.denominator, a.denominator * b.numerator); }
  function ratToNumber(a) { return Number(a.numerator) / Number(a.denominator); }

  /** How wide the exact answer has become. This is the cost rationals are
   *  never quoted with, and it is the reason they are not the default. */
  function ratWidth(a) {
    return { numeratorBits: absBig(a.numerator).toString(2).length,
      denominatorBits: a.denominator.toString(2).length };
  }

  /* -------------------------------------------------------------- ledgers */

  /**
   * The same transaction stream held three ways. `double` is the mistake;
   * `cents` is a scaled integer at two decimal places; `rational` is exact and
   * is the reference. Every divergence reported is a divergence from the
   * rational answer, so "the double is out by a cent" is a measurement.
   */
  function ledger(amounts, policy) {
    const money = scaled(10, 2, policy || 'half-even');
    let asDouble = 0;
    let asCents = 0n;
    let asRational = rational(0n, 1n);

    const trail = [];
    for (let i = 0; i < amounts.length; i += 1) {
      const entry = amounts[i];
      asDouble += entry.amount;
      asCents = money.add(asCents, money.fromString(entry.text));
      asRational = ratAdd(asRational, rational(BigInt(entry.scaled), 100n));
      if (i % Math.max(1, Math.floor(amounts.length / 20)) === 0) {
        trail.push({ n: i + 1, double: asDouble, cents: money.toNumber(asCents),
          exact: ratToNumber(asRational) });
      }
    }
    return {
      double: asDouble,
      cents: asCents,
      centsAsNumber: money.toNumber(asCents),
      exact: asRational,
      exactAsNumber: ratToNumber(asRational),
      doubleError: Math.abs(asDouble - ratToNumber(asRational)),
      centsExact: money.toNumber(asCents) === ratToNumber(asRational),
      trail: trail
    };
  }

  /**
   * Apply a rate to every amount under each policy and total the results.
   * The spread between policies is the aggregate cost of the choice - the
   * number a regulator cares about and an implementation usually never
   * measures.
   */
  function policySweep(amounts, rate) {
    return POLICIES.map(function (policy) {
      let total = 0n;
      let ties = 0;
      for (let i = 0; i < amounts.length; i += 1) {
        const numerator = BigInt(amounts[i]) * BigInt(rate.numerator);
        const denominator = BigInt(rate.denominator);
        if ((absBig(numerator) % denominator) * 2n === denominator) ties += 1;
        total += roundQuotient(numerator, denominator, policy.id);
      }
      const exactTotal = amounts.reduce(function (sum, value) {
        return sum + (Number(value) * rate.numerator) / rate.denominator;
      }, 0);
      return { id: policy.id, label: policy.label, total: total, ties: ties,
        drift: Number(total) - exactTotal };
    });
  }

  return {
    POLICIES: POLICIES,
    roundQuotient: roundQuotient,
    scaled: scaled,
    parseScaled: parseScaled,
    formatScaled: formatScaled,
    rational: rational,
    ratAdd: ratAdd,
    ratSub: ratSub,
    ratMul: ratMul,
    ratDiv: ratDiv,
    ratToNumber: ratToNumber,
    ratWidth: ratWidth,
    ledger: ledger,
    policySweep: policySweep
  };
}));
