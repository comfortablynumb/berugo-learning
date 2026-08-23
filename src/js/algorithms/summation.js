/**
 * Adding up a list of doubles, five ways, with the exact answer available to
 * measure all five against.
 *
 * The exact answer is the part that makes this a measurement rather than an
 * opinion. Every finite double is an integer times a power of two, so a list
 * of them can be summed with no rounding at all: align every significand to
 * the smallest exponent in the list and add the integers in BigInt. The result
 * is the true sum of exactly those doubles - not of the real numbers somebody
 * meant, which is a different and unrecoverable question, but of the values
 * actually in the array. Against that, "naive summation loses 1.2%" stops
 * being a vibe.
 *
 * The four inexact methods differ in what they do with the bits that fall off
 * the bottom of the accumulator:
 *
 * - naive throws them away, once per element, and the errors accumulate in the
 *   same direction whenever the data has a sign;
 * - pairwise never lets the accumulator get far ahead of the addend, so the
 *   error grows with log n rather than n, for no extra arithmetic per element;
 * - Kahan keeps the discarded low part in a compensation variable and feeds it
 *   back on the next step, which costs three extra operations and buys an
 *   error bound independent of n;
 * - Neumaier fixes the case Kahan gets wrong - when the incoming value is
 *   larger than the running sum, it is the *sum* whose low bits are lost, and
 *   Kahan's subtraction looks in the wrong place.
 *
 * Non-associativity is not a defect of any of them. Floating-point addition is
 * commutative and not associative, so the answer genuinely depends on the
 * order, which is why a parallel reduction and a serial loop over the same
 * array disagree and neither is wrong.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Summation = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const view = new DataView(new ArrayBuffer(8));

  function decompose(x) {
    if (x === 0 || !Number.isFinite(x)) return { mantissa: 0n, scale: 0 };
    view.setFloat64(0, x);
    const bits = view.getBigUint64(0);
    const negative = (bits >> 63n) === 1n;
    const biased = Number((bits >> 52n) & 0x7ffn);
    const fraction = bits & ((1n << 52n) - 1n);
    const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
    return {
      mantissa: negative ? -mantissa : mantissa,
      scale: biased === 0 ? -1074 : biased - 1075
    };
  }

  /** The true sum of the doubles in the array, as mantissa x 2^scale. */
  function exactSum(values) {
    let scale = 0;
    let seen = false;
    for (let i = 0; i < values.length; i += 1) {
      const part = decompose(values[i]);
      if (part.mantissa === 0n) continue;
      if (!seen || part.scale < scale) { scale = part.scale; seen = true; }
    }
    let total = 0n;
    for (let i = 0; i < values.length; i += 1) {
      const part = decompose(values[i]);
      if (part.mantissa === 0n) continue;
      total += part.mantissa << BigInt(part.scale - scale);
    }
    return { mantissa: total, scale: scale };
  }

  /** An exact value converted to the nearest double, rounding rather than
   *  truncating so the reference is not itself a source of bias. */
  function toNumber(exact) {
    if (exact.mantissa === 0n) return 0;
    const negative = exact.mantissa < 0n;
    let magnitude = negative ? -exact.mantissa : exact.mantissa;
    let scale = exact.scale;
    const bits = magnitude.toString(2).length;

    if (bits > 54) {
      const shift = BigInt(bits - 54);
      magnitude = (magnitude >> shift) + 1n >> 1n;
      scale += bits - 54 + 1;
    }
    const value = Number(magnitude) * Math.pow(2, scale);
    return negative ? -value : value;
  }

  function subtract(exact, approximation) {
    const other = decompose(approximation);
    const scale = Math.min(exact.scale, other.scale);
    const left = exact.mantissa << BigInt(exact.scale - scale);
    const right = other.mantissa << BigInt(other.scale - scale);
    return { mantissa: left - right, scale: scale };
  }

  /* --------------------------------------------------------- the methods */

  function naive(values) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) total += values[i];
    return { sum: total, operations: values.length, name: 'naive' };
  }

  /**
   * Sum in a balanced tree rather than a chain. Below the block size the loop
   * is the naive one, because the recursion overhead swamps the accuracy
   * gain at small sizes and the error over a short block is negligible anyway.
   */
  function pairwise(values, blockSize) {
    const block = blockSize || 128;
    const state = { operations: 0 };
    const sum = pairwiseRange(values, 0, values.length, block, state);
    return { sum: sum, operations: state.operations, name: 'pairwise' };
  }

  function pairwiseRange(values, from, to, block, state) {
    if (to - from <= block) {
      let total = 0;
      for (let i = from; i < to; i += 1) { total += values[i]; state.operations += 1; }
      return total;
    }
    const middle = from + ((to - from) >> 1);
    const left = pairwiseRange(values, from, middle, block, state);
    const right = pairwiseRange(values, middle, to, block, state);
    state.operations += 1;
    return left + right;
  }

  /**
   * Kahan compensation. `t - sum` recovers the part of `y` that made it into
   * the sum, so `(t - sum) - y` is what did not, and carrying it forward means
   * the next addition starts by paying back the last one's rounding.
   */
  function kahan(values) {
    let sum = 0;
    let compensation = 0;
    for (let i = 0; i < values.length; i += 1) {
      const y = values[i] - compensation;
      const t = sum + y;
      compensation = (t - sum) - y;
      sum = t;
    }
    return { sum: sum, operations: 4 * values.length, name: 'kahan',
      compensation: compensation };
  }

  /**
   * Neumaier's variant. Kahan assumes the running sum is the larger operand;
   * when it is not - which happens on the first few elements, and on any data
   * where a large value arrives late - the low bits lost belong to the sum
   * rather than to the addend, and Kahan's subtraction recovers nothing. The
   * branch here picks the right subtraction, and the compensation is added
   * once at the end rather than fed back.
   */
  function neumaier(values) {
    let sum = 0;
    let compensation = 0;
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      const t = sum + value;
      compensation += Math.abs(sum) >= Math.abs(value)
        ? (sum - t) + value
        : (value - t) + sum;
      sum = t;
    }
    return { sum: sum + compensation, operations: 5 * values.length, name: 'neumaier',
      compensation: compensation };
  }

  function exact(values) {
    const total = exactSum(values);
    return { sum: toNumber(total), operations: values.length, name: 'exact', value: total };
  }

  const METHODS = [
    { id: 'naive', label: 'naive left-to-right', run: naive },
    { id: 'pairwise', label: 'pairwise', run: pairwise },
    { id: 'kahan', label: 'Kahan compensated', run: kahan },
    { id: 'neumaier', label: 'Neumaier compensated', run: neumaier },
    { id: 'exact', label: 'exact (BigInt)', run: exact }
  ];

  /** Every method on one array, each scored against the exact sum. */
  function compare(values) {
    const truth = exactSum(values);
    const reference = toNumber(truth);
    return METHODS.map(function (method) {
      const result = method.run(values);
      const error = toNumber(subtract(truth, result.sum));
      return {
        id: method.id,
        label: method.label,
        sum: result.sum,
        operations: result.operations,
        absoluteError: Math.abs(error),
        relativeError: reference === 0 ? Math.abs(error) : Math.abs(error / reference),
        exactSum: reference
      };
    });
  }

  /** The running error of one method, sampled as the sum proceeds. */
  function errorSeries(values, methodId, samples) {
    const count = Math.max(2, samples || 40);
    const method = METHODS.filter(function (m) { return m.id === methodId; })[0] || METHODS[0];
    const step = Math.max(1, Math.floor(values.length / count));
    const out = [];
    for (let end = step; end <= values.length; end += step) {
      const slice = values.slice(0, end);
      const truth = exactSum(slice);
      const reference = toNumber(truth);
      const got = method.run(slice).sum;
      out.push({ n: end, error: Math.abs(toNumber(subtract(truth, got))),
        relative: reference === 0 ? 0 : Math.abs(toNumber(subtract(truth, got)) / reference) });
    }
    return out;
  }

  /* ------------------------------------------------------------ variance */

  /**
   * The textbook one-pass formula. It computes a difference of two large,
   * nearly equal numbers, which is catastrophic cancellation by construction:
   * on values clustered far from zero it returns a variance that is wrong by
   * orders of magnitude and can be negative, which is not merely inaccurate
   * but impossible.
   */
  function naiveVariance(values) {
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < values.length; i += 1) {
      sum += values[i];
      sumSquares += values[i] * values[i];
    }
    const n = values.length;
    return { variance: (sumSquares - (sum * sum) / n) / n, name: 'sum of squares' };
  }

  function twoPassVariance(values) {
    const n = values.length;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += values[i];
    const mean = sum / n;
    let total = 0;
    for (let i = 0; i < n; i += 1) total += (values[i] - mean) * (values[i] - mean);
    return { variance: total / n, mean: mean, name: 'two pass' };
  }

  /**
   * Welford. The running mean is updated by the *deviation* of the new point,
   * which is a small number, and M2 accumulates products of small numbers -
   * so nothing large is ever subtracted from anything large. One pass, O(1)
   * state, and it is the algorithm every streaming metrics pipeline
   * rediscovers.
   */
  function welford(values) {
    let count = 0;
    let mean = 0;
    let m2 = 0;
    for (let i = 0; i < values.length; i += 1) {
      count += 1;
      const delta = values[i] - mean;
      mean += delta / count;
      m2 += delta * (values[i] - mean);
    }
    return { variance: count === 0 ? 0 : m2 / count, mean: mean, m2: m2, count: count,
      name: 'Welford' };
  }

  /** The exact variance of the stored doubles, as a rational, for scoring. */
  function exactVariance(values) {
    const n = BigInt(values.length);
    if (n === 0n) return 0;
    const total = exactSum(values);
    const scale = total.scale;
    let sumSquares = { mantissa: 0n, scale: 2 * scale };
    for (let i = 0; i < values.length; i += 1) {
      const part = decompose(values[i]);
      const aligned = part.mantissa << BigInt(part.scale - scale);
      sumSquares = { mantissa: sumSquares.mantissa + aligned * aligned, scale: 2 * scale };
    }
    const numerator = sumSquares.mantissa * n - total.mantissa * total.mantissa;
    return toNumber({ mantissa: numerator, scale: 2 * scale }) / Number(n * n);
  }

  function varianceCompare(values) {
    const truth = exactVariance(values);
    return [naiveVariance(values), twoPassVariance(values), welford(values)].map(function (r) {
      return {
        name: r.name,
        variance: r.variance,
        exact: truth,
        relativeError: truth === 0 ? Math.abs(r.variance) : Math.abs((r.variance - truth) / truth),
        negative: r.variance < 0
      };
    });
  }

  return {
    METHODS: METHODS,
    decompose: decompose,
    exactSum: exactSum,
    toNumber: toNumber,
    subtract: subtract,
    naive: naive,
    pairwise: pairwise,
    kahan: kahan,
    neumaier: neumaier,
    exact: exact,
    compare: compare,
    errorSeries: errorSeries,
    naiveVariance: naiveVariance,
    twoPassVariance: twoPassVariance,
    welford: welford,
    exactVariance: exactVariance,
    varianceCompare: varianceCompare
  };
}));
