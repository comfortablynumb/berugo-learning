/**
 * Digit DP, DP over a DAG, and automaton DP - three problems that are the
 * same problem once the state is named properly.
 *
 * Digit DP counts the numbers in [0, N] with some property by walking N's
 * digits left to right, carrying one bit of state: **tight**, meaning every
 * digit chosen so far equals N's. While tight, the next digit is capped at
 * N's; the moment a smaller digit is chosen the number is already below N and
 * every later digit is free. That flag is the only subtle part of the
 * technique and it is the only part that goes wrong: drop it and the count
 * runs past the bound, freeze it and the count stops at N's own prefix.
 *
 * The pay-off is that the *number of states does not depend on N's value*, only
 * on its length. `countUpTo` at 10^18 costs the same as at 10^6, which is the
 * whole reason the technique exists, and `report.states` says so.
 *
 * Automaton DP is the same walk with the state supplied by a DFA rather than
 * by a hand-written flag, which is why it is in this file: "no two equal
 * adjacent digits" is a two-state automaton, and once that is seen the digit
 * DP is just the product of that automaton with the tight flag. M24 builds the
 * automata; this section builds the counting.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpDigit = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, hits: 0, misses: 0, digits: 0 };
  }

  function digitsOf(value) {
    return String(value).split('').map(Number);
  }

  /* --------------------------------------------------------------- digit DP */

  /**
   * Count the values in [0, limit] a property accepts, where the property is a
   * DFA over digits: `start`, `step(state, digit)` returning the next state or
   * null to reject, and `accepting(state)`.
   *
   * `leadingZeros` matters more than it looks: 0 is a one-digit number, but
   * "007" and "7" must not be counted twice, so the walk carries a `started`
   * flag and only feeds the automaton once a non-zero digit has appeared.
   */
  function countUpTo(limit, automaton, options) {
    const report = (options || {}).report || emptyReport();

    if (limit < 0) return { count: 0, report: report };
    const digits = digitsOf(limit);
    const memo = new Map();

    report.digits = digits.length;

    function go(at, state, tight, started) {
      /* Nothing started means every digit chosen was a leading zero, so the
         value is zero - a legitimate one-digit number, and the one the naive
         `started && accepting` test silently drops. It is counted exactly
         once, on the all-zeros path, by asking the automaton about the single
         digit 0 rather than about the start state. */
      if (at === digits.length && !started) return acceptsZero(automaton) ? 1 : 0;

      if (at === digits.length) return automaton.accepting(state) ? 1 : 0;
      const key = at + '|' + state + '|' + (tight ? 1 : 0) + '|' + (started ? 1 : 0);

      if (!tight && memo.has(key)) { report.hits += 1; return memo.get(key); }
      report.states += 1;
      report.misses += 1;
      const total = stepDigits({ digits: digits, automaton: automaton, report: report, go: go },
        at, state, { tight: tight, started: started });

      if (!tight) memo.set(key, total);
      return total;
    }
    return { count: go(0, automaton.start, true, false), report: report };
  }

  /** Does the automaton accept the number zero, written as the single digit
   *  0? Asked once per count rather than assumed either way. */
  function acceptsZero(automaton) {
    const state = automaton.step(automaton.start, 0, false);
    return state !== null && automaton.accepting(state);
  }

  /** The digit loop of `countUpTo`, split out so both stay readable. */
  function stepDigits(context, at, state, flags) {
    const cap = flags.tight ? context.digits[at] : 9;
    let total = 0;

    for (let digit = 0; digit <= cap; digit += 1) {
      context.report.transitions += 1;
      const stillTight = flags.tight && digit === cap;
      const started = flags.started || digit !== 0;

      if (!started) {
        total += context.go(at + 1, context.automaton.start, stillTight, false);
        continue;
      }
      const next = context.automaton.step(state, digit, flags.started);

      if (next === null) continue;
      total += context.go(at + 1, next, stillTight, true);
    }
    return total;
  }

  /** Inclusive range, by the standard subtraction. `low - 1` is where an
   *  off-by-one lives, so it is written once here rather than at each site. */
  function countInRange(low, high, automaton, options) {
    const report = (options || {}).report || emptyReport();
    const upper = countUpTo(high, automaton, { report: report }).count;
    const lower = countUpTo(low - 1, automaton, { report: report }).count;
    return { count: upper - lower, upper: upper, lower: lower, report: report };
  }

  /** The reference: count by trying every number. Only ever called on the
   *  small ranges the tests and demos use, which is the point - the whole
   *  technique exists because this does not scale. */
  function countBruteForce(low, high, automaton) {
    let count = 0;

    for (let value = Math.max(0, low); value <= high; value += 1) {
      let state = automaton.start;
      let ok = true;
      let started = false;

      digitsOf(value).forEach(function (digit) {
        if (!ok) return;

        if (!started && digit === 0 && String(value) !== '0') return;
        const next = automaton.step(state, digit, started);
        started = true;

        if (next === null) { ok = false; return; }
        state = next;
      });

      if (ok && automaton.accepting(state)) count += 1;
    }
    return count;
  }

  /* ------------------------------------------------------- the automata */

  /** No two equal adjacent digits. The state is the previous digit, and -1
   *  means "nothing yet". */
  function noEqualAdjacent() {
    return {
      name: 'no two equal adjacent digits',
      start: -1,
      step: function (state, digit) { return state === digit ? null : digit; },
      accepting: function () { return true; }
    };
  }

  /** Digits strictly increasing left to right. */
  function strictlyIncreasing() {
    return {
      name: 'strictly increasing digits',
      start: -1,
      step: function (state, digit) { return digit > state ? digit : null; },
      accepting: function () { return true; }
    };
  }

  /** Digit sum divisible by `modulus` - the case where the state is an
   *  accumulator rather than a memory of the last symbol. */
  function digitSumDivisibleBy(modulus) {
    return {
      name: 'digit sum divisible by ' + modulus,
      start: 0,
      step: function (state, digit) { return (state + digit) % modulus; },
      accepting: function (state) { return state === 0; }
    };
  }

  /** Contains the substring "13" - a two-state automaton, and the case that
   *  shows an accepting state is not the same thing as a legal one. */
  function containsThirteen() {
    return {
      name: 'contains the digits 1 then 3',
      start: 0,
      step: function (state, digit) {
        if (state === 2) return 2;

        if (state === 1 && digit === 3) return 2;
        return digit === 1 ? 1 : 0;
      },
      accepting: function (state) { return state === 2; }
    };
  }

  /* --------------------------------------------------------- DP over a DAG */

  /** Kahn's order, iterative. Returns null when the graph has a cycle, which
   *  is the precondition every function below depends on. */
  function topologicalOrder(adjacency) {
    const n = adjacency.length;
    const indegree = new Array(n).fill(0);

    adjacency.forEach(function (edges) {
      edges.forEach(function (edge) { indegree[edge.to] += 1; });
    });
    const queue = [];

    for (let node = 0; node < n; node += 1) {
      if (indegree[node] === 0) queue.push(node);
    }
    const order = [];

    while (queue.length) {
      const node = queue.shift();
      order.push(node);
      adjacency[node].forEach(function (edge) {
        indegree[edge.to] -= 1;

        if (indegree[edge.to] === 0) queue.push(edge.to);
      });
    }
    return order.length === n ? order : null;
  }

  /**
   * The longest path in a DAG, which is NP-hard on a general graph and linear
   * here - and the reason is entirely the topological order. It is the
   * cleanest statement of "DP is a walk over a DAG of subproblems", because
   * here the DAG is the input rather than something the recursion implies.
   */
  function longestPath(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const order = topologicalOrder(adjacency);

    if (order === null) return { length: null, cyclic: true, path: [], report: report };
    const best = new Array(adjacency.length).fill(0);
    const from = new Array(adjacency.length).fill(-1);

    order.forEach(function (node) {
      report.states += 1;
      adjacency[node].forEach(function (edge) {
        report.transitions += 1;

        if (best[node] + edge.weight <= best[edge.to]) return;
        best[edge.to] = best[node] + edge.weight;
        from[edge.to] = node;
      });
    });
    let end = 0;

    best.forEach(function (value, node) { if (value > best[end]) end = node; });
    const path = [];
    let at = end;

    while (at !== -1) { path.push(at); at = from[at]; }
    return { length: best[end], cyclic: false, path: path.reverse(), report: report };
  }

  /** How many distinct paths run from `source` to each node. The count can
   *  overflow a double on a dense DAG, so `exact` reports whether it stayed
   *  inside the safe integer range rather than silently rounding. */
  function countPaths(adjacency, source, options) {
    const report = (options || {}).report || emptyReport();
    const order = topologicalOrder(adjacency);

    if (order === null) return { counts: null, cyclic: true, report: report };
    const counts = new Array(adjacency.length).fill(0);

    counts[source] = 1;
    order.forEach(function (node) {
      report.states += 1;
      adjacency[node].forEach(function (edge) {
        report.transitions += 1;
        counts[edge.to] += counts[node];
      });
    });
    const exact = counts.every(function (value) { return value <= Number.MAX_SAFE_INTEGER; });
    return { counts: counts, cyclic: false, exact: exact, report: report };
  }

  /** Count the strings of length `length` a DFA accepts, over an explicit
   *  alphabet. The bridge to M24, and the same walk as `countUpTo` with the
   *  tight flag removed. */
  function countAcceptedStrings(automaton, alphabet, length, options) {
    const report = (options || {}).report || emptyReport();
    let current = new Map([[automaton.start, 1]]);

    for (let step = 0; step < length; step += 1) {
      const next = new Map();

      current.forEach(function (count, state) {
        report.states += 1;
        alphabet.forEach(function (symbol) {
          report.transitions += 1;
          const target = automaton.step(state, symbol, true);

          if (target === null) return;
          next.set(target, (next.get(target) || 0) + count);
        });
      });
      current = next;
    }
    let total = 0;

    current.forEach(function (count, state) {
      if (automaton.accepting(state)) total += count;
    });
    return { count: total, report: report };
  }

  return {
    emptyReport: emptyReport, digitsOf: digitsOf,
    countUpTo: countUpTo, countInRange: countInRange, countBruteForce: countBruteForce,
    noEqualAdjacent: noEqualAdjacent, strictlyIncreasing: strictlyIncreasing,
    digitSumDivisibleBy: digitSumDivisibleBy, containsThirteen: containsThirteen,
    topologicalOrder: topologicalOrder, longestPath: longestPath, countPaths: countPaths,
    countAcceptedStrings: countAcceptedStrings
  };
}));
