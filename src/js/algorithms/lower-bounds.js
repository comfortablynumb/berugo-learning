/**
 * Lower bounds: the decision tree and the adversary.
 *
 * Both are constructive here. The decision tree tracks the set of permutations
 * still consistent with the comparisons made, so the information-theoretic
 * bound ⌈log₂ n!⌉ is something you watch happen rather than something you are
 * told. The adversary answers comparisons to keep as many candidates alive as
 * possible, and it plays against the learner's own algorithm.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LowerBounds = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function permutations(n) {
    if (n <= 1) return [[0]];
    const out = [];
    permutations(n - 1).forEach(function (smaller) {
      for (let i = 0; i <= smaller.length; i += 1) {
        const copy = smaller.slice();
        copy.splice(i, 0, n - 1);
        out.push(copy);
      }
    });
    return out;
  }

  function logFactorial(n) {
    let sum = 0;
    for (let i = 2; i <= n; i += 1) sum += Math.log2(i);
    return sum;
  }

  /**
   * A decision-tree tracker for comparison sorting. `ask(i, j)` splits the
   * live permutations into those where a[i] < a[j] and those where it does
   * not; the caller chooses a branch.
   */
  function createDecisionTracker(n) {
    let live = permutations(n);
    const asked = [];

    function split(i, j) {
      const less = live.filter(function (order) { return order[i] < order[j]; });
      const greater = live.filter(function (order) { return order[i] > order[j]; });
      return { less: less, greater: greater };
    }

    function ask(i, j, answerLess) {
      const parts = split(i, j);
      live = answerLess ? parts.less : parts.greater;
      asked.push({ i: i, j: j, answerLess: answerLess, remaining: live.length });
      return live.length;
    }

    /** The adversary's answer: whichever branch keeps more permutations alive. */
    function adversarialAnswer(i, j) {
      const parts = split(i, j);
      return parts.less.length >= parts.greater.length;
    }

    return {
      ask: ask,
      split: split,
      adversarialAnswer: adversarialAnswer,
      remaining: function () { return live.length; },
      live: function () { return live.slice(0, 24); },
      history: function () { return asked.slice(); },
      bound: Math.ceil(logFactorial(n)),
      total: live.length
    };
  }

  /**
   * Adversary for finding the maximum. It never fixes values; it answers each
   * comparison so that every element except one keeps a chance of being the
   * maximum, which forces n − 1 comparisons out of any correct algorithm.
   */
  function createMaxAdversary(n) {
    const beaten = new Array(n).fill(false);
    let comparisons = 0;

    function compare(i, j) {
      comparisons += 1;
      if (beaten[i] && !beaten[j]) { return -1; }
      if (!beaten[i] && beaten[j]) { beaten[j] = true; return 1; }
      if (!beaten[i] && !beaten[j]) { beaten[j] = true; return 1; }
      return -1;
    }

    function survivors() {
      return beaten.reduce(function (count, isBeaten) { return isBeaten ? count : count + 1; }, 0);
    }

    return {
      compare: compare,
      survivors: survivors,
      comparisons: function () { return comparisons; },
      /** A claimed maximum is only sound if every other element has been beaten. */
      verdict: function (claimed) {
        const remaining = survivors();
        return {
          sound: remaining === 1 && !beaten[claimed],
          comparisons: comparisons,
          bound: n - 1,
          survivors: remaining,
          reason: remaining === 1
            ? (beaten[claimed] ? 'the claimed maximum has been beaten' : 'sound')
            : remaining + ' elements are still unbeaten, so the maximum is not determined'
        };
      }
    };
  }

  /** Simultaneous min and max in ⌈3n/2⌉ − 2 comparisons, the pairing trick. */
  function minMaxComparisons(n) {
    if (n <= 1) return 0;
    return Math.ceil(3 * n / 2) - 2;
  }

  return {
    permutations: permutations,
    logFactorial: logFactorial,
    createDecisionTracker: createDecisionTracker,
    createMaxAdversary: createMaxAdversary,
    minMaxComparisons: minMaxComparisons
  };
}));
