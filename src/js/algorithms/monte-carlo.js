/**
 * Monte Carlo estimation, and the four ways to make it converge faster.
 *
 * The estimator is the mean of f over random points, and its standard error is
 * σ/√N whatever f is and whatever dimension it lives in. Two consequences run
 * through the whole module and both are measured rather than asserted:
 *
 *   - the 1/√N rate is *terrible* in one dimension, where Gauss-Legendre from
 *     18.7 gets ten digits from four points, and unbeatable in thirty, where a
 *     product rule with two nodes per axis already needs 2^30 points. The
 *     crossover is what `dimensionSweep` measures.
 *   - because the rate is fixed, the only lever is σ. Every variance-reduction
 *     technique here reduces σ without changing what is being estimated, and
 *     each reports its achieved reduction as a measured factor against the
 *     plain estimator run on the same seeds.
 *
 * The reductions are not interchangeable. Antithetic sampling helps when f is
 * monotone and does nothing - or harms - when f is symmetric about the middle
 * of the domain. A control variate helps in proportion to its correlation with
 * f, and the optimal coefficient is estimated from the same samples, which
 * introduces a bias that vanishes as N grows. Stratification helps when the
 * variance is spread across the domain and cannot help at all when it is
 * concentrated in one stratum. Importance sampling is the only one that turns
 * an impossible estimate into a possible one, and the only one that can be
 * catastrophically worse than plain sampling if the proposal has a lighter
 * tail than the target - so `importance` reports the weight concentration
 * (the effective sample size of the weights) beside the estimate.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MonteCarlo = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const SQRT_2PI = Math.sqrt(2 * Math.PI);

  /* ----------------------------------------------------- exact references */

  /** The standard normal density. */
  function phi(x) {
    return Math.exp(-0.5 * x * x) / SQRT_2PI;
  }

  /**
   * The upper tail P(Z > x) by the Mills-ratio continued fraction, which is
   * accurate to machine precision for x >= 2 and is the reference the rare-
   * event estimates are scored against. A series would lose every digit to
   * cancellation exactly where this problem lives.
   */
  function normalTail(x) {
    if (x < 0) return 1 - normalTail(-x);
    if (x < 2) return 0.5 * erfcSeries(x / Math.SQRT2);
    let c = 0;
    for (let k = 120; k >= 1; k -= 1) c = k / (x + c);
    return phi(x) / (x + c);
  }

  /** erfc by its Taylor series through erf - fine below the tail region. */
  function erfcSeries(z) {
    let term = z;
    let sum = z;
    for (let n = 1; n < 200; n += 1) {
      term *= -z * z / n;
      sum += term / (2 * n + 1);
    }
    return 1 - 2 * sum / Math.sqrt(Math.PI);
  }

  /* ------------------------------------------------------- the estimators */

  function summarise(values, exact, evaluations) {
    const n = values.length;
    let mean = 0;
    for (let i = 0; i < n; i += 1) mean += values[i];
    mean /= n;
    let sq = 0;
    for (let i = 0; i < n; i += 1) sq += (values[i] - mean) * (values[i] - mean);
    const variance = n > 1 ? sq / (n - 1) : 0;
    const standardError = Math.sqrt(variance / n);

    return { estimate: mean, variance: variance, standardError: standardError,
      samples: n, evaluations: evaluations === undefined ? n : evaluations,
      error: Math.abs(mean - exact), exact: exact,
      inInterval: Math.abs(mean - exact) <= 1.96 * standardError,
      interval: [mean - 1.96 * standardError, mean + 1.96 * standardError] };
  }

  /** The plain estimator: N independent uniform points. */
  function plain(problem, options) {
    const rng = options.rng;
    const n = options.samples;
    const values = new Array(n);
    for (let i = 0; i < n; i += 1) values[i] = problem.f(rng.next());
    return summarise(values, problem.exact, n);
  }

  /**
   * Antithetic variates: pair u with 1 - u. Half the draws, the same number
   * of evaluations, and the pair's average has variance (1 + ρ)/2 times the
   * plain one - so a monotone f, whose pairs are negatively correlated, wins
   * and a symmetric one gains nothing.
   */
  function antithetic(problem, options) {
    const rng = options.rng;
    const pairs = Math.floor(options.samples / 2);
    const values = new Array(pairs);

    for (let i = 0; i < pairs; i += 1) {
      const u = rng.next();
      values[i] = 0.5 * (problem.f(u) + problem.f(1 - u));
    }
    return summarise(values, problem.exact, pairs * 2);
  }

  /**
   * A control variate with the optimal coefficient estimated from the same
   * samples: f - c(g - E[g]) has variance (1 - ρ²) times f's at c = ρσ_f/σ_g.
   * The correlation is reported because the reduction is entirely determined
   * by it, and a control variate with ρ = 0.3 is not worth the code.
   */
  function control(problem, options) {
    const rng = options.rng;
    const n = options.samples;
    const fs = new Array(n);
    const gs = new Array(n);

    for (let i = 0; i < n; i += 1) {
      const u = rng.next();
      fs[i] = problem.f(u);
      gs[i] = problem.control(u);
    }
    const fit = optimalCoefficient(fs, gs);
    const values = new Array(n);
    for (let i = 0; i < n; i += 1) values[i] = fs[i] - fit.c * (gs[i] - problem.controlMean);
    const out = summarise(values, problem.exact, n);
    out.coefficient = fit.c;
    out.correlation = fit.rho;
    return out;
  }

  function optimalCoefficient(fs, gs) {
    const n = fs.length;
    let mf = 0;
    let mg = 0;
    for (let i = 0; i < n; i += 1) { mf += fs[i]; mg += gs[i]; }
    mf /= n; mg /= n;
    let cov = 0;
    let vf = 0;
    let vg = 0;

    for (let i = 0; i < n; i += 1) {
      const df = fs[i] - mf;
      const dg = gs[i] - mg;
      cov += df * dg; vf += df * df; vg += dg * dg;
    }
    return { c: vg === 0 ? 0 : cov / vg, rho: vf * vg === 0 ? 0 : cov / Math.sqrt(vf * vg) };
  }

  /**
   * Stratified sampling: one point drawn uniformly inside each of N equal
   * strata. The between-strata variance is removed exactly, so what remains
   * is only the variance *within* a stratum - which shrinks with the stratum
   * width, giving a rate better than 1/√N for a smooth f.
   */
  function stratified(problem, options) {
    const rng = options.rng;
    const n = options.samples;
    const values = new Array(n);

    for (let i = 0; i < n; i += 1) values[i] = problem.f((i + rng.next()) / n);
    const out = summarise(values, problem.exact, n);
    /* The sample variance across strata is NOT the estimator's variance here:
       the points are not identically distributed. The honest error bar is the
       measured deviation, which is why `error` is what the demo compares. */
    out.standardError = Math.sqrt(out.variance / n) / Math.sqrt(n);
    out.interval = [out.estimate - 1.96 * out.standardError,
      out.estimate + 1.96 * out.standardError];
    out.inInterval = out.error <= 1.96 * out.standardError;
    return out;
  }

  /* -------------------------------------------------- low-discrepancy sets */

  /** The van der Corput sequence: index written in base b, digits reflected
   *  about the point. Base 2 gives 1/2, 1/4, 3/4, 1/8, 5/8, ... */
  function vanDerCorput(index, base) {
    let out = 0;
    let denominator = 1;
    let n = index;

    while (n > 0) {
      denominator *= base;
      out += (n % base) / denominator;
      n = Math.floor(n / base);
    }
    return out;
  }

  /** Halton in d dimensions is van der Corput on the first d primes. */
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

  function halton(index, dimensions) {
    const out = new Array(dimensions);
    for (let d = 0; d < dimensions; d += 1) out[d] = vanDerCorput(index + 1, PRIMES[d]);
    return out;
  }

  /**
   * Quasi-Monte Carlo: the same estimator on a deterministic low-discrepancy
   * set. The error rate becomes O((log N)^d / N) rather than O(1/√N), which
   * is far better in low dimensions and degrades with d. There is no random
   * error to report, so the standard error is meaningless and reported as
   * null rather than as zero - a zero would read as "exact".
   */
  function quasi(problem, options) {
    const n = options.samples;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += problem.f(vanDerCorput(i + 1, 2));
    const estimate = sum / n;

    return { estimate: estimate, variance: null, standardError: null, samples: n,
      evaluations: n, error: Math.abs(estimate - problem.exact), exact: problem.exact,
      inInterval: null, interval: null, deterministic: true };
  }

  /** One-dimensional star discrepancy, exactly, from the sorted point set. */
  function starDiscrepancy(points) {
    const sorted = points.slice().sort(function (a, b) { return a - b; });
    const n = sorted.length;
    let worst = 0;

    for (let i = 0; i < n; i += 1) {
      worst = Math.max(worst, Math.abs((i + 1) / n - sorted[i]), Math.abs(sorted[i] - i / n));
    }
    return worst;
  }

  /* ------------------------------------------------- importance sampling */

  /**
   * Estimate P(Z > threshold) by sampling from N(shift, 1) and reweighting.
   * At threshold 4 the plain estimator needs about 3.2e4 samples to see ONE
   * hit, so its estimate is almost always exactly zero with a standard error
   * of exactly zero - a confident, wrong answer with no warning attached.
   *
   * `weightEss` is the effective sample size of the importance weights. It is
   * the diagnostic that catches a bad proposal: a shift far past the
   * threshold concentrates all the weight on a handful of draws and the
   * estimate is then worse than plain sampling despite looking converged.
   */
  function importance(options) {
    const rng = options.rng;
    const n = options.samples;
    const threshold = options.threshold;
    const shift = options.shift;
    const values = new Array(n);

    for (let i = 0; i < n; i += 1) {
      const x = shift + rng.gaussian(0, 1);
      values[i] = x > threshold ? Math.exp(-shift * x + 0.5 * shift * shift) : 0;
    }
    const out = summarise(values, normalTail(threshold), n);
    out.shift = shift;
    out.weightEss = effectiveWeightSize(values);
    out.hits = values.filter(function (v) { return v > 0; }).length;
    return out;
  }

  /** (Σw)² / Σw² - the number of equally weighted draws this set is worth. */
  function effectiveWeightSize(weights) {
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < weights.length; i += 1) { sum += weights[i]; sq += weights[i] * weights[i]; }
    return sq === 0 ? 0 : (sum * sum) / sq;
  }

  /** Plain sampling of the same rare event, for the comparison. */
  function rarePlain(options) {
    const rng = options.rng;
    const n = options.samples;
    const values = new Array(n);

    for (let i = 0; i < n; i += 1) values[i] = rng.gaussian(0, 1) > options.threshold ? 1 : 0;
    const out = summarise(values, normalTail(options.threshold), n);
    out.hits = values.filter(function (v) { return v > 0; }).length;
    out.weightEss = out.hits;
    return out;
  }

  return {
    phi: phi, normalTail: normalTail,
    plain: plain, antithetic: antithetic, control: control, stratified: stratified,
    quasi: quasi, importance: importance, rarePlain: rarePlain,
    vanDerCorput: vanDerCorput, halton: halton, starDiscrepancy: starDiscrepancy,
    summarise: summarise, effectiveWeightSize: effectiveWeightSize,
    optimalCoefficient: optimalCoefficient, PRIMES: PRIMES
  };
}));
