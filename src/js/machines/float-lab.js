/**
 * FloatLab - the harness for the real-number half of M17: IEEE 754 itself,
 * the hazards that follow from it, and the representations people reach for
 * when they decide floating point is not acceptable.
 *
 * Every figure here is scored against an exact reference. For summation and
 * variance that reference is the BigInt sum in `algorithms/summation.js`,
 * which is the true total of exactly the doubles in the array; for money it is
 * the rational ledger in `algorithms/fixed-decimal.js`. That matters more here
 * than anywhere else in the milestone, because floating-point error is the one
 * subject where a plausible-looking wrong answer is the norm rather than the
 * exception - "the totals differ by four cents" is not evidence of a bug until
 * somebody says what the total should have been.
 *
 * A note on the exact reference's own error, because it looks like a
 * contradiction in the demo: the exact sum of a list of doubles is generally
 * not itself a double, so rounding it into one costs up to half an ulp. That
 * residue is what the `exact` row reports, and it is the floor - no method
 * that returns a double can do better. Compensated summation reaching the same
 * value is the strongest statement available, not a coincidence.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.FloatLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Floats = scope && scope.FloatInspect ? scope.FloatInspect
    : require('../algorithms/float-inspect.js');
  const Sums = scope && scope.Summation ? scope.Summation
    : require('../algorithms/summation.js');
  const Money = scope && scope.FixedDecimal ? scope.FixedDecimal
    : require('../algorithms/fixed-decimal.js');
  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* -------------------------------------------------------- 17.4 IEEE 754 */

  const FIELD_GROUPS = [
    { label: 'sign', from: 0, to: 0, hue: 'red' },
    { label: 'exponent', from: 1, to: 11, hue: 'amber' },
    { label: 'mantissa', from: 12, to: 63, hue: 'blue' }
  ];

  /** Everything the dissector shows for one value. */
  function dissect(value) {
    const parts = Floats.decompose(value);
    const fields = Floats.fields(value);
    return {
      value: value,
      kind: parts.kind,
      sign: parts.sign,
      biasedExponent: parts.biasedExponent,
      exponent: parts.exponent,
      significand: parts.significand,
      implicitOne: parts.implicitOne,
      fields: fields,
      bits: parts.bits,
      exactDecimal: Floats.exactDecimal(value),
      rational: Floats.exactRational(value),
      neighbours: Floats.neighbours(value),
      ulp: Floats.ulp(value),
      spacingBelow: Floats.spacingBelow(value),
      narrowed: Floats.narrowingError(value),
      groups: FIELD_GROUPS
    };
  }

  /**
   * The ladder of spacings. This is the table that turns "floating point is
   * imprecise" into a specific claim: at 2^52 the gap is 1, at 2^53 it is 2,
   * and from there integer arithmetic is silently lossy.
   */
  function spacingLadder(exponents) {
    return Floats.spacingTable(exponents).map(function (row) {
      return {
        exponent: row.exponent,
        value: row.value,
        gap: row.gap,
        integersExact: row.integersExact,
        incrementSurvives: Floats.incrementSurvives(row.value),
        decimalDigits: Math.max(0, Math.round(Math.log10(row.value / Math.max(row.gap, 5e-324))))
      };
    });
  }

  /** The five landmark values, each with its class and its exact expansion. */
  function landmarks() {
    const names = Object.keys(Floats.LANDMARKS);
    return names.map(function (name) {
      const value = Floats.LANDMARKS[name];
      return { name: name, value: value, kind: Floats.decompose(value).kind,
        exact: Floats.exactDecimal(value).slice(0, 40),
        ulp: Floats.ulp(value) };
    });
  }

  /**
   * `nextAfter` at the four places it usually breaks. Each row states what is
   * expected and whether it held, so the check is legible rather than a
   * pass/fail from a test file the reader cannot see.
   */
  function nextAfterAudit() {
    const min = Floats.LANDMARKS.minNormal;
    return [
      { name: 'up from zero lands on the smallest subnormal',
        got: Floats.nextUp(0), expected: 5e-324, holds: Floats.nextUp(0) === 5e-324 },
      { name: 'down from zero lands on its negative',
        got: Floats.nextDown(0), expected: -5e-324, holds: Floats.nextDown(0) === -5e-324 },
      { name: 'down from the smallest normal is a subnormal',
        got: Floats.decompose(Floats.nextDown(min)).kind, expected: 'subnormal',
        holds: Floats.decompose(Floats.nextDown(min)).kind === 'subnormal' },
      { name: 'the gap below a power of two is half the gap above',
        got: Floats.ulp(1) / Floats.spacingBelow(1), expected: 2,
        holds: Floats.ulp(1) === 2 * Floats.spacingBelow(1) },
      { name: 'up from the largest finite double is infinity',
        got: Floats.nextUp(Number.MAX_VALUE), expected: Infinity,
        holds: Floats.nextUp(Number.MAX_VALUE) === Infinity },
      { name: 'nextAfter is monotonic across a binade boundary',
        got: Floats.ulpsBetween(1, Floats.nextUp(1)), expected: 1n,
        holds: Floats.ulpsBetween(1, Floats.nextUp(1)) === 1n },
      { name: '0.1 + 0.2 and 0.3 are one representable value apart',
        got: Floats.ulpsBetween(0.1 + 0.2, 0.3), expected: 1n,
        holds: Floats.ulpsBetween(0.1 + 0.2, 0.3) === 1n }
    ];
  }

  /**
   * The three ways to compare two floats, on cases where they disagree. An
   * absolute tolerance is wrong at large magnitudes and a relative one is
   * wrong near zero; the ULP distance is the only one that behaves the same
   * everywhere, and it is the one nobody writes.
   */
  function comparisonTable(epsilon) {
    const tolerance = epsilon || 1e-9;
    const cases = [
      { label: '0.1 + 0.2 against 0.3', a: 0.1 + 0.2, b: 0.3 },
      { label: '1e9 + 1 against 1e9', a: 1e9 + 1, b: 1e9 },
      { label: '1e16 + 1 against 1e16', a: 1e16 + 1, b: 1e16 },
      { label: '1e-12 against 2e-12', a: 1e-12, b: 2e-12 },
      { label: 'the two neighbours of 1', a: Floats.nextUp(1), b: Floats.nextDown(1) },
      { label: '0 against the smallest subnormal', a: 0, b: 5e-324 }
    ];
    return cases.map(function (item) {
      const absolute = Math.abs(item.a - item.b);
      const relative = Math.max(Math.abs(item.a), Math.abs(item.b)) === 0
        ? 0 : absolute / Math.max(Math.abs(item.a), Math.abs(item.b));
      return {
        label: item.label,
        absoluteEqual: absolute <= tolerance,
        relativeEqual: relative <= tolerance,
        ulps: Floats.ulpsBetween(item.a, item.b),
        ulpEqual: Floats.ulpsBetween(item.a, item.b) <= 4n,
        absolute: absolute, relative: relative
      };
    });
  }

  /* ------------------------------------------------- 17.5 summation hazards */

  const DATASETS = [
    { id: 'positive-small', label: 'one huge value, then many small positives' },
    { id: 'uniform', label: 'uniform values in [0, 1)' },
    { id: 'alternating', label: 'values that alternate in sign' },
    { id: 'geometric', label: 'a geometric series spanning twenty orders of magnitude' },
    { id: 'clustered', label: 'values clustered far from zero' }
  ];

  /**
   * A double with a full 53-bit mantissa, built from two draws.
   *
   * This exists because of a measurement, not a preference. `Random.seeded`
   * returns `uint32 / 2^32`, so every value it produces is an integer multiple
   * of 2^-32 and carries only 32 significant bits - and the sum of fewer than
   * 2^21 such values is a multiple of 2^-32 small enough to be *exactly*
   * representable. Every partial sum is therefore exact, and naive summation
   * scored a relative error of exactly zero on 200 000 uniform values at five
   * separate seeds. A summation section built on that data would have
   * demonstrated the opposite of its own claim.
   */
  function unit(rng) {
    const high = Math.floor(rng.next() * 2097152);
    const low = Math.floor(rng.next() * 4294967296);
    return (high * 4294967296 + low) / 9007199254740992;
  }

  /** The data the summation lab sums, built to a stated shape. */
  function dataset(id, options) {
    const settings = options || {};
    const count = settings.count || 200000;
    const rng = Random.seeded(settings.seed || 17);
    const values = [];

    if (id === 'positive-small') values.push(1e16);
    for (let i = 0; i < count; i += 1) values.push(sampleFor(id, rng, i, count));
    return values;
  }

  function sampleFor(id, rng, index, count) {
    if (id === 'uniform' || id === 'positive-small') return unit(rng);
    if (id === 'alternating') return (index % 2 === 0 ? 1 : -1) * (1 + unit(rng));
    if (id === 'clustered') return 1e9 + unit(rng);
    return Math.pow(10, -10 + (20 * index) / count) * (0.5 + unit(rng));
  }

  function summationRun(options) {
    const settings = options || {};
    const values = dataset(settings.dataset || 'positive-small', settings);
    const rows = Sums.compare(values);
    return {
      dataset: settings.dataset || 'positive-small',
      count: values.length,
      exactSum: rows[rows.length - 1].exactSum,
      rows: rows,
      naiveError: rows[0].relativeError,
      worstOfTheRest: Math.max(rows[1].relativeError, rows[2].relativeError, rows[3].relativeError)
    };
  }

  function errorSeries(options) {
    const settings = options || {};
    const values = dataset(settings.dataset || 'positive-small', settings);
    return ['naive', 'pairwise', 'kahan'].map(function (id) {
      return { id: id, points: Sums.errorSeries(values, id, settings.samples || 40) };
    });
  }

  const ORDERS = [
    { id: 'as-generated', label: 'as generated' },
    { id: 'ascending', label: 'smallest first' },
    { id: 'descending', label: 'largest first' },
    { id: 'shuffled', label: 'shuffled' }
  ];

  /**
   * The same values in four orders. Floating-point addition is commutative and
   * not associative, so these are four different computations of one quantity
   * and they are allowed to disagree - which is the honest answer to "the
   * batch job and the streaming job produce different totals".
   */
  function orderSensitivity(options) {
    const settings = options || {};
    const values = dataset(settings.dataset || 'geometric', settings);
    const truth = Sums.toNumber(Sums.exactSum(values));
    const rng = Random.seeded((settings.seed || 17) + 1);

    return ORDERS.map(function (order) {
      const ordered = reorder(values, order.id, rng);
      const naive = Sums.naive(ordered).sum;
      const kahan = Sums.kahan(ordered).sum;
      return {
        id: order.id, label: order.label,
        naive: naive, kahan: kahan, exact: truth,
        naiveError: Math.abs((naive - truth) / truth),
        kahanError: Math.abs((kahan - truth) / truth),
        naiveUlps: Floats.ulpsBetween(naive, truth),
        kahanUlps: Floats.ulpsBetween(kahan, truth)
      };
    });
  }

  function reorder(values, id, rng) {
    if (id === 'as-generated') return values;
    if (id === 'shuffled') return rng.shuffle(values.slice());
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    return id === 'ascending' ? sorted : sorted.reverse();
  }

  function varianceRun(options) {
    const settings = options || {};
    const values = dataset(settings.dataset || 'clustered', settings);
    return { count: values.length, rows: Money ? Sums.varianceCompare(values) : [] };
  }

  /**
   * The quadratic formula, which is the textbook example of catastrophic
   * cancellation and also the textbook example of a fix that costs nothing.
   * When b is large and 4ac is small, `-b + sqrt(b*b - 4ac)` subtracts two
   * nearly equal numbers and most of the significant digits vanish; the same
   * root computed as `-2c / (b + sqrt(...))` never forms that difference.
   */
  function quadraticRoots(a, b, c) {
    const discriminant = b * b - 4 * a * c;
    const rootDisc = Math.sqrt(discriminant);
    const naive = (-b + rootDisc) / (2 * a);
    const stable = (-2 * c) / (b + rootDisc);
    const residual = function (x) { return a * x * x + b * x + c; };
    return {
      a: a, b: b, c: c,
      discriminant: discriminant,
      naive: naive, stable: stable,
      naiveResidual: Math.abs(residual(naive)),
      stableResidual: Math.abs(residual(stable)),
      ulps: Floats.ulpsBetween(naive, stable),
      digitsLost: naive === 0 ? 17 :
        Math.max(0, Math.round(Math.log10(Math.abs((naive - stable) / stable) + 1e-300) + 16))
    };
  }

  /** Absorption: the point at which adding a value changes nothing at all. */
  function absorptionLadder(base, addends) {
    return addends.map(function (addend) {
      return {
        base: base, addend: addend,
        sum: base + addend,
        changed: base + addend !== base,
        ulp: Floats.ulp(base),
        ratio: addend / Floats.ulp(base)
      };
    });
  }

  /* --------------------------------------------- 17.6 fixed point and money */

  /** A transaction stream that is exact in cents and inexact as a double. */
  function transactions(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 23);
    const out = [];
    for (let i = 0; i < (settings.count || 10000); i += 1) {
      const cents = 1 + rng.int(settings.maximumCents || 20000);
      out.push({ scaled: cents, amount: cents / 100, text: (cents / 100).toFixed(2) });
    }
    return out;
  }

  function ledgerRun(options) {
    const settings = options || {};
    const rows = transactions(settings);
    const result = Money.ledger(rows, settings.policy || 'half-even');
    return {
      count: rows.length,
      double: result.double,
      cents: result.centsAsNumber,
      exact: result.exactAsNumber,
      centsExact: result.centsExact,
      doubleError: result.doubleError,
      doubleErrorCents: result.doubleError * 100,
      trail: result.trail
    };
  }

  /**
   * Where the double ledger actually breaks, measured rather than assumed.
   *
   * The folk version of this claim - "doubles lose money" - is not what the
   * measurement says at small scale: ten thousand transactions total to within
   * a ten-millionth of a cent, and rounding that to cents gives the right
   * answer every time. The error grows with the count, so the honest question
   * is where it crosses half a cent, and this ladder answers it. The other
   * half of the answer is below: long before the total is wrong, the *value*
   * stops comparing equal to itself, which is the failure that actually
   * reaches production.
   */
  function ledgerDivergence(options) {
    const settings = options || {};
    const counts = settings.counts || [1e3, 1e4, 1e5, 1e6];
    const rows = transactions({ count: Math.max.apply(null, counts),
      seed: settings.seed || 23, maximumCents: settings.maximumCents });
    let asDouble = 0;
    let asCents = 0n;
    const out = [];
    let next = 0;

    for (let i = 0; i < rows.length; i += 1) {
      asDouble += rows[i].amount;
      asCents += BigInt(rows[i].scaled);
      if (i + 1 !== counts[next]) continue;
      out.push(divergenceRow(i + 1, asDouble, asCents));
      next += 1;
      if (next >= counts.length) break;
    }
    return out;
  }

  function divergenceRow(count, asDouble, asCents) {
    const exact = Number(asCents) / 100;
    const error = Math.abs(asDouble - exact);
    return {
      count: count,
      double: asDouble,
      exact: exact,
      error: error,
      errorCents: error * 100,
      crossesHalfCent: error >= 0.005,
      formatsCorrectly: asDouble.toFixed(2) === (Number(asCents) / 100).toFixed(2),
      comparesEqual: asDouble === exact
    };
  }

  /**
   * How often a double total formats to a different cent than the exact one.
   * Each trial is an independent stream, so the count is a rate rather than an
   * anecdote - and the rate is what tells you whether "it has always worked"
   * is evidence.
   */
  function centRoundingFailures(options) {
    const settings = options || {};
    const trials = settings.trials || 2000;
    const count = settings.count || 500;
    let mismatches = 0;
    let unequal = 0;

    for (let trial = 0; trial < trials; trial += 1) {
      const rows = transactions({ count: count, seed: (settings.seed || 23) + trial,
        maximumCents: settings.maximumCents });
      let asDouble = 0;
      let asCents = 0n;
      for (let i = 0; i < rows.length; i += 1) {
        asDouble += rows[i].amount;
        asCents += BigInt(rows[i].scaled);
      }
      const exact = Number(asCents) / 100;
      if (asDouble.toFixed(2) !== exact.toFixed(2)) mismatches += 1;
      if (asDouble !== exact) unequal += 1;
    }
    return { trials: trials, count: count, mismatches: mismatches, unequal: unequal,
      mismatchRate: mismatches / trials, unequalRate: unequal / trials };
  }

  /**
   * Where the double DOES produce a wrong cent: multiplication, not addition.
   *
   * Adding money in doubles is survivable at any scale a business reaches -
   * the ladder above says so. Applying a rate is not, because the product
   * lands a fraction of an ulp on the wrong side of a half-cent boundary and
   * `Math.round` then takes the whole cent the other way. Each row here is one
   * line item taxed both ways; `disagreements` counts the ones where the two
   * answers differ by a cent, and the examples name them.
   */
  function rateApplication(options) {
    const settings = options || {};
    const rows = transactions({ count: settings.count || 200000,
      seed: settings.seed || 29, maximumCents: settings.maximumCents });
    const rate = settings.rate || { numerator: 875, denominator: 10000 };
    const state = { disagreements: 0, examples: [], doubleTotal: 0, exactTotal: 0n };

    for (let i = 0; i < rows.length; i += 1) rateRow(rows[i], rate, state);
    return {
      count: rows.length,
      rate: rate,
      disagreements: state.disagreements,
      rateOfError: state.disagreements / rows.length,
      examples: state.examples,
      doubleTotalCents: state.doubleTotal,
      exactTotalCents: Number(state.exactTotal),
      centsApart: state.doubleTotal - Number(state.exactTotal)
    };
  }

  function rateRow(row, rate, state) {
    const asDouble = Math.round(row.amount * (rate.numerator / rate.denominator) * 100);
    const asExact = Money.roundQuotient(BigInt(row.scaled) * BigInt(rate.numerator),
      BigInt(rate.denominator), 'half-up');
    state.doubleTotal += asDouble;
    state.exactTotal += asExact;
    if (asDouble === Number(asExact)) return;
    state.disagreements += 1;
    if (state.examples.length < 6) {
      state.examples.push({ cents: row.scaled, asDouble: asDouble, asExact: Number(asExact),
        product: row.amount * (rate.numerator / rate.denominator) * 100 });
    }
  }

  /** The rounding policies applied to one rate over the whole stream. */
  function policyRun(options) {
    const settings = options || {};
    const rows = transactions(settings);
    const amounts = rows.map(function (row) { return row.scaled; });
    const rate = settings.rate || { numerator: 875, denominator: 10000 };
    const sweep = Money.policySweep(amounts, rate);
    const spread = sweep.map(function (row) { return Number(row.total); });
    return {
      count: rows.length,
      rate: rate,
      rows: sweep,
      ties: sweep[0].ties,
      spread: Math.max.apply(null, spread) - Math.min.apply(null, spread)
    };
  }

  /**
   * The same computation in each representation, so the cost column is not a
   * guess: exact rationals keep every digit and their denominators grow, and
   * that growth is the reason nobody ships them.
   */
  function representationCost(options) {
    const settings = options || {};
    const steps = settings.steps || 200;
    let value = Money.rational(1n, 1n);
    const widths = [];
    for (let i = 1; i <= steps; i += 1) {
      value = Money.ratAdd(value, Money.rational(1n, BigInt(i)));
      if (i % Math.max(1, Math.floor(steps / 10)) === 0) {
        widths.push({ step: i, bits: Money.ratWidth(value).denominatorBits,
          value: Money.ratToNumber(value) });
      }
    }
    return {
      steps: steps,
      widths: widths,
      finalDenominatorBits: Money.ratWidth(value).denominatorBits,
      asDouble: Money.ratToNumber(value)
    };
  }

  /** What each representation can and cannot promise, as table rows. */
  const REPRESENTATIONS = [
    { id: 'double', label: 'binary floating point', exactDecimals: false, exactHalving: true,
      unbounded: false, cost: 'one instruction',
      use: 'physics, graphics, statistics — anything measured rather than counted' },
    { id: 'cents', label: 'scaled integer (cents)', exactDecimals: true, exactHalving: false,
      unbounded: false, cost: 'one instruction, plus a rounding decision on division',
      use: 'money, and anything else denominated in a fixed unit' },
    { id: 'decimal', label: 'decimal floating point', exactDecimals: true, exactHalving: false,
      unbounded: false, cost: 'software on most hardware, tens of instructions',
      use: 'finance where the standard mandates decimal semantics' },
    { id: 'rational', label: 'exact rational', exactDecimals: true, exactHalving: true,
      unbounded: true, cost: 'a gcd per operation, and denominators that grow',
      use: 'symbolic work and test oracles, not production arithmetic' }
  ];

  return {
    FIELD_GROUPS: FIELD_GROUPS,
    unit: unit,
    DATASETS: DATASETS,
    ORDERS: ORDERS,
    REPRESENTATIONS: REPRESENTATIONS,
    dissect: dissect,
    spacingLadder: spacingLadder,
    landmarks: landmarks,
    nextAfterAudit: nextAfterAudit,
    comparisonTable: comparisonTable,
    dataset: dataset,
    summationRun: summationRun,
    errorSeries: errorSeries,
    orderSensitivity: orderSensitivity,
    varianceRun: varianceRun,
    quadraticRoots: quadraticRoots,
    absorptionLadder: absorptionLadder,
    transactions: transactions,
    ledgerRun: ledgerRun,
    ledgerDivergence: ledgerDivergence,
    centRoundingFailures: centRoundingFailures,
    rateApplication: rateApplication,
    policyRun: policyRun,
    representationCost: representationCost
  };
}));
