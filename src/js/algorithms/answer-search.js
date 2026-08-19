/**
 * Binary search over an answer space rather than an array: the reframe that
 * turns a class of optimisation questions into a search.
 *
 * Nothing here searches a sorted list. What is sorted is the *boolean array
 * the predicate induces*: if a ship of capacity c can deliver the packages in
 * D days, so can a ship of capacity c + 1. That monotonicity - false, false,
 * …, false, true, true, …, true - is the only precondition, and it is what
 * makes the first `true` findable in log2(range) feasibility checks instead
 * of a linear sweep.
 *
 * The discipline the section teaches is in that order:
 *
 *   1. name the answer and its range;
 *   2. write `feasible(x)` and nothing else;
 *   3. *check that it is monotone* - this is the step people skip, and a
 *      non-monotone predicate gives a confidently wrong answer rather than an
 *      error;
 *   4. binary-search for the boundary.
 *
 * `monotonicityReport` does step 3 by brute force over the whole range, which
 * is affordable exactly because the ranges in these problems are small enough
 * to search and too large to sweep in production.
 *
 * Ternary search is the sibling for a unimodal *function* rather than a
 * monotone predicate, and the floating-point version terminates on interval
 * width rather than equality - because `low < high` on doubles is a loop that
 * may never end.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AnswerSearch = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /**
   * The first x in [low, high] for which `feasible(x)` is true, assuming the
   * predicate is monotone false-then-true and that `feasible(high)` is true -
   * every problem below establishes that by construction, because the top of
   * the range is "one day", "one reader", "divide by the largest value".
   *
   * The midpoint rounds *down*, which is what makes the interval shrink: with
   * `hi = mid` the probe must be strictly below `hi`.
   */
  function firstTrue(low, high, feasible) {
    const trace = [];
    let lo = low;
    let hi = high;
    let checks = 0;

    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      const ok = feasible(mid);
      checks += 1;
      trace.push({ low: lo, high: hi, mid: mid, feasible: ok });
      if (ok) hi = mid;
      else lo = mid + 1;
    }
    return { answer: lo, checks: checks, trace: trace };
  }

  /**
   * The mirror: the last x for which `feasible(x)` is true, for predicates
   * that run true-then-false.
   *
   * Written from its own invariant rather than as `firstTrue` on a negated
   * predicate, because the negation moves the boundary by one and the result
   * is a search that is right on most inputs and one too small when the whole
   * range is feasible.
   *
   * And the midpoint here rounds *up*. With `lo = mid` and a rounded-down
   * midpoint, `hi = lo + 1` gives `mid = lo`, the interval never shrinks and
   * the loop never ends - the same trap as the `low = mid` mutation in
   * `binary-search.js`, arrived at from the opposite direction.
   */
  function lastTrue(low, high, feasible) {
    const trace = [];
    let lo = low;
    let hi = high;
    let checks = 0;

    while (lo < hi) {
      const mid = lo + Math.ceil((hi - lo) / 2);
      const ok = feasible(mid);
      checks += 1;
      trace.push({ low: lo, high: hi, mid: mid, feasible: ok });
      if (ok) lo = mid;
      else hi = mid - 1;
    }
    return { answer: lo, checks: checks, trace: trace };
  }

  /**
   * Step 3, done exhaustively. Returns the whole induced boolean array and
   * the count of places it flips - a monotone predicate flips exactly once
   * (or not at all), and anything else means the search is not licensed.
   */
  function monotonicityReport(low, high, feasible) {
    const values = [];
    for (let x = low; x <= high; x += 1) values.push(feasible(x));

    let flips = 0;
    let firstTrueAt = -1;
    values.forEach(function (value, index) {
      if (value && firstTrueAt === -1) firstTrueAt = low + index;
      if (index > 0 && value !== values[index - 1]) flips += 1;
    });

    return {
      low: low, high: high, values: values, flips: flips,
      monotone: flips <= 1 && (flips === 0 || values[values.length - 1]),
      firstTrue: firstTrueAt,
      trueCount: values.filter(Boolean).length
    };
  }

  /** Brute force, used as the oracle every problem below is checked against
   *  on small inputs. */
  function scanForFirstTrue(low, high, feasible) {
    for (let x = low; x <= high; x += 1) {
      if (feasible(x)) return x;
    }
    return high + 1;
  }

  /* ---------------------------------------------------------- problems */

  /**
   * Ship packages in `days` days: the packages must go in order, so the
   * question is how few of them fit per day at a given capacity. Capacity is
   * at least the largest package (it has to fit at all) and at most their
   * sum (one day).
   */
  function shipCapacity(weights, days) {
    const low = weights.reduce(function (a, w) { return Math.max(a, w); }, 0);
    const high = weights.reduce(function (a, w) { return a + w; }, 0);

    function feasible(capacity) {
      let used = 1;
      let load = 0;
      for (let i = 0; i < weights.length; i += 1) {
        if (load + weights[i] > capacity) { used += 1; load = 0; }
        load += weights[i];
      }
      return used <= days;
    }

    const found = firstTrue(low, high, feasible);
    return {
      answer: found.answer, checks: found.checks, trace: found.trace,
      low: low, high: high, feasible: feasible, span: high - low + 1
    };
  }

  /**
   * Allocate books to `students` readers, minimising the largest workload.
   * The same shape as the ships, and the section puts them side by side to
   * make the shape visible - the two problems differ only in the words.
   */
  function allocateBooks(pages, students) {
    const low = pages.reduce(function (a, p) { return Math.max(a, p); }, 0);
    const high = pages.reduce(function (a, p) { return a + p; }, 0);

    function feasible(limit) {
      let used = 1;
      let load = 0;
      for (let i = 0; i < pages.length; i += 1) {
        if (load + pages[i] > limit) { used += 1; load = 0; }
        load += pages[i];
      }
      return used <= students;
    }

    const found = firstTrue(low, high, feasible);
    return {
      answer: found.answer, checks: found.checks, trace: found.trace,
      low: low, high: high, feasible: feasible, span: high - low + 1
    };
  }

  /**
   * Aggressive cows: place `cows` in `stalls` so the closest pair is as far
   * apart as possible. This one runs the other way - a *large* distance is
   * the hard one - so it is a `lastTrue` search, and writing it as `firstTrue`
   * on a negated predicate is exactly the off-by-one the section warns about.
   */
  function aggressiveCows(stalls, cows) {
    const sorted = stalls.slice().sort(function (a, b) { return a - b; });
    const low = 0;
    const high = sorted[sorted.length - 1] - sorted[0];

    function feasible(distance) {
      let placed = 1;
      let last = sorted[0];
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i] - last >= distance) { placed += 1; last = sorted[i]; }
      }
      return placed >= cows;
    }

    const found = lastTrue(low, high, feasible);
    return {
      answer: found.answer, checks: found.checks, trace: found.trace,
      low: low, high: high, feasible: feasible, span: high - low + 1
    };
  }

  /**
   * The smallest divisor whose summed ceilings stay within a threshold - a
   * third instance of the same shape, kept because its predicate is the one
   * people most often write non-monotone by using `round` instead of `ceil`.
   */
  function smallestDivisor(values, threshold) {
    const low = 1;
    const high = values.reduce(function (a, v) { return Math.max(a, v); }, 1);

    function feasible(divisor) {
      let total = 0;
      for (let i = 0; i < values.length; i += 1) total += Math.ceil(values[i] / divisor);
      return total <= threshold;
    }

    const found = firstTrue(low, high, feasible);
    return {
      answer: found.answer, checks: found.checks, trace: found.trace,
      low: low, high: high, feasible: feasible, span: high - low + 1
    };
  }

  const PROBLEMS = {
    ships: {
      label: 'minimum ship capacity',
      question: 'the smallest capacity that ships the packages, in order, within D days',
      run: function (input) { return shipCapacity(input.weights, input.days); }
    },
    books: {
      label: 'allocate books',
      question: 'the smallest maximum workload when the books are split between readers',
      run: function (input) { return allocateBooks(input.pages, input.students); }
    },
    cows: {
      label: 'aggressive cows',
      question: 'the largest minimum gap when the cows are spread across the stalls',
      run: function (input) { return aggressiveCows(input.stalls, input.cows); }
    },
    divisor: {
      label: 'smallest divisor',
      question: 'the smallest divisor whose summed ceilings stay under the threshold',
      run: function (input) { return smallestDivisor(input.values, input.threshold); }
    }
  };

  /* ------------------------------------------------------------ ternary */

  /**
   * Ternary search on a unimodal function over the integers. Two probes per
   * step discard a third of the interval, so it is log base 1.5 rather than
   * log base 2 - about 1.7× the probes of a binary search, which is the price
   * of not having a monotone predicate to search.
   */
  function ternarySearchInteger(low, high, evaluate) {
    let lo = low;
    let hi = high;
    let probes = 0;

    while (hi - lo > 2) {
      const third = Math.floor((hi - lo) / 3);
      const a = lo + third;
      const b = hi - third;
      probes += 2;
      /* Maximising: if the left probe is the lower of the two, the peak
         cannot be at or below it, so that whole third goes. */
      if (evaluate(a) < evaluate(b)) lo = a + 1;
      else hi = b - 1;
    }

    let best = lo;
    for (let x = lo; x <= hi; x += 1) {
      probes += 1;
      if (evaluate(x) > evaluate(best)) best = x;
    }
    return { at: best, value: evaluate(best), probes: probes };
  }

  /**
   * The floating-point version, and the reason it takes an iteration count
   * rather than a tolerance. `while (high - low > 1e-9)` looks right and can
   * spin forever: once the interval is near the limit of double precision the
   * midpoint can equal an endpoint and the width stops shrinking. A fixed
   * 200 iterations halves the interval past every representable double, so it
   * is both exact enough and guaranteed to stop.
   */
  function ternarySearchReal(low, high, evaluate, iterations) {
    const rounds = iterations === undefined ? 200 : iterations;
    let lo = low;
    let hi = high;

    for (let i = 0; i < rounds; i += 1) {
      const a = lo + (hi - lo) / 3;
      const b = hi - (hi - lo) / 3;
      if (evaluate(a) < evaluate(b)) lo = a;
      else hi = b;
    }
    const at = (lo + hi) / 2;
    return { at: at, value: evaluate(at), iterations: rounds, width: hi - lo };
  }

  /** How many halvings a range needs, which is the figure the section quotes
   *  against the linear sweep it replaces. */
  function searchCost(span) {
    return {
      span: span,
      checks: Math.max(1, Math.ceil(Math.log2(Math.max(1, span)))),
      sweep: span,
      ratio: span / Math.max(1, Math.ceil(Math.log2(Math.max(1, span))))
    };
  }

  return {
    firstTrue: firstTrue,
    lastTrue: lastTrue,
    monotonicityReport: monotonicityReport,
    scanForFirstTrue: scanForFirstTrue,
    shipCapacity: shipCapacity,
    allocateBooks: allocateBooks,
    aggressiveCows: aggressiveCows,
    smallestDivisor: smallestDivisor,
    ternarySearchInteger: ternarySearchInteger,
    ternarySearchReal: ternarySearchReal,
    searchCost: searchCost,
    problems: PROBLEMS,
    problemKinds: Object.keys(PROBLEMS)
  };
}));
