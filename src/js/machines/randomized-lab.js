/**
 * RandomizedLab - the repetition harness for M19.1-19.5.
 *
 * Everything here runs an algorithm many times from seeds the caller can
 * reproduce, and reports the empirical distribution beside the theoretical
 * bound. That pairing is the milestone's whole discipline: a randomised
 * algorithm quoted without its measured failure rate is a heuristic with a
 * citation, and a bound quoted without the measurement is an assumption.
 *
 * Three conventions run through the file and are worth stating once.
 *
 *   - every result names whether a number is a BOUND, an EXPECTATION or a
 *     MEASUREMENT, because the three are routinely printed in the same column
 *     and mean completely different things.
 *   - the exact answer, where one is affordable, comes from a brute-force
 *     oracle and the disagreement count is a reported field. A randomised
 *     algorithm fails by returning a plausible answer, so nothing else
 *     notices.
 *   - repetition counts are large enough that the measured rate has a
 *     meaningful standard error, and that error is reported, so a measured
 *     0.48 against a bound of 0.5 can be told from a measured 0.48 that is
 *     three standard errors out.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.RandomizedLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Karger = scope && scope.Karger ? scope.Karger : require('../algorithms/karger.js');
  const MonteCarlo = scope && scope.MonteCarlo ? scope.MonteCarlo
    : require('../algorithms/monte-carlo.js');
  const Mcmc = scope && scope.Mcmc ? scope.Mcmc : require('../algorithms/mcmc.js');
  const Finger = scope && scope.Fingerprinting ? scope.Fingerprinting
    : require('../algorithms/fingerprinting.js');
  const NumberTheory = scope && scope.NumberTheory ? scope.NumberTheory
    : require('../algorithms/number-theory.js');

  /* ------------------------------------------------ 19.1 the two error models */

  /**
   * The liar density of a composite under Miller-Rabin: the fraction of bases
   * in [2, n-2] that fail to expose it. Rabin's theorem bounds this by 1/4 and
   * the measured value is usually far below - 561, the smallest Carmichael
   * number, fools the FERMAT test on 57% of bases and Miller-Rabin on under
   * 1%. That gap is why one of the two tests is used and the other is not.
   */
  function liarDensity(n) {
    const value = BigInt(n);
    let fermatLiars = 0;
    let millerLiars = 0;
    let bases = 0;

    for (let a = 2; a <= n - 2; a += 1) {
      bases += 1;
      const base = BigInt(a);
      if (NumberTheory.fermatTest(value, base).passes) fermatLiars += 1;
      if (NumberTheory.millerRabinRound(value, base).probablePrime) millerLiars += 1;
    }
    return { n: n, bases: bases, fermatLiars: fermatLiars, millerLiars: millerLiars,
      fermatRate: fermatLiars / bases, millerRate: millerLiars / bases, bound: 0.25 };
  }

  /**
   * k independent Miller-Rabin rounds on a composite, over many seeds. The
   * measured failure rate is compared against liarRate^k, which is the honest
   * per-instance bound, and against the universal 4^-k.
   */
  function amplify(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 561 : settings.n;
    const trials = settings.trials === undefined ? 2000 : settings.trials;
    const maxRounds = settings.maxRounds === undefined ? 6 : settings.maxRounds;
    const density = liarDensity(n);
    const rows = [];

    for (let k = 1; k <= maxRounds; k += 1) {
      let failures = 0;
      for (let t = 0; t < trials; t += 1) {
        if (foolsFor(n, k, Random.seeded(t * 97 + k))) failures += 1;
      }
      rows.push({ rounds: k, failures: failures, trials: trials,
        measured: failures / trials, perInstance: Math.pow(density.millerRate, k),
        universal: Math.pow(0.25, k),
        standardError: Math.sqrt(Math.max(failures, 1)) / trials });
    }
    return { rows: rows, density: density, n: n, trials: trials };
  }

  function foolsFor(n, rounds, rng) {
    const value = BigInt(n);

    for (let r = 0; r < rounds; r += 1) {
      const base = BigInt(2 + rng.int(n - 3));
      if (!NumberTheory.millerRabinRound(value, base).probablePrime) return false;
    }
    return true;
  }

  /**
   * The Las Vegas side: repeat until correct, and look at the RUNTIME
   * distribution instead of the error. The count is geometric with mean 1/p,
   * so the mean is unremarkable and the tail is the story - the 99th
   * percentile is ln(100)/p, roughly 4.6 times the mean, and a timeout set at
   * twice the mean fails one run in seven.
   */
  function lasVegasRuns(options) {
    const settings = options || {};
    const p = settings.successProbability === undefined ? 0.2 : settings.successProbability;
    const trials = settings.trials === undefined ? 2000 : settings.trials;
    const counts = [];

    for (let t = 0; t < trials; t += 1) {
      const rng = Random.seeded(t + 1);
      let attempts = 1;
      while (rng.next() >= p && attempts < 10000) attempts += 1;
      counts.push(attempts);
    }
    const sorted = counts.slice().sort(function (a, b) { return a - b; });
    const mean = counts.reduce(function (a, b) { return a + b; }, 0) / trials;
    const budget = Math.ceil(2 * (1 / p));
    let overBudget = 0;
    counts.forEach(function (c) { if (c > budget) overBudget += 1; });

    return { mean: mean, expectedMean: 1 / p, median: sorted[Math.floor(trials / 2)],
      p99: sorted[Math.floor(trials * 0.99)], expectedP99: Math.log(100) / -Math.log(1 - p),
      worst: sorted[trials - 1], trials: trials, successProbability: p,
      budget: budget, overBudget: overBudget, overBudgetRate: overBudget / trials,
      histogram: histogramOf(counts, 12) };
  }

  function histogramOf(values, buckets) {
    const top = Math.max.apply(null, values);
    const width = Math.max(1, Math.ceil(top / buckets));
    const out = [];

    for (let b = 0; b < buckets; b += 1) out.push({ from: b * width, to: (b + 1) * width, count: 0 });
    values.forEach(function (v) {
      const index = Math.min(buckets - 1, Math.floor(v / width));
      out[index].count += 1;
    });
    return out;
  }

  /* ---------------------------------------------------- 19.2 Karger's min cut */

  /**
   * The cycle, which is the family that makes Karger's bound TIGHT. C_n has
   * exactly n(n-1)/2 minimum cuts - remove any two edges - and each one is
   * found with probability exactly 2/(n(n-1)). That is also the proof of the
   * famous corollary: a graph has at most n(n-1)/2 minimum cuts, because the
   * events are disjoint and each has that probability.
   *
   * On the cycle "found a minimum cut" is therefore nearly certain while
   * "found THIS minimum cut" sits at the bound, and reporting only the first
   * is how the bound gets quoted as pessimistic when it is exact.
   */
  function cycleGraph(n) {
    const edges = [];
    for (let i = 0; i < n; i += 1) edges.push({ from: i, to: (i + 1) % n, weight: 1 });
    return { n: n, edges: edges, directed: false, name: 'cycle-' + n, expectedCut: 2,
      minimumCuts: n * (n - 1) / 2 };
  }

  /** Two cliques joined by `bridges` edges: the min cut is `bridges` by
   *  construction, and small enough for the brute-force oracle to confirm. */
  function clusteredGraph(options) {
    const settings = options || {};
    const size = settings.clusterSize === undefined ? 6 : settings.clusterSize;
    const bridges = settings.bridges === undefined ? 2 : settings.bridges;
    const edges = [];

    for (let side = 0; side < 2; side += 1) {
      const base = side * size;
      for (let i = 0; i < size; i += 1) {
        for (let j = i + 1; j < size; j += 1) edges.push({ from: base + i, to: base + j, weight: 1 });
      }
    }
    for (let b = 0; b < bridges; b += 1) edges.push({ from: b % size, to: size + (b % size), weight: 1 });
    return { n: 2 * size, edges: edges, directed: false, name: 'two-cliques',
      expectedCut: bridges };
  }

  /**
   * The repetition study, with the oracle's answer supplied so every
   * "success" is measured. `pickBy` runs the correct uniform-edge rule or the
   * plausible uniform-pair mistake, which is the comparison that shows the
   * analysis is about the distribution and not about the loop.
   */
  function kargerStudy(options) {
    const settings = options || {};
    const graph = settings.graph
      || (settings.family === 'cycle' ? cycleGraph(settings.clusterSize === undefined
        ? 12 : settings.clusterSize) : clusteredGraph(settings));
    const exact = Karger.bruteForceMinCut(graph);
    const trials = settings.trials === undefined ? 300 : settings.trials;
    const run = Karger.repeat(graph, { trials: trials, optimum: exact.cut,
      pickBy: settings.pickBy, targetMask: exact.mask,
      makeRng: function (t) { return Random.seeded(t * 131 + 17); } });
    const stein = Karger.kargerStein(graph, {
      makeRng: function (s) { return Random.seeded(s * 29 + 5); } });

    return { graph: graph, exact: exact, run: run, stein: stein,
      trialsForOnePercent: Karger.trialsFor(graph.n, 0.01),
      expectedRuns: 1 / Math.max(run.empiricalRate, 1 / trials) };
  }

  /** The success rate as the trial budget grows, against 1 - (1 - p)^t. */
  function kargerAmplification(study, budgets) {
    return budgets.map(function (t) {
      let successes = 0;
      for (let i = 0; i < Math.min(t, study.run.history.length); i += 1) {
        if (study.run.history[i].cut === study.exact.cut) successes += 1;
      }
      const p = study.run.predictedRate;
      return { trials: t, everFound: successes > 0, successes: successes,
        predicted: 1 - Math.pow(1 - p, t),
        measured: Math.min(1, successes > 0 ? 1 : 0) };
    });
  }

  /* ------------------------------------------------ 19.3 variance reduction */

  const TARGETS = [
    { id: 'exponential', label: '∫₀¹ eˣ dx', exact: Math.E - 1,
      f: function (u) { return Math.exp(u); },
      control: function (u) { return u; }, controlMean: 0.5 },
    { id: 'quarter-circle', label: '∫₀¹ 4√(1 − x²) dx = π', exact: Math.PI,
      f: function (u) { return 4 * Math.sqrt(1 - u * u); },
      control: function (u) { return u; }, controlMean: 0.5 },
    { id: 'oscillating', label: '∫₀¹ sin(10x)² dx', exact: 0.5 - Math.sin(20) / 40,
      f: function (u) { return Math.sin(10 * u) * Math.sin(10 * u); },
      control: function (u) { return u; }, controlMean: 0.5 }
  ];

  function targetFor(id) {
    for (let i = 0; i < TARGETS.length; i += 1) { if (TARGETS[i].id === id) return TARGETS[i]; }
    return TARGETS[0];
  }

  /** All five estimators on the same target and sample budget, with the
   *  achieved variance reduction measured against the plain estimator. */
  function varianceReduction(options) {
    const settings = options || {};
    const target = targetFor(settings.target);
    const samples = settings.samples === undefined ? 4000 : settings.samples;
    const seed = settings.seed === undefined ? 21 : settings.seed;
    const base = MonteCarlo.plain(target, { rng: Random.seeded(seed), samples: samples });
    const rows = [rowFor('plain', base, base)];

    rows.push(rowFor('antithetic', MonteCarlo.antithetic(target,
      { rng: Random.seeded(seed), samples: samples }), base));
    rows.push(rowFor('control variate', MonteCarlo.control(target,
      { rng: Random.seeded(seed), samples: samples }), base));
    rows.push(rowFor('stratified', MonteCarlo.stratified(target,
      { rng: Random.seeded(seed), samples: samples }), base));
    rows.push(rowFor('quasi (van der Corput)', MonteCarlo.quasi(target, { samples: samples }), base));
    return { rows: rows, target: target, samples: samples, seed: seed };
  }

  function rowFor(method, run, base) {
    return { method: method, run: run,
      factor: run.variance === null ? null : base.variance / Math.max(run.variance, 1e-300),
      errorFactor: base.error / Math.max(run.error, 1e-300) };
  }

  const ESTIMATORS = [
    { name: 'plain', run: MonteCarlo.plain },
    { name: 'antithetic', run: MonteCarlo.antithetic },
    { name: 'control variate', run: MonteCarlo.control },
    { name: 'stratified', run: MonteCarlo.stratified }
  ];

  /**
   * How often each estimator's 95% interval actually contains the answer,
   * measured over many seeds.
   *
   * A single run's "inside the interval?" flag is a coin toss weighted 19 to 1
   * and reporting it makes a correct estimator look broken one time in twenty -
   * worse here, because every estimator in a row shares the seed stream, so a
   * bad draw hits several at once and looks systematic. Coverage over repeats
   * is the property the interval actually claims.
   */
  function intervalCoverage(options) {
    const settings = options || {};
    const target = targetFor(settings.target);
    const samples = settings.samples === undefined ? 4000 : settings.samples;
    const repeats = settings.repeats === undefined ? 200 : settings.repeats;

    return ESTIMATORS.map(function (estimator) {
      let inside = 0;
      for (let r = 0; r < repeats; r += 1) {
        const run = estimator.run(target, { rng: Random.seeded(r * 337 + 19), samples: samples });
        if (run.error <= 1.96 * run.standardError) inside += 1;
      }
      return { method: estimator.name, inside: inside, repeats: repeats,
        coverage: inside / repeats, nominal: 0.95 };
    });
  }

  /** The 1/√N curve, measured: error against sample count, averaged over
   *  repeats so a single lucky seed does not carry the claim. */
  function errorSeries(options) {
    const settings = options || {};
    const target = targetFor(settings.target);
    const repeats = settings.repeats === undefined ? 40 : settings.repeats;
    const rows = [];

    for (let power = 4; power <= (settings.maxPower === undefined ? 16 : settings.maxPower); power += 2) {
      const samples = 1 << power;
      let sum = 0;
      for (let r = 0; r < repeats; r += 1) {
        sum += MonteCarlo.plain(target, { rng: Random.seeded(r * 7919 + power), samples: samples }).error;
      }
      const quasiRun = MonteCarlo.quasi(target, { samples: samples });
      rows.push({ samples: samples, meanError: sum / repeats,
        predicted: rows.length === 0 ? null : rows[0].meanError * Math.sqrt(rows[0].samples / samples),
        quasiError: quasiRun.error,
        discrepancy: MonteCarlo.starDiscrepancy(quasiPoints(samples)) });
    }
    return { rows: rows, target: target, repeats: repeats };
  }

  function quasiPoints(samples) {
    const out = new Array(Math.min(samples, 65536));
    for (let i = 0; i < out.length; i += 1) out[i] = MonteCarlo.vanDerCorput(i + 1, 2);
    return out;
  }

  /**
   * Monte Carlo against a product quadrature rule as the dimension rises.
   * The grid needs nodes^d points and its error falls like nodes^-2 per axis;
   * Monte Carlo needs the same N in every dimension. The crossover is the
   * senior insight of 19.3 and it is measured here rather than asserted.
   */
  function dimensionSweep(options) {
    const settings = options || {};
    const budget = settings.budget === undefined ? 4096 : settings.budget;
    const repeats = settings.repeats === undefined ? 20 : settings.repeats;
    const rows = [];

    for (let d = 1; d <= (settings.maxDimension === undefined ? 8 : settings.maxDimension); d += 1) {
      const nodes = Math.max(2, Math.floor(Math.pow(budget, 1 / d)));
      rows.push({ dimension: d, nodes: nodes, gridPoints: Math.pow(nodes, d),
        gridError: gridError(d, nodes), monteCarloError: monteCarloError(d, budget, repeats),
        budget: budget });
    }
    return { rows: rows, budget: budget, repeats: repeats, exact: 1 };
  }

  const E_MINUS_1 = Math.E - 1;

  /**
   * ∫ over [0,1]^d of ∏ eˣ' / (e − 1) is exactly 1 in every dimension, so the
   * error columns are directly comparable across the sweep.
   *
   * The integrand has to be chosen with care. A product of sines is integrated
   * EXACTLY by the midpoint rule at any node count - the rule's error cancels
   * over a whole period - so the grid column reads 1e-15 in every dimension
   * and the sweep appears to show the opposite of the truth. This one has a
   * non-zero second derivative everywhere, which is what the midpoint error
   * term is proportional to.
   */
  function productIntegrand(point) {
    let out = 1;
    for (let i = 0; i < point.length; i += 1) out *= Math.exp(point[i]) / E_MINUS_1;
    return out;
  }

  function gridError(d, nodes) {
    const point = new Array(d).fill(0);
    let sum = 0;
    let count = 0;

    function walk(axis) {
      if (axis === d) { sum += productIntegrand(point); count += 1; return; }
      for (let i = 0; i < nodes; i += 1) {
        point[axis] = (i + 0.5) / nodes;
        walk(axis + 1);
      }
    }
    walk(0);
    return Math.abs(sum / count - 1);
  }

  /** Averaged over repeats: one seed's error is a draw from a distribution
   *  whose spread is the whole point, so a single run makes the crossover
   *  column jump around and the sweep unreadable. */
  function monteCarloError(d, budget, repeats) {
    let total = 0;

    for (let r = 0; r < repeats; r += 1) {
      const rng = Random.seeded(d * 733 + r * 101 + 11);
      let sum = 0;
      for (let i = 0; i < budget; i += 1) {
        const point = new Array(d);
        for (let a = 0; a < d; a += 1) point[a] = rng.next();
        sum += productIntegrand(point);
      }
      total += Math.abs(sum / budget - 1);
    }
    return total / repeats;
  }

  /** Importance sampling against plain sampling on a tail probability. */
  function rareEvent(options) {
    const settings = options || {};
    const threshold = settings.threshold === undefined ? 4 : settings.threshold;
    const samples = settings.samples === undefined ? 20000 : settings.samples;
    const shifts = settings.shifts || [0, 2, 3, 4, 5, 7];
    const rows = shifts.map(function (shift) {
      const run = MonteCarlo.importance({ rng: Random.seeded(shift * 61 + 3), samples: samples,
        threshold: threshold, shift: shift });
      return { shift: shift, run: run, relativeError: run.error / run.exact };
    });
    const plainRun = MonteCarlo.rarePlain({ rng: Random.seeded(5), samples: samples,
      threshold: threshold });

    return { rows: rows, plain: plainRun, threshold: threshold, samples: samples,
      exact: MonteCarlo.normalTail(threshold),
      samplesForOneHit: Math.round(1 / MonteCarlo.normalTail(threshold)) };
  }

  /* ---------------------------------------------------------- 19.4 the chain */

  /** The proposal-width sweep: acceptance rate, autocorrelation time,
   *  effective sample size and the two failure modes either side. */
  function chainStudy(options) {
    const settings = options || {};
    const target = settings.target === 'correlated'
      ? Mcmc.correlatedNormal(settings.rho) : Mcmc.mixture(settings);
    const steps = settings.steps === undefined ? 20000 : settings.steps;
    const widths = settings.widths || [0.1, 0.3, 1, 2.4, 5, 12];
    const rows = widths.map(function (width) {
      return Mcmc.metropolis(target, { rng: Random.seeded(settings.seed === undefined
        ? 42 : settings.seed), steps: steps, width: width, startX: -2, startY: 0 });
    });
    return { rows: rows, target: target, steps: steps, widths: widths };
  }

  /** Four dispersed chains, so R-hat has something to disagree about. */
  function convergenceStudy(options) {
    const settings = options || {};
    const target = settings.target === 'correlated'
      ? Mcmc.correlatedNormal(settings.rho) : Mcmc.mixture(settings);
    const width = settings.width === undefined ? 0.3 : settings.width;
    const steps = settings.steps === undefined ? 8000 : settings.steps;
    const starts = [-3, -1, 1, 3];
    const chains = starts.map(function (start, index) {
      return Mcmc.metropolis(target, { rng: Random.seeded(index * 313 + 7), steps: steps,
        width: width, startX: start, startY: 0 });
    });
    return { chains: chains, target: target, width: width, steps: steps, starts: starts,
      rHat: Mcmc.gelmanRubin(chains.map(function (c) { return c.chainX; })) };
  }

  /* --------------------------------------------------- 19.5 fingerprinting */

  /** Freivalds over many seeds: how many rounds a corruption survives, and
   *  what verification costs against the multiplication itself. */
  function freivaldsStudy(options) {
    const settings = options || {};
    const n = settings.size === undefined ? 60 : settings.size;
    const trials = settings.trials === undefined ? 400 : settings.trials;
    const maxRounds = settings.maxRounds === undefined ? 8 : settings.maxRounds;
    const setup = Random.seeded(settings.seed === undefined ? 4 : settings.seed);
    const a = Finger.randomMatrix(n, setup, 10);
    const b = Finger.randomMatrix(n, setup, 10);
    const product = Finger.multiply(a, b);
    const wrong = Finger.corrupt(product.matrix, { rng: setup, cells: settings.cells, delta: 1 });
    const rows = [];

    for (let k = 1; k <= maxRounds; k += 1) {
      let missed = 0;
      let falseAlarms = 0;
      for (let t = 0; t < trials; t += 1) {
        const rng = Random.seeded(t * 53 + k);
        if (!Finger.freivalds({ a: a, b: b, c: wrong.matrix }, { rng: rng, rounds: k }).rejected) {
          missed += 1;
        }
        if (Finger.freivalds({ a: a, b: b, c: product.matrix },
          { rng: Random.seeded(t * 53 + k + 1), rounds: k }).rejected) falseAlarms += 1;
      }
      rows.push({ rounds: k, missed: missed, trials: trials, measured: missed / trials,
        bound: Math.pow(0.5, k), falseAlarms: falseAlarms });
    }
    return { rows: rows, size: n, multiplyCost: product.operations, cells: wrong.changed.length,
      verifyCost: Finger.freivalds({ a: a, b: b, c: wrong.matrix },
        { rng: Random.seeded(1), rounds: maxRounds }).operations };
  }

  /** Schwartz-Zippel across field sizes: measured false-accept rate against
   *  the d/|F| bound, on claims that are true and claims that are not. */
  function identityStudy(options) {
    const settings = options || {};
    const trials = settings.trials === undefined ? 2000 : settings.trials;
    const claims = Finger.polynomialClaims();
    const rows = [];

    Finger.FIELDS.forEach(function (field) {
      claims.forEach(function (claim) {
        let accepted = 0;
        for (let t = 0; t < trials; t += 1) {
          const run = Finger.identityTest(claim, { rng: Random.seeded(t * 7 + field),
            field: field, trials: 1 });
          if (run.equal) accepted += 1;
        }
        rows.push({ field: field, claim: claim.name, holds: claim.holds, degree: claim.degree,
          accepted: accepted, trials: trials, rate: accepted / trials,
          bound: claim.holds ? 1 : Math.min(1, claim.degree / field) });
      });
    });
    return { rows: rows, trials: trials };
  }

  /**
   * The fingerprint study runs TWO pairs at every field size, because the
   * ordinary one does not exercise the bound at all. Two sequences differing
   * in one position have a monomial difference whose only root is base zero,
   * which is never drawn - so the measured collision rate is zero at every
   * field size while the bound reads n/p, and quoting that as agreement would
   * be the false claim this milestone is arranged against. The adversarial
   * pair is built with d chosen roots, so it collides on exactly those bases
   * and the measured rate lands on d/p.
   */
  function fingerprintStudy(options) {
    const settings = options || {};
    const trials = settings.trials === undefined ? 4000 : settings.trials;
    const roots = settings.roots === undefined ? 8 : settings.roots;
    const rows = Finger.FIELDS.map(function (field) {
      const ordinary = Finger.randomPair({ rng: Random.seeded(settings.seed === undefined
        ? 12 : settings.seed), length: settings.length === undefined ? 5000 : settings.length,
      field: field });
      const built = Finger.adversarialPair({ rng: Random.seeded(field + 3), field: field,
        roots: roots });
      return { field: field,
        ordinary: Finger.compareByFingerprint(ordinary, { rng: Random.seeded(field),
          trials: trials }),
        adversarial: Finger.compareByFingerprint(built, { rng: Random.seeded(field),
          trials: trials }),
        differsAt: ordinary.differsAt, plantedRoots: built.roots.length };
    });
    const text = randomText(settings.length === undefined ? 5000 : settings.length,
      Random.seeded(settings.seed === undefined ? 12 : settings.seed));
    const chunks = chunksOf(text, 64);
    return { rows: rows, length: text.length, chunks: chunks, roots: roots,
      differsAt: rows[0].differsAt, tree: Finger.merkleTree(chunks) };
  }

  function randomText(length, rng) {
    let out = '';
    for (let i = 0; i < length; i += 1) out += String.fromCharCode(97 + rng.int(26));
    return out;
  }

  function chunksOf(text, size) {
    const out = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }

  return {
    liarDensity: liarDensity, amplify: amplify, lasVegasRuns: lasVegasRuns,
    clusteredGraph: clusteredGraph, cycleGraph: cycleGraph, kargerStudy: kargerStudy,
    kargerAmplification: kargerAmplification,
    varianceReduction: varianceReduction, errorSeries: errorSeries,
    intervalCoverage: intervalCoverage,
    dimensionSweep: dimensionSweep, rareEvent: rareEvent, productIntegrand: productIntegrand,
    chainStudy: chainStudy, convergenceStudy: convergenceStudy,
    freivaldsStudy: freivaldsStudy, identityStudy: identityStudy,
    fingerprintStudy: fingerprintStudy, TARGETS: TARGETS, targetFor: targetFor
  };
}));
