/**
 * Markov chain Monte Carlo, and the diagnostics that stop it lying to you.
 *
 * Metropolis-Hastings samples from a distribution you can only evaluate up to
 * a constant: propose a move, accept it with probability min(1, π(new)/π(old))
 * - the constant cancels in the ratio - and the chain's stationary
 * distribution is π by detailed balance. That is the whole algorithm, and it
 * is why it is used for posteriors nobody can normalise.
 *
 * The danger is specific and this module is built around measuring it. A chain
 * that has not mixed still produces a mean, a variance and a standard error,
 * all of them small, all of them wrong - because the standard error is
 * computed as if the draws were independent and they are not. The number that
 * matters is the EFFECTIVE sample size: N divided by the integrated
 * autocorrelation time. A hundred thousand draws with a correlation time of
 * four thousand are worth twenty-five independent ones, and the honest error
 * bar is 63 times wider than the naive one.
 *
 * Two failure modes bracket the proposal width and both are reproduced here:
 *
 *   - too small: nearly every proposal is accepted, and the chain random-walks
 *     in tiny steps. High acceptance, terrible mixing. This is the one that
 *     looks healthiest on an acceptance-rate readout.
 *   - too large: nearly every proposal lands in the tail and is rejected, so
 *     the chain sits still. Low acceptance, terrible mixing.
 *
 * The optimum for a random-walk proposal on a smooth target is around 0.234
 * acceptance in high dimensions and 0.4-0.5 in one or two, which is the
 * uncomfortable fact that a *low* acceptance rate is the target.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Mcmc = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------- targets */

  /**
   * A two-component Gaussian mixture in the plane. The modes are far enough
   * apart that a small proposal cannot cross between them inside a run, which
   * is what makes "the chain converged" and "the chain found the distribution"
   * different statements.
   */
  function mixture(options) {
    const settings = options || {};
    const separation = settings.separation === undefined ? 4 : settings.separation;
    const weight = settings.weight === undefined ? 0.35 : settings.weight;
    const sd = settings.sd === undefined ? 0.7 : settings.sd;
    const modes = [{ x: -separation / 2, y: 0, w: 1 - weight },
      { x: separation / 2, y: 0, w: weight }];

    function density(x, y) {
      let out = 0;
      modes.forEach(function (mode) {
        const dx = x - mode.x;
        const dy = y - mode.y;
        out += mode.w * Math.exp(-(dx * dx + dy * dy) / (2 * sd * sd)) / (2 * Math.PI * sd * sd);
      });
      return out;
    }
    return { density: density, logDensity: function (x, y) { return Math.log(density(x, y)); },
      modes: modes, sd: sd, name: 'mixture',
      meanX: modes[0].w * modes[0].x + modes[1].w * modes[1].x,
      varianceX: mixtureVarianceX(modes, sd) };
  }

  function mixtureVarianceX(modes, sd) {
    const mean = modes[0].w * modes[0].x + modes[1].w * modes[1].x;
    let second = 0;
    modes.forEach(function (mode) { second += mode.w * (sd * sd + mode.x * mode.x); });
    return second - mean * mean;
  }

  /** A correlated bivariate normal - the target Gibbs sampling is written for. */
  function correlatedNormal(rho) {
    const r = rho === undefined ? 0.9 : rho;
    const det = 1 - r * r;

    function density(x, y) {
      const q = (x * x - 2 * r * x * y + y * y) / det;
      return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(det));
    }
    return { density: density, logDensity: function (x, y) { return Math.log(density(x, y)); },
      rho: r, name: 'correlated-normal', meanX: 0, varianceX: 1 };
  }

  /* ------------------------------------------------- Metropolis-Hastings */

  /**
   * A symmetric random-walk proposal, so the Hastings ratio is 1 and the
   * acceptance rule is the plain Metropolis one. `thin` is deliberately not
   * offered: thinning throws away information and does not improve an
   * estimate - it only makes the storage smaller.
   */
  function metropolis(target, options) {
    const settings = options || {};
    const rng = settings.rng;
    const steps = settings.steps === undefined ? 20000 : settings.steps;
    const width = settings.width === undefined ? 1 : settings.width;
    let x = settings.startX === undefined ? -2 : settings.startX;
    let y = settings.startY === undefined ? 0 : settings.startY;
    let logP = target.logDensity(x, y);
    let accepted = 0;
    const chainX = new Array(steps);
    const chainY = new Array(steps);

    for (let i = 0; i < steps; i += 1) {
      const nx = x + rng.gaussian(0, width);
      const ny = y + rng.gaussian(0, width);
      const nlogP = target.logDensity(nx, ny);

      if (Math.log(Math.max(rng.next(), Number.MIN_VALUE)) < nlogP - logP) {
        x = nx; y = ny; logP = nlogP; accepted += 1;
      }
      chainX[i] = x; chainY[i] = y;
    }
    return report(target, chainX, chainY, accepted, { width: width, steps: steps });
  }

  /**
   * Gibbs sampling for the correlated normal: each coordinate is drawn from
   * its exact conditional, so every proposal is accepted by construction.
   * That does NOT mean it mixes well - at rho = 0.99 the conditionals are
   * nearly deterministic and the chain crawls along the ridge, which is the
   * point of having it next to Metropolis.
   */
  function gibbs(target, options) {
    const settings = options || {};
    const rng = settings.rng;
    const steps = settings.steps === undefined ? 20000 : settings.steps;
    const r = target.rho;
    const sd = Math.sqrt(1 - r * r);
    let x = settings.startX === undefined ? -2 : settings.startX;
    let y = settings.startY === undefined ? 0 : settings.startY;
    const chainX = new Array(steps);
    const chainY = new Array(steps);

    for (let i = 0; i < steps; i += 1) {
      x = rng.gaussian(r * y, sd);
      y = rng.gaussian(r * x, sd);
      chainX[i] = x; chainY[i] = y;
    }
    return report(target, chainX, chainY, steps, { width: null, steps: steps, method: 'gibbs' });
  }

  function report(target, chainX, chainY, accepted, meta) {
    const stats = summarise(chainX);
    const ess = effectiveSampleSize(chainX);

    return { chainX: chainX, chainY: chainY, accepted: accepted,
      acceptanceRate: accepted / chainX.length, steps: chainX.length,
      width: meta.width, method: meta.method || 'metropolis',
      mean: stats.mean, variance: stats.variance,
      trueMean: target.meanX, trueVariance: target.varianceX,
      ess: ess.ess, autocorrelationTime: ess.tau, lagsUsed: ess.lags,
      naiveError: Math.sqrt(stats.variance / chainX.length),
      honestError: Math.sqrt(stats.variance / Math.max(ess.ess, 1)),
      meanError: Math.abs(stats.mean - target.meanX),
      modeShare: shareOfSecondMode(chainX, target) };
  }

  function summarise(values) {
    const n = values.length;
    let mean = 0;
    for (let i = 0; i < n; i += 1) mean += values[i];
    mean /= n;
    let sq = 0;
    for (let i = 0; i < n; i += 1) sq += (values[i] - mean) * (values[i] - mean);
    return { mean: mean, variance: n > 1 ? sq / (n - 1) : 0 };
  }

  /** The fraction of draws on the right-hand mode, against its true weight.
   *  A chain that never crossed reports 0 or 1 and no other diagnostic will
   *  say so - the mean alone looks merely a little off. */
  function shareOfSecondMode(chainX, target) {
    if (!target.modes) return null;
    let count = 0;
    for (let i = 0; i < chainX.length; i += 1) { if (chainX[i] > 0) count += 1; }
    return { measured: count / chainX.length, expected: target.modes[1].w };
  }

  /* --------------------------------------------------------- diagnostics */

  /** Normalised autocorrelation at each lag up to `maxLag`. */
  function autocorrelation(values, maxLag) {
    const stats = summarise(values);
    const n = values.length;
    const out = new Array(maxLag + 1);

    for (let lag = 0; lag <= maxLag; lag += 1) {
      let sum = 0;
      for (let i = 0; i + lag < n; i += 1) {
        sum += (values[i] - stats.mean) * (values[i + lag] - stats.mean);
      }
      out[lag] = stats.variance === 0 ? 0 : (sum / (n - lag)) / stats.variance;
    }
    return out;
  }

  /**
   * N / (1 + 2Σρ_k), truncated by Geyer's initial-positive-sequence rule:
   * stop as soon as a consecutive PAIR of autocorrelations sums to a negative
   * number. Truncating at the first negative lag instead is the common
   * mistake and it underestimates tau on a slowly mixing chain, which is
   * exactly the chain you were trying to detect.
   */
  function effectiveSampleSize(values) {
    const maxLag = Math.min(values.length - 2, 2000);
    const rho = autocorrelation(values, maxLag);
    let sum = 0;
    let lags = 0;

    for (let k = 1; k + 1 <= maxLag; k += 2) {
      const pair = rho[k] + rho[k + 1];
      if (pair < 0) break;
      sum += pair;
      lags = k + 1;
    }
    const tau = 1 + 2 * sum;
    return { ess: values.length / Math.max(tau, 1), tau: Math.max(tau, 1), lags: lags, rho: rho };
  }

  /**
   * Gelman-Rubin R-hat over independent chains started from dispersed points.
   * It compares the variance between chains against the variance within them,
   * and it is the only diagnostic here that can detect a chain stuck in one
   * mode - a single chain has nothing to disagree with.
   */
  function gelmanRubin(chains) {
    const m = chains.length;
    const n = chains[0].length;
    const means = chains.map(function (chain) { return summarise(chain).mean; });
    const within = chains.reduce(function (acc, chain) {
      return acc + summarise(chain).variance;
    }, 0) / m;
    const grand = means.reduce(function (a, b) { return a + b; }, 0) / m;
    let between = 0;
    means.forEach(function (mean) { between += (mean - grand) * (mean - grand); });
    between *= n / (m - 1);

    const varPlus = ((n - 1) / n) * within + between / n;
    return { rHat: within === 0 ? Infinity : Math.sqrt(varPlus / within),
      within: within, between: between, chains: m, length: n, means: means };
  }

  /** Where the chain stops depending on where it started - the burn-in the
   *  learner is told to discard, measured rather than guessed at. */
  function burnInPoint(values, target, tolerance) {
    const window = Math.max(50, Math.floor(values.length / 100));
    const limit = tolerance === undefined ? 0.5 : tolerance;

    for (let start = 0; start + window < values.length; start += window) {
      let mean = 0;
      for (let i = start; i < start + window; i += 1) mean += values[i];
      if (Math.abs(mean / window - target) < limit) return start;
    }
    return values.length;
  }

  return {
    mixture: mixture, correlatedNormal: correlatedNormal,
    metropolis: metropolis, gibbs: gibbs,
    autocorrelation: autocorrelation, effectiveSampleSize: effectiveSampleSize,
    gelmanRubin: gelmanRubin, burnInPoint: burnInPoint, summarise: summarise
  };
}));
