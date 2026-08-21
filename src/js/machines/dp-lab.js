/**
 * DpLab - the tracer every M12 section drives.
 *
 * The milestone's claim is that "states x transitions" is the complexity, and
 * that a memoised recursion, a tabulation and an exponential recursion are the
 * *same recurrence* evaluated three ways. That claim is only worth making if
 * the three are measured through one instrument, so `compare()` runs all three
 * on the same problem definition and reports one row each.
 *
 * A problem is `{ key(args), base(args), transitions(args) }` where
 * `transitions` returns `[{ args, combine }]` - the subproblems this state
 * needs and how to fold their answers. Writing a DP in that shape is more
 * work than writing the loop, and it buys the thing the loop cannot give: the
 * *dependency edges*, which is what the subproblem DAG is drawn from and what
 * makes "overlapping subproblems" a picture rather than a phrase.
 *
 * Two measurement decisions worth keeping:
 *
 *   - **`states` counts distinct keys, not calls.** A memoised run that
 *     reports 21 891 calls and 20 states is the whole lesson; conflating them
 *     makes the memo look like it did nothing.
 *   - **The naive run is capped.** An unmemoised Fibonacci at n = 45 is a
 *     billion calls and a hung tab. `callBudget` stops it and the row says it
 *     was stopped, because an unfinished run reported as a number is the
 *     dishonesty this platform keeps catching.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpLab = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CALL_BUDGET = 4000000;
  const EDGE_LIMIT = 4000;

  function emptyReport() {
    return { calls: 0, states: 0, transitions: 0, hits: 0, misses: 0,
      maxDepth: 0, edges: 0, edgesTruncated: false, budgetExhausted: false };
  }

  /* ------------------------------------------------------------- the runs */

  /**
   * The exponential run: no memo, every call recomputed. Capped, and the cap
   * is reported.
   */
  function naive(problem, args, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const budget = settings.callBudget || CALL_BUDGET;

    function go(current, depth) {
      report.calls += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);

      if (report.calls > budget) { report.budgetExhausted = true; return 0; }
      const base = problem.base(current);

      if (base !== null) return base;
      let value = null;

      problem.transitions(current).forEach(function (edge) {
        report.transitions += 1;
        value = edge.combine(value, go(edge.args, depth + 1));
      });
      return value;
    }
    return { value: go(args, 0), report: report };
  }

  /**
   * The memoised run, which also records the dependency edges - so the DAG
   * and the counters come from one walk rather than from two that can
   * disagree.
   */
  function memoised(problem, args, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const memo = new Map();
    const edges = [];
    const order = [];

    function go(current, depth) {
      report.calls += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);
      const key = problem.key(current);

      if (memo.has(key)) { report.hits += 1; return memo.get(key); }
      report.misses += 1;
      report.states += 1;
      const value = expand(problem, current, key, { go: go, depth: depth, report: report,
        edges: edges, order: order });
      memo.set(key, value);
      return value;
    }
    const value = go(args, 0);
    report.edges = edges.length;
    return { value: value, memo: memo, edges: edges, order: order, report: report };
  }

  /** One state's expansion, with its outgoing edges recorded. */
  function expand(problem, current, key, context) {
    const base = problem.base(current);

    if (base !== null) {
      context.order.push({ key: key, value: base, depth: context.depth, base: true });
      return base;
    }
    let value = null;

    problem.transitions(current).forEach(function (edge) {
      context.report.transitions += 1;
      const childKey = problem.key(edge.args);

      if (context.edges.length < EDGE_LIMIT) {
        context.edges.push({ from: key, to: childKey, label: edge.label || '' });
      } else context.report.edgesTruncated = true;
      value = edge.combine(value, context.go(edge.args, context.depth + 1));
    });
    context.order.push({ key: key, value: value, depth: context.depth, base: false });
    return value;
  }

  /**
   * The tabulated run: the same recurrence over an explicitly supplied state
   * list, in the supplied order, with no recursion at all. The order is the
   * caller's responsibility, which is exactly the point of the section - a
   * tabulation is a memoisation whose evaluation order has been worked out by
   * hand, and getting it wrong reads cells that are not there yet.
   */
  function tabulated(problem, states, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const table = new Map();
    const unresolved = [];

    states.forEach(function (current) {
      const key = problem.key(current);
      report.states += 1;
      report.misses += 1;
      const base = problem.base(current);

      if (base !== null) { table.set(key, base); return; }
      let value = null;

      problem.transitions(current).forEach(function (edge) {
        report.transitions += 1;
        const childKey = problem.key(edge.args);

        /* A real tabulation is an array that was allocated full of zeros, so a
           cell read before it is written yields 0 rather than an error. That
           is the whole failure mode: the run finishes, returns a number, and
           nothing anywhere says the number was computed from cells that did
           not exist yet. Substituting 0 here - rather than `undefined`, which
           would poison the arithmetic to NaN and give the game away - is what
           makes `unresolved` the only evidence. */
        if (!table.has(childKey)) unresolved.push({ at: key, needed: childKey });
        value = edge.combine(value, table.has(childKey) ? table.get(childKey) : 0);
      });
      table.set(key, value);
    });
    const target = settings.target === undefined
      ? problem.key(states[states.length - 1]) : problem.key(settings.target);
    return { table: table, unresolved: unresolved, value: table.get(target), report: report };
  }

  /**
   * The three runs side by side. This is the table 12.1 opens with, and the
   * reason all three go through one instrument: a naive count measured by one
   * harness and a memo count measured by another is not a comparison.
   */
  function compare(problem, args, options) {
    const settings = options || {};
    const rows = [];
    const naiveRun = naive(problem, args, { callBudget: settings.callBudget });
    const memoRun = memoised(problem, args, {});

    rows.push({ method: 'naive recursion', value: naiveRun.report.budgetExhausted ? null : naiveRun.value,
      calls: naiveRun.report.calls, states: naiveRun.report.calls, transitions: naiveRun.report.transitions,
      hits: 0, budgetExhausted: naiveRun.report.budgetExhausted });
    rows.push({ method: 'memoised recursion', value: memoRun.value, calls: memoRun.report.calls,
      states: memoRun.report.states, transitions: memoRun.report.transitions,
      hits: memoRun.report.hits, budgetExhausted: false });

    if (settings.states) {
      const tableRun = tabulated(problem, settings.states, { target: args });
      rows.push({ method: 'tabulation', value: tableRun.value, calls: 0,
        states: tableRun.report.states, transitions: tableRun.report.transitions,
        hits: 0, unresolved: tableRun.unresolved.length, budgetExhausted: false });
    }
    return { rows: rows, memo: memoRun, agree: agreementOf(rows) };
  }

  /** Do the runs that finished agree? A memo bug usually shows here first. */
  function agreementOf(rows) {
    const finished = rows.filter(function (row) { return row.value !== null; });
    return finished.every(function (row) { return row.value === finished[0].value; });
  }

  /* ------------------------------------------------------------- the DAG */

  /**
   * The subproblem DAG, de-duplicated. `shared` is how many states have more
   * than one parent, which is the *measurement* of "overlapping subproblems" -
   * a problem with zero shared states is divide and conquer, and memoising it
   * buys nothing.
   */
  function dependencyDag(run, options) {
    const limit = (options || {}).limit || 400;
    const parents = new Map();
    const seen = new Set();
    const edges = [];

    run.edges.forEach(function (edge) {
      const id = edge.from + '->' + edge.to;

      if (seen.has(id)) return;
      seen.add(id);
      parents.set(edge.to, (parents.get(edge.to) || 0) + 1);

      if (edges.length < limit) edges.push(edge);
    });
    const nodes = run.order.slice().reverse().map(function (entry) {
      return { key: entry.key, value: entry.value, depth: entry.depth, base: entry.base,
        parents: parents.get(entry.key) || 0 };
    });
    let shared = 0;

    parents.forEach(function (count) { if (count > 1) shared += 1; });
    return { nodes: nodes.slice(0, limit), edges: edges, shared: shared,
      truncated: run.edges.length > limit || nodes.length > limit };
  }

  /* ------------------------------------------------------- problem builders */

  /** Fibonacci as a `problem`, the milestone's opening instance. */
  function fibonacciProblem() {
    return {
      key: function (n) { return String(n); },
      base: function (n) { return n <= 1 ? n : null; },
      transitions: function (n) {
        return [
          { args: n - 1, label: 'n-1', combine: function (a, b) { return (a || 0) + b; } },
          { args: n - 2, label: 'n-2', combine: function (a, b) { return (a || 0) + b; } }
        ];
      }
    };
  }

  /** The states of `fibonacciProblem` in a valid tabulation order. */
  function fibonacciStates(n) {
    const states = [];

    for (let k = 0; k <= n; k += 1) states.push(k);
    return states;
  }

  /**
   * Binomial coefficients: a two-dimensional state whose DAG is a lattice
   * rather than a path, so the "shared" count is large and the picture is
   * obviously not a tree.
   */
  function binomialProblem() {
    return {
      key: function (args) { return args[0] + ',' + args[1]; },
      base: function (args) {
        return args[1] === 0 || args[1] === args[0] ? 1 : null;
      },
      transitions: function (args) {
        return [
          { args: [args[0] - 1, args[1] - 1], label: 'take',
            combine: function (a, b) { return (a || 0) + b; } },
          { args: [args[0] - 1, args[1]], label: 'skip',
            combine: function (a, b) { return (a || 0) + b; } }
        ];
      }
    };
  }

  function binomialStates(n, k) {
    const states = [];

    for (let row = 0; row <= n; row += 1) {
      for (let column = 0; column <= Math.min(row, k); column += 1) states.push([row, column]);
    }
    return states;
  }

  /**
   * A grid-path count: the cleanest instance of "states x transitions" being
   * readable off the problem statement. `(r+1)(c+1)` states, two transitions
   * each, so the complexity is on the page before any code.
   */
  function gridProblem(blocked) {
    const walls = new Set(blocked || []);
    return {
      key: function (args) { return args[0] + ',' + args[1]; },
      base: function (args) {
        if (walls.has(args[0] + ',' + args[1])) return 0;
        return args[0] === 0 && args[1] === 0 ? 1 : null;
      },
      transitions: function (args) {
        const out = [];

        if (args[0] > 0) {
          out.push({ args: [args[0] - 1, args[1]], label: 'from above',
            combine: function (a, b) { return (a || 0) + b; } });
        }

        if (args[1] > 0) {
          out.push({ args: [args[0], args[1] - 1], label: 'from the left',
            combine: function (a, b) { return (a || 0) + b; } });
        }
        return out.length ? out : [{ args: args, label: 'none',
          combine: function (a) { return a || 0; } }];
      }
    };
  }

  /** The complexity, predicted from the shape rather than measured - the
   *  number a section should be able to state before writing the loop. */
  function predictedCost(states, transitionsPerState) {
    return { states: states, transitionsPerState: transitionsPerState,
      total: states * transitionsPerState };
  }

  return {
    CALL_BUDGET: CALL_BUDGET, emptyReport: emptyReport,
    naive: naive, memoised: memoised, tabulated: tabulated, compare: compare,
    dependencyDag: dependencyDag, predictedCost: predictedCost,
    fibonacciProblem: fibonacciProblem, fibonacciStates: fibonacciStates,
    binomialProblem: binomialProblem, binomialStates: binomialStates,
    gridProblem: gridProblem
  };
}));
