/**
 * Greedy algorithms, and the three that look identical to the one that works.
 *
 * Interval scheduling is the standard example because four plausible criteria
 * exist - earliest start, shortest duration, fewest conflicts, earliest finish
 * - and exactly one of them is optimal. The other three are not *usually*
 * right and occasionally wrong: each has an instance, constructible in a few
 * intervals, where it loses. Those instances are generated here rather than
 * asserted, because the entire risk of greedy is that a wrong answer is a
 * valid answer and nothing raises.
 *
 * The certificate for "earliest finish" is a staying-ahead argument: after k
 * choices, the greedy schedule's k-th interval finishes no later than the k-th
 * interval of any other feasible schedule, so it never runs out of room first.
 * `stayingAheadTrace` produces that comparison against the optimum for a given
 * instance, which is as close to a proof as a demo gets.
 *
 * The coin-system checker is the other half of the lesson. Greedy change-making
 * is optimal for some denomination sets and not for others, the test is not
 * obvious by inspection, and Pearson's result gives a bounded search: if a
 * counter-example exists, one exists below the sum of the two largest coins,
 * so a finite sweep settles it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Greedy = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* -------------------------------------------------- interval scheduling */

  function overlaps(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  function conflictCounts(intervals) {
    return intervals.map(function (interval) {
      return intervals.reduce(function (total, other) {
        return total + (other !== interval && overlaps(interval, other) ? 1 : 0);
      }, 0);
    });
  }

  const CRITERIA = {
    'earliest-finish': {
      label: 'earliest finish time',
      optimal: true,
      order: function (intervals) {
        return intervals.slice().sort(function (a, b) { return a.end - b.end || a.start - b.start; });
      }
    },
    'earliest-start': {
      label: 'earliest start time',
      optimal: false,
      order: function (intervals) {
        return intervals.slice().sort(function (a, b) { return a.start - b.start || a.end - b.end; });
      }
    },
    shortest: {
      label: 'shortest duration',
      optimal: false,
      order: function (intervals) {
        return intervals.slice().sort(function (a, b) {
          return (a.end - a.start) - (b.end - b.start) || a.start - b.start;
        });
      }
    },
    'fewest-conflicts': {
      label: 'fewest conflicts',
      optimal: false,
      order: function (intervals) {
        const counts = conflictCounts(intervals);
        return intervals.map(function (interval, index) { return { interval: interval, count: counts[index] }; })
          .sort(function (a, b) { return a.count - b.count || a.interval.start - b.interval.start; })
          .map(function (entry) { return entry.interval; });
      }
    }
  };

  /** One greedy pass: take the next interval in the criterion's order if it
   *  fits beside everything already taken. */
  function schedule(intervals, criterion) {
    const rule = CRITERIA[criterion] || CRITERIA['earliest-finish'];
    const chosen = [];
    let checks = 0;

    rule.order(intervals).forEach(function (interval) {
      const fits = chosen.every(function (taken) { checks += 1; return !overlaps(taken, interval); });
      if (fits) chosen.push(interval);
    });

    return {
      criterion: criterion, label: rule.label, chosen: chosen,
      size: chosen.length, checks: checks, claimsOptimal: rule.optimal
    };
  }

  /** The exact answer, by weighted interval scheduling with unit weights: sort
   *  by end, and take the best of "skip" and "take plus the best compatible
   *  prefix". It is the oracle every greedy claim here is checked against. */
  function optimalSchedule(intervals) {
    const sorted = intervals.slice().sort(function (a, b) { return a.end - b.end; });
    const best = new Array(sorted.length + 1).fill(0);
    const choice = new Array(sorted.length).fill(false);

    for (let i = 0; i < sorted.length; i += 1) {
      let previous = i;
      while (previous > 0 && sorted[previous - 1].end > sorted[i].start) previous -= 1;
      const take = best[previous] + 1;
      if (take > best[i]) { best[i + 1] = take; choice[i] = true; }
      else best[i + 1] = best[i];
    }
    return { size: best[sorted.length], sorted: sorted, taken: choice };
  }

  /**
   * A maximum schedule that is not greedy's: the mirror-image algorithm, taking
   * the latest-starting compatible interval and working backwards.
   *
   * The rival has to be a genuinely different optimal schedule or the
   * staying-ahead table compares greedy with itself and every row is a tie. By
   * the mirrored exchange argument this one is also optimal, and it is the
   * schedule that stays as late as possible - the worst case for the claim.
   */
  function latestStartSchedule(intervals) {
    const byStart = intervals.slice().sort(function (a, b) { return b.start - a.start || b.end - a.end; });
    const chosen = [];
    byStart.forEach(function (interval) {
      const fits = chosen.every(function (taken) { return !overlaps(taken, interval); });
      if (fits) chosen.push(interval);
    });
    return chosen.sort(function (a, b) { return a.end - b.end; });
  }

  /**
   * The staying-ahead certificate: after k choices, greedy's k-th interval
   * finishes no later than the k-th of any other feasible schedule. The table
   * is the comparison, step by step, against a rival optimum built by the
   * mirror-image rule.
   */
  function stayingAheadTrace(intervals) {
    const greedy = schedule(intervals, 'earliest-finish').chosen;
    const other = latestStartSchedule(intervals);

    return greedy.map(function (interval, k) {
      const rival = other[k];
      return {
        k: k + 1, greedyEnd: interval.end,
        otherEnd: rival ? rival.end : null,
        ahead: !rival || interval.end <= rival.end
      };
    });
  }

  /* The search climbs this ladder: the counter-examples differ in how hard
     they are to stumble on, and that difference is itself the lesson. */
  const LADDER = [[4, 10], [6, 12], [9, 14], [11, 18], [14, 22]];

  /**
   * An instance on which the named criterion loses, found by search rather
   * than remembered. Every criterion except earliest-finish has one, and the
   * number of instances the search had to try before finding it is reported,
   * because "I tested it and it worked" is exactly how these ship.
   */
  function counterExample(criterion, options) {
    const settings = options || {};
    const attempts = settings.attempts || 40000;
    const ladder = settings.count ? [[settings.count, settings.span || 10]] : LADDER;
    let state = (settings.seed || 1) >>> 0;
    let searched = 0;

    function next(bound) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % bound;
    }

    function instance(count, span) {
      const intervals = [];
      for (let i = 0; i < count; i += 1) {
        const start = next(span);
        intervals.push({ id: i, start: start, end: start + 1 + next(Math.max(1, span - start)) });
      }
      return intervals;
    }

    for (let rung = 0; rung < ladder.length; rung += 1) {
      const count = ladder[rung][0];
      const span = ladder[rung][1];
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        searched += 1;
        const intervals = instance(count, span);
        const greedy = schedule(intervals, criterion);
        const best = optimalSchedule(intervals).size;
        if (greedy.size < best) {
          return {
            intervals: intervals, greedy: greedy.size, optimal: best,
            attempts: searched, count: count, span: span
          };
        }
      }
    }
    return { intervals: null, greedy: null, optimal: null, attempts: searched, count: null, span: null };
  }

  /* --------------------------------------------------- fractional knapsack */

  /**
   * Fractional knapsack: sort by value density and fill. It is optimal, and it
   * is the standard companion to 0/1 knapsack precisely because the same
   * greedy rule is *not* optimal there - the difference is one word in the
   * problem statement.
   */
  function fractionalKnapsack(items, capacity) {
    const sorted = items.slice().sort(function (a, b) {
      return (b.value / b.weight) - (a.value / a.weight);
    });
    let remaining = capacity;
    let value = 0;
    const taken = [];

    sorted.forEach(function (item) {
      if (remaining <= 0) return;
      const fraction = Math.min(1, remaining / item.weight);
      if (fraction <= 0) return;
      value += item.value * fraction;
      remaining -= item.weight * fraction;
      taken.push({ id: item.id, fraction: fraction });
    });
    return { value: value, taken: taken, leftover: Math.max(0, remaining) };
  }

  /** The 0/1 answer, by dynamic programming over integer weights. It exists
   *  here so the fractional/integral gap is a measured number. */
  function integralKnapsack(items, capacity) {
    const best = new Array(capacity + 1).fill(0);
    items.forEach(function (item) {
      for (let w = capacity; w >= item.weight; w -= 1) {
        best[w] = Math.max(best[w], best[w - item.weight] + item.value);
      }
    });
    return { value: best[capacity] };
  }

  /* ------------------------------------------------------- coin canonicity */

  function greedyCoins(denominations, amount) {
    const coins = denominations.slice().sort(function (a, b) { return b - a; });
    let remaining = amount;
    let used = 0;
    coins.forEach(function (coin) {
      const take = Math.floor(remaining / coin);
      used += take;
      remaining -= take * coin;
    });
    return remaining === 0 ? used : Infinity;
  }

  function optimalCoins(denominations, amount) {
    const best = new Array(amount + 1).fill(Infinity);
    best[0] = 0;
    for (let value = 1; value <= amount; value += 1) {
      denominations.forEach(function (coin) {
        if (coin <= value && best[value - coin] + 1 < best[value]) best[value] = best[value - coin] + 1;
      });
    }
    return best[amount];
  }

  /**
   * Is greedy change-making optimal for this denomination set?
   *
   * Pearson's result bounds the search: a non-canonical system has a
   * counter-example below the sum of the two largest coins, so sweeping that
   * range settles the question. The answer is a witness, not a verdict, which
   * is what makes it usable in an argument.
   */
  function isCanonical(denominations) {
    const coins = denominations.slice().sort(function (a, b) { return a - b; });
    if (coins[0] !== 1) return { canonical: false, witness: null, reason: 'no unit coin, so some amounts have no representation' };

    const limit = coins[coins.length - 1] + coins[Math.max(0, coins.length - 2)];
    for (let amount = 1; amount <= limit; amount += 1) {
      const greedy = greedyCoins(coins, amount);
      const best = optimalCoins(coins, amount);
      if (greedy > best) {
        return { canonical: false, witness: { amount: amount, greedy: greedy, optimal: best }, limit: limit };
      }
    }
    return { canonical: true, witness: null, limit: limit };
  }

  return {
    criteria: CRITERIA,
    criterionKinds: Object.keys(CRITERIA),
    overlaps: overlaps,
    schedule: schedule,
    optimalSchedule: optimalSchedule,
    latestStartSchedule: latestStartSchedule,
    stayingAheadTrace: stayingAheadTrace,
    counterExample: counterExample,
    fractionalKnapsack: fractionalKnapsack,
    integralKnapsack: integralKnapsack,
    greedyCoins: greedyCoins,
    optimalCoins: optimalCoins,
    isCanonical: isCanonical
  };
}));
