/**
 * Karatsuba multiplication over digit arrays, beside the schoolbook algorithm
 * it replaces, with the digit multiplications counted rather than timed.
 *
 * Schoolbook multiplication of two n-digit numbers does n² digit products.
 * Karatsuba computes the same result from three products of half-size numbers
 * instead of four, because the middle term is recoverable by subtraction:
 *
 *   (a·B + b)(c·B + d) = ac·B² + (ad + bc)·B + bd
 *   ad + bc = (a + b)(c + d) − ac − bd
 *
 * so T(n) = 3T(n/2) + O(n), which is n^log2(3) ≈ n^1.585. The exponent is the
 * whole result and it is small: at 32 digits Karatsuba does more work than
 * schoolbook, at 1 024 digits it does an order of magnitude less. Every real
 * bignum library therefore switches at a threshold, and the threshold is a
 * measurement rather than a theorem - which is why `crossover` exists here and
 * returns a measured number instead of a quoted one.
 *
 * Digits are little-endian arrays in a base the caller picks, so the counters
 * mean what they say: one entry of the array is one digit, and one call to the
 * inner multiply is one digit product.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Karatsuba = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const BASE = 10;

  function emptyReport() {
    return { digitProducts: 0, additions: 0, calls: 0, baseCases: 0, maxDepth: 0, allocations: 0 };
  }

  /** Little-endian digits of a non-negative integer, or of a decimal string. */
  function digitsOf(value, base) {
    const radix = base || BASE;
    const text = typeof value === 'string' ? value : String(value);
    if (/^[0-9]+$/.test(text) && radix === BASE) {
      return text.split('').reverse().map(Number);
    }

    let n = BigInt(text);
    const big = BigInt(radix);
    const out = [];
    while (n > 0n) {
      out.push(Number(n % big));
      n /= big;
    }
    return out.length ? out : [0];
  }

  function toBigInt(digits, base) {
    const radix = BigInt(base || BASE);
    let value = 0n;
    for (let i = digits.length - 1; i >= 0; i -= 1) value = value * radix + BigInt(digits[i]);
    return value;
  }

  function trim(digits) {
    const out = digits.slice();
    while (out.length > 1 && out[out.length - 1] === 0) out.pop();
    return out;
  }

  function carry(digits, base, report) {
    const radix = base || BASE;
    const out = digits.slice();
    let held = 0;
    for (let i = 0; i < out.length; i += 1) {
      const total = out[i] + held;
      out[i] = ((total % radix) + radix) % radix;
      held = Math.floor((total - out[i]) / radix);
      if (report) report.additions += 1;
    }
    while (held > 0) {
      out.push(held % radix);
      held = Math.floor(held / radix);
    }
    return trim(out);
  }

  function add(a, b, base, report) {
    const out = new Array(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = (a[i] || 0) + (b[i] || 0);
      if (report) report.additions += 1;
    }
    return carry(out, base, report);
  }

  function subtract(a, b, base, report) {
    const out = a.slice();
    for (let i = 0; i < out.length; i += 1) {
      out[i] -= (b[i] || 0);
      if (report) report.additions += 1;
    }
    return carry(out, base, report);
  }

  function shift(digits, places) {
    if (digits.length === 1 && digits[0] === 0) return [0];
    return new Array(places).fill(0).concat(digits);
  }

  /** The n² algorithm, counted the same way, so the comparison is between two
   *  measurements rather than between a measurement and a formula. */
  function schoolbook(a, b, options) {
    const settings = options || {};
    const base = settings.base || BASE;
    const report = settings.report || emptyReport();
    const out = new Array(a.length + b.length).fill(0);
    report.allocations += 1;

    for (let i = 0; i < a.length; i += 1) {
      for (let j = 0; j < b.length; j += 1) {
        out[i + j] += a[i] * b[j];
        report.digitProducts += 1;
      }
    }
    return { digits: carry(out, base, report), report: report };
  }

  function splitAt(digits, at) {
    return { low: trim(digits.slice(0, at)), high: trim(digits.slice(at)) };
  }

  /**
   * Karatsuba, with the schoolbook threshold as a parameter because that is
   * what it is in every real implementation. `threshold: 1` gives the pure
   * recursion, which is the configuration that makes the three-products claim
   * visible in the counter and is also the slowest thing here.
   */
  function karatsuba(a, b, options) {
    const settings = options || {};
    const base = settings.base || BASE;
    const threshold = Math.max(1, settings.threshold === undefined ? 32 : settings.threshold);
    const report = settings.report || emptyReport();

    function multiply(x, y, depth) {
      report.calls += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);

      const n = Math.max(x.length, y.length);
      if (n <= threshold) {
        report.baseCases += 1;
        return schoolbook(x, y, { base: base, report: report }).digits;
      }

      const half = n >> 1;
      const left = splitAt(x, Math.min(half, x.length));
      const right = splitAt(y, Math.min(half, y.length));

      const low = multiply(left.low, right.low, depth + 1);
      const high = multiply(left.high, right.high, depth + 1);
      const middle = subtract(subtract(
        multiply(add(left.low, left.high, base, report), add(right.low, right.high, base, report), depth + 1),
        low, base, report), high, base, report);

      report.allocations += 3;
      return carry(add(add(shift(high, 2 * half), shift(middle, half), base, report), low, base, report),
        base, report);
    }

    return { digits: multiply(a, b, 1), report: report };
  }

  /**
   * Where the two algorithms cross over, measured in digit products.
   *
   * The answer is not a constant of the algorithm: it depends on the base, on
   * the threshold and on how expensive one digit product is relative to one
   * addition. Reporting it as a measured sweep rather than a remembered number
   * is the section's point.
   */
  function crossover(options) {
    const settings = options || {};
    const base = settings.base || BASE;
    const threshold = settings.threshold === undefined ? 1 : settings.threshold;
    const sizes = settings.sizes || [4, 8, 16, 32, 64, 128, 256, 512, 1024];
    const seed = settings.seed || 1;

    let state = seed >>> 0;
    function nextDigit() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % base;
    }

    return sizes.map(function (n) {
      const a = [];
      const b = [];
      for (let i = 0; i < n; i += 1) { a.push(nextDigit()); b.push(nextDigit()); }
      a[n - 1] = Math.max(1, a[n - 1]);
      b[n - 1] = Math.max(1, b[n - 1]);

      const naive = schoolbook(a, b, { base: base });
      const fast = karatsuba(a, b, { base: base, threshold: threshold });
      return {
        n: n,
        schoolbook: naive.report.digitProducts,
        karatsuba: fast.report.digitProducts,
        ratio: naive.report.digitProducts / Math.max(1, fast.report.digitProducts),
        predicted: Math.pow(n, Math.log2(3)),
        agrees: toBigInt(naive.digits, base) === toBigInt(fast.digits, base)
      };
    });
  }

  return {
    BASE: BASE,
    EXPONENT: Math.log2(3),
    emptyReport: emptyReport,
    digitsOf: digitsOf,
    toBigInt: toBigInt,
    trim: trim,
    add: add,
    subtract: subtract,
    schoolbook: schoolbook,
    karatsuba: karatsuba,
    crossover: crossover
  };
}));
