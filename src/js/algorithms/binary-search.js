/**
 * Binary search written from its invariant, the classic mutations that break
 * it, and the variants that answer the questions a plain search cannot.
 *
 * Bentley's point in *Programming Pearls* - that most published binary
 * searches were wrong - is not an insult to the people who wrote them. It is
 * a statement about what happens when a loop is written from a picture
 * instead of from an invariant. So everything here is written from one:
 *
 *     the half-open interval [low, high) always contains the answer
 *
 * With that written down, every line follows. `low` starts at 0 and `high` at
 * `length` (not `length - 1`, which is where the picture-drawing goes wrong).
 * The loop runs while `low < high`, because an empty interval means the answer
 * is `low`. `mid` is always strictly less than `high`, so the interval always
 * shrinks and the loop always ends. There is no `+ 1`/`- 1` to get wrong on
 * one side, because the two sides are not symmetric: `high = mid` discards
 * `[mid, high)` and `low = mid + 1` discards `[low, mid]`.
 *
 * `MUTATIONS` holds seven versions with a single character changed each, all
 * of them real implementations rather than descriptions - the demo runs them
 * and reports the exact inputs that separate each from the correct one.
 *
 * The overflow in `(low + high) / 2` is the one bug JavaScript hides:
 * doubles are exact to 2^53, so a 32-bit sum cannot overflow into a negative
 * index the way it does in C or Java. `midpointComparison` shows what the
 * same arithmetic does once it is forced through 32 bits, because the habit
 * is worth keeping even in a language that does not punish it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BinarySearch = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function midpoint(low, high) {
    return low + ((high - low) >>> 1);
  }

  /** First index whose element is >= target; `length` if there is none. */
  function lowerBound(array, target, ops, options) {
    const settings = options || {};
    let low = settings.from === undefined ? 0 : settings.from;
    let high = settings.to === undefined ? array.length : settings.to;

    while (low < high) {
      const mid = midpoint(low, high);
      if (ops.cmp(array[mid], target) < 0) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  /** First index whose element is > target. `upperBound - lowerBound` is the
   *  number of occurrences, which is the reason both exist. */
  function upperBound(array, target, ops, options) {
    const settings = options || {};
    let low = settings.from === undefined ? 0 : settings.from;
    let high = settings.to === undefined ? array.length : settings.to;

    while (low < high) {
      const mid = midpoint(low, high);
      if (ops.cmp(target, array[mid]) < 0) high = mid;
      else low = mid + 1;
    }
    return low;
  }

  /** Index of some occurrence of target, or -1. Written on top of the bounds
   *  rather than as a third loop, because a third loop is a third chance to
   *  get the interval wrong. */
  function search(array, target, ops) {
    const at = lowerBound(array, target, ops);
    if (at < array.length && ops.cmp(array[at], target) === 0) return at;
    return -1;
  }

  function equalRange(array, target, ops) {
    const from = lowerBound(array, target, ops);
    const to = upperBound(array, target, ops, { from: from });
    return { from: from, to: to, count: to - from };
  }

  /**
   * The invariant, recorded per iteration, so the demo can show it holding
   * rather than assert that it does. Each step reports the interval, the
   * probe and whether the answer is still inside - a step where `holds` is
   * false is a bug, and that is the whole display.
   */
  function traceLowerBound(array, target, ops) {
    const steps = [];
    let low = 0;
    let high = array.length;
    const answer = referenceLowerBound(array, target);

    while (low < high) {
      const mid = midpoint(low, high);
      const less = ops.cmp(array[mid], target) < 0;
      steps.push({
        low: low, high: high, mid: mid, value: array[mid],
        went: less ? 'right' : 'left', width: high - low,
        holds: answer >= low && answer <= high
      });
      if (less) low = mid + 1;
      else high = mid;
    }
    return { result: low, expected: answer, steps: steps, correct: low === answer };
  }

  /** A linear scan, used as the oracle everything else is checked against. */
  function referenceLowerBound(array, target) {
    for (let i = 0; i < array.length; i += 1) {
      if (!(array[i] < target)) return i;
    }
    return array.length;
  }

  /* --------------------------------------------------------- mutations */

  /**
   * Seven wrong binary searches, each one character from the right one.
   *
   * They are implemented rather than described because the interesting
   * question is not "is this wrong" but "which input notices". Several of
   * these are correct on every array a casual test would use, and one of them
   * is correct on every input except an empty array.
   */
  const MUTATIONS = {
    correct: {
      label: 'the invariant version',
      note: 'half-open [low, high), high starts at length',
      run: function (array, target) {
        let low = 0;
        let high = array.length;
        while (low < high) {
          const mid = midpoint(low, high);
          if (array[mid] < target) low = mid + 1;
          else high = mid;
        }
        return low;
      }
    },
    'closed-interval': {
      label: 'high = length - 1',
      note: 'the picture-drawn version: the last element is never inspected',
      run: function (array, target) {
        let low = 0;
        let high = array.length - 1;
        while (low < high) {
          const mid = midpoint(low, high);
          if (array[mid] < target) low = mid + 1;
          else high = mid;
        }
        return low;
      }
    },
    'lte-probe': {
      label: '<= instead of <',
      note: 'returns an upper bound, so it lands past a block of equals',
      run: function (array, target) {
        let low = 0;
        let high = array.length;
        while (low < high) {
          const mid = midpoint(low, high);
          if (array[mid] <= target) low = mid + 1;
          else high = mid;
        }
        return low;
      }
    },
    'high-mid-minus-one': {
      label: 'high = mid - 1',
      note: 'discards the answer itself when the probe lands on it',
      run: function (array, target) {
        let low = 0;
        let high = array.length;
        while (low < high) {
          const mid = midpoint(low, high);
          if (array[mid] < target) low = mid + 1;
          else high = mid - 1;
        }
        return low;
      }
    },
    'low-mid': {
      label: 'low = mid',
      note: 'the interval stops shrinking when high - low is 1: an infinite loop',
      loops: true,
      run: function (array, target) {
        let low = 0;
        let high = array.length;
        let guard = 0;
        while (low < high) {
          const mid = midpoint(low, high);
          if (array[mid] < target) low = mid;
          else high = mid;
          guard += 1;
          if (guard > 4 * array.length + 8) return { spun: true, at: low };
        }
        return low;
      }
    },
    'inclusive-loop': {
      label: 'while (low <= high)',
      note: 'reads array[length] on a target above everything',
      run: function (array, target) {
        let low = 0;
        let high = array.length;
        let guard = 0;
        while (low <= high) {
          const mid = midpoint(low, high);
          if (array[mid] < target) low = mid + 1;
          else high = mid - 1;
          guard += 1;
          if (guard > 4 * array.length + 8) return { spun: true, at: low };
        }
        return low;
      }
    },
    'rounded-mid': {
      label: 'mid rounds up',
      note: 'mid can equal high, so a one-element interval never shrinks',
      loops: true,
      run: function (array, target) {
        let low = 0;
        let high = array.length;
        let guard = 0;
        while (low < high) {
          const mid = low + Math.ceil((high - low) / 2);
          if (array[mid] < target) low = mid + 1;
          else high = mid;
          guard += 1;
          if (guard > 4 * array.length + 8) return { spun: true, at: low };
        }
        return low;
      }
    }
  };

  /** The inputs that separate the mutations from the correct version. Every
   *  one of them is a case a hand-written test usually omits. */
  const PROBE_CASES = [
    { label: 'empty array', array: [], targets: [1] },
    { label: 'single element', array: [5], targets: [4, 5, 6] },
    { label: 'all equal', array: [7, 7, 7, 7], targets: [6, 7, 8] },
    { label: 'target below everything', array: [2, 4, 6, 8], targets: [1] },
    { label: 'target above everything', array: [2, 4, 6, 8], targets: [9] },
    { label: 'target is the last element', array: [2, 4, 6, 8], targets: [8] },
    { label: 'target is the first element', array: [2, 4, 6, 8], targets: [2] },
    { label: 'duplicate block', array: [1, 3, 3, 3, 5], targets: [3] },
    { label: 'target absent, interior', array: [1, 3, 5, 7], targets: [4] }
  ];

  /**
   * Run one mutation on one input, watching for all three ways it can be
   * wrong: a wrong answer, a loop that never ends, and a read past the end
   * of the array.
   *
   * The third one has to be watched for explicitly. JavaScript returns
   * `undefined` for an out-of-bounds index and every comparison against it is
   * false, so a search that reads `array[length]` can still return the right
   * answer - while the identical code in C reads whatever is next in memory
   * and in Java throws. A test that only checks the return value calls that
   * mutation correct, which is exactly how it survives review.
   */
  function runMutation(mutation, values, target) {
    const reads = { past: 0, maxIndex: -1 };
    const watched = new Proxy(values, {
      get: function (holder, property) {
        const index = typeof property === 'string' ? Number(property) : NaN;
        if (Number.isInteger(index)) {
          if (index > reads.maxIndex) reads.maxIndex = index;
          if (index >= values.length || index < 0) reads.past += 1;
        }
        return holder[property];
      }
    });

    let outcome;
    try { outcome = mutation.run(watched, target); }
    catch (error) { outcome = { threw: error.message }; }

    if (outcome && outcome.spun) return { verdict: 'did not terminate', reads: reads };
    if (outcome && outcome.threw) return { verdict: 'threw', reads: reads };
    return { verdict: outcome, reads: reads };
  }

  /* A mutation that spins or throws is not a "wrong answer": the verdict
     already says which it was, and calling a hang a wrong answer hides the
     one failure mode that is loud enough to be safe. */
  function reasonFor(outcome, wrongAnswer) {
    if (typeof outcome.verdict === 'string') return outcome.verdict;
    return wrongAnswer ? 'wrong answer' : 'read past the end';
  }

  /**
   * Run every mutation against every probe case and report which cases catch
   * it. A mutation that no case catches would mean the case list is too
   * small - which is the failure mode of hand-written binary-search tests and
   * is why the table is displayed rather than summarised.
   */
  function mutationReport() {
    return Object.keys(MUTATIONS).map(function (name) {
      const mutation = MUTATIONS[name];
      const failures = [];
      let checks = 0;

      PROBE_CASES.forEach(function (probe) {
        probe.targets.forEach(function (target) {
          checks += 1;
          const expected = referenceLowerBound(probe.array, target);
          const outcome = runMutation(mutation, probe.array.slice(), target);
          const wrongAnswer = outcome.verdict !== expected;
          if (!wrongAnswer && !outcome.reads.past) return;
          failures.push({
            probe: probe.label, target: target, expected: expected,
            actual: wrongAnswer ? outcome.verdict : expected,
            reason: reasonFor(outcome, wrongAnswer),
            outOfBounds: outcome.reads.past
          });
        });
      });

      return {
        name: name, label: mutation.label, note: mutation.note,
        checks: checks, caught: failures.length, failures: failures
      };
    });
  }

  /* ---------------------------------------------------------- variants */

  /**
   * Search in a sorted array that has been rotated. One half of every split
   * is still sorted, and which half it is can be decided in one comparison -
   * so the log n survives the rotation.
   */
  function rotatedSearch(array, target, ops) {
    let low = 0;
    let high = array.length - 1;

    while (low <= high) {
      const mid = midpoint(low, high + 1);
      if (ops.cmp(array[mid], target) === 0) return mid;

      if (ops.cmp(array[low], array[mid]) <= 0) {
        if (ops.cmp(array[low], target) <= 0 && ops.cmp(target, array[mid]) < 0) high = mid - 1;
        else low = mid + 1;
      } else if (ops.cmp(array[mid], target) < 0 && ops.cmp(target, array[high]) <= 0) low = mid + 1;
      else high = mid - 1;
    }
    return -1;
  }

  /**
   * Interpolation search: guess where the target is rather than splitting in
   * half. O(log log n) on uniform data and O(n) on the input that breaks the
   * assumption, which is why it is a specialist tool - `probes` is reported
   * so the difference is a measurement.
   */
  function interpolationSearch(array, target, ops) {
    let low = 0;
    let high = array.length - 1;
    let probes = 0;

    while (low <= high && target >= array[low] && target <= array[high]) {
      probes += 1;
      if (array[high] === array[low]) {
        return { index: array[low] === target ? low : -1, probes: probes };
      }
      const span = array[high] - array[low];
      const guess = low + Math.floor(((target - array[low]) / span) * (high - low));
      const at = Math.min(high, Math.max(low, guess));
      const order = ops.cmp(array[at], target);
      if (order === 0) return { index: at, probes: probes };
      if (order < 0) low = at + 1;
      else high = at - 1;
    }
    return { index: -1, probes: probes };
  }

  /**
   * Exponential search: double a bound until it passes the target, then
   * binary-search inside it. O(log i) for a target at position i, which beats
   * O(log n) when the answer is near the front - and is the only one of these
   * that works on an unbounded or streamed sequence.
   */
  function exponentialSearch(array, target, ops) {
    if (!array.length) return { index: -1, bound: 0 };
    let bound = 1;
    while (bound < array.length && ops.cmp(array[bound], target) < 0) bound *= 2;

    const from = bound >>> 1;
    const to = Math.min(bound + 1, array.length);
    const at = lowerBound(array, target, ops, { from: from, to: to });
    return {
      index: at < array.length && ops.cmp(array[at], target) === 0 ? at : -1,
      bound: bound, from: from, to: to
    };
  }

  /**
   * Branchless lower bound: the same halving, but the step is chosen by
   * arithmetic instead of a taken branch, so the CPU never mispredicts. The
   * comparison count is identical - which is the point. Whatever it wins is
   * invisible to every counter in this milestone, and only a timing harness
   * can see it.
   */
  function branchlessLowerBound(array, target, ops) {
    let base = 0;
    let length = array.length;

    while (length > 1) {
      const half = length >>> 1;
      base += ops.cmp(array[base + half - 1], target) < 0 ? half : 0;
      length -= half;
    }
    return base + (length === 1 && ops.cmp(array[base], target) < 0 ? 1 : 0);
  }

  /**
   * What `(low + high) / 2` does once it is forced through 32 bits, which is
   * the environment the bug was found in. JavaScript numbers are exact to
   * 2^53, so the naive form is safe here - `bits32` is what the same
   * expression yields in a language where it is not.
   */
  function midpointComparison(low, high) {
    return {
      low: low, high: high,
      naive: Math.floor((low + high) / 2),
      safe: midpoint(low, high),
      bits32: ((low + high) | 0) >> 1,
      overflows: ((low + high) | 0) !== low + high
    };
  }

  return {
    midpoint: midpoint,
    lowerBound: lowerBound,
    upperBound: upperBound,
    search: search,
    equalRange: equalRange,
    traceLowerBound: traceLowerBound,
    referenceLowerBound: referenceLowerBound,
    rotatedSearch: rotatedSearch,
    interpolationSearch: interpolationSearch,
    exponentialSearch: exponentialSearch,
    branchlessLowerBound: branchlessLowerBound,
    midpointComparison: midpointComparison,
    mutationReport: mutationReport,
    mutations: MUTATIONS,
    probeCases: PROBE_CASES
  };
}));
