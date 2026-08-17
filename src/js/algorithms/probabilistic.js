/**
 * Average-case analysis: indicator variables, and the simulation that checks
 * them.
 *
 * The pattern this module exists to teach: write the expectation as a sum of
 * indicator variables, compute it in closed form, then measure the same thing
 * by simulation and see the two agree. Where they disagree, the model was
 * wrong - which is the useful outcome.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Probabilistic = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /**
   * Expected comparisons in randomised quicksort, exactly.
   * E[X] = Σ_{i<j} 2/(j − i + 1), each term the probability that the i-th and
   * j-th smallest elements are ever compared.
   */
  function quicksortExpectation(n) {
    let total = 0;
    for (let gap = 1; gap < n; gap += 1) {
      total += (n - gap) * (2 / (gap + 1));
    }
    return total;
  }

  /** The familiar asymptotic form, for comparison against the exact sum. */
  function quicksortAsymptotic(n) {
    return 2 * n * Math.log(n);
  }

  /**
   * Counts comparisons of randomised quicksort on a shuffled input.
   *
   * The pivot is not compared with itself: the indicator-variable analysis
   * counts pairs, and a pivot pairs with the other n-1 elements only. Counting
   * the self-comparison inflates the measurement by one per recursive call -
   * about 13% at n = 60 - which looks exactly like the theory being wrong.
   */
  function quicksortComparisons(n, rng) {
    const values = [];
    for (let i = 0; i < n; i += 1) values.push(i);
    const input = rng.shuffle(values);
    let comparisons = 0;

    function sort(array) {
      if (array.length <= 1) return array;
      const pivot = array[rng.int(array.length)];
      const less = [];
      const equal = [];
      const greater = [];

      array.forEach(function (value) {
        if (value === pivot) { equal.push(value); return; }
        comparisons += 1;
        if (value < pivot) less.push(value); else greater.push(value);
      });

      return sort(less).concat(equal, sort(greater));
    }

    sort(input);
    return comparisons;
  }

  /** Runs a trial repeatedly and summarises the distribution. */
  function sample(options) {
    const trials = options.trials;
    const trial = options.trial;
    const values = [];

    for (let i = 0; i < trials; i += 1) values.push(trial(i));

    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mean = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    const variance = values.reduce(function (sum, value) {
      return sum + Math.pow(value - mean, 2);
    }, 0) / values.length;

    return {
      values: values,
      mean: mean,
      sd: Math.sqrt(variance),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      percentile: function (p) { return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; }
    };
  }

  /** Buckets a sample for a histogram. */
  function histogram(values, buckets) {
    const count = buckets || 24;
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const width = (max - min) / count || 1;
    const bins = new Array(count).fill(0);

    values.forEach(function (value) {
      const index = Math.min(count - 1, Math.floor((value - min) / width));
      bins[index] += 1;
    });

    return bins.map(function (n, index) {
      return { x: min + width * (index + 0.5), y: n, from: min + width * index, to: min + width * (index + 1) };
    });
  }

  /** Probability that some pair collides among k draws from n slots. */
  function birthdayCollision(k, n) {
    let probabilityNoCollision = 1;
    for (let i = 0; i < k; i += 1) {
      probabilityNoCollision *= (n - i) / n;
      if (probabilityNoCollision <= 0) return 1;
    }
    return 1 - probabilityNoCollision;
  }

  /** Markov and Chebyshev bounds, for comparison against the observed tail. */
  function tailBounds(options) {
    const mean = options.mean;
    const sd = options.sd;
    const threshold = options.threshold;
    return {
      markov: threshold > 0 ? Math.min(1, mean / threshold) : 1,
      chebyshev: threshold > mean ? Math.min(1, Math.pow(sd / (threshold - mean), 2)) : 1
    };
  }

  return {
    quicksortExpectation: quicksortExpectation,
    quicksortAsymptotic: quicksortAsymptotic,
    quicksortComparisons: quicksortComparisons,
    sample: sample,
    histogram: histogram,
    birthdayCollision: birthdayCollision,
    tailBounds: tailBounds
  };
}));
