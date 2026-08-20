/**
 * A generic state-space explorer, so backtracking, branch and bound and
 * meet-in-the-middle are measured by the same instrument.
 *
 * Every search in this milestone is the same three questions with different
 * answers: what are the successors of a state, when is a state hopeless, and
 * what is the best value still reachable from here. Give the lab those three
 * and it produces the node counts, the pruning ratio and the tree the demos
 * draw - which means a comparison between two prunings is a comparison of two
 * runs of the *same* explorer, not of two hand-written solvers that might
 * differ in ways nobody controlled for.
 *
 * The explorer keeps the tree only up to `treeLimit` nodes. A search that
 * visits ten million states cannot be drawn and the attempt is what freezes a
 * page; the counters keep counting after the drawing stops, and `treeTruncated`
 * says so rather than quietly showing a prefix as though it were the whole
 * search.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SearchTreeLab = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const TREE_LIMIT = 600;
  const NODE_BUDGET = 2000000;

  function emptyReport() {
    return {
      nodes: 0, expanded: 0, leaves: 0, pruned: 0, prunedByBound: 0,
      prunedByFeasibility: 0, incumbentUpdates: 0, maxDepth: 0,
      treeNodes: 0, treeTruncated: false, budgetExhausted: false
    };
  }

  function pruningRatio(report) {
    const considered = report.nodes + report.pruned;
    return considered ? report.pruned / considered : 0;
  }

  /**
   * Depth-first exploration.
   *
   * `spec` supplies:
   *   root         the initial state
   *   successors   state -> array of states
   *   isGoal       state -> boolean            (optional)
   *   isFeasible   state -> boolean            (optional; false prunes)
   *   bound        state -> number             (optional; compared to incumbent)
   *   value        state -> number             (optional; scores a goal)
   *   maximise     boolean                     (default true)
   *
   * Returning the incumbent *and* the tree from one call is deliberate: a demo
   * that re-runs the search to draw it is measuring one search and drawing
   * another.
   */
  function explore(spec, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.nodeBudget || NODE_BUDGET;
    const treeLimit = settings.treeLimit === undefined ? TREE_LIMIT : settings.treeLimit;
    const maximise = spec.maximise !== false;
    const nodes = [];
    const edges = [];

    let incumbent = { value: maximise ? -Infinity : Infinity, state: null };

    function better(value) {
      return maximise ? value > incumbent.value : value < incumbent.value;
    }

    function boundBeats(value) {
      if (incumbent.state === null) return true;
      return maximise ? value > incumbent.value : value < incumbent.value;
    }

    function record(state, depth, parent, kind) {
      if (nodes.length >= treeLimit) {
        report.treeTruncated = true;
        return -1;
      }
      const id = nodes.length;
      nodes.push({ id: id, depth: depth, label: spec.label ? spec.label(state) : String(id), kind: kind });
      if (parent >= 0) edges.push({ from: parent, to: id });
      report.treeNodes = nodes.length;
      return id;
    }

    function classify(state) {
      if (spec.isFeasible && !spec.isFeasible(state)) {
        report.pruned += 1;
        report.prunedByFeasibility += 1;
        return 'infeasible';
      }
      if (spec.bound && !boundBeats(spec.bound(state))) {
        report.pruned += 1;
        report.prunedByBound += 1;
        return 'bounded';
      }
      return 'open';
    }

    function descend(state, depth, parent) {
      if (report.nodes >= budget) { report.budgetExhausted = true; return; }
      report.nodes += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);

      const verdict = classify(state);
      const id = record(state, depth, parent, verdict);
      if (verdict !== 'open') return;

      if (spec.isGoal && spec.isGoal(state)) {
        report.leaves += 1;
        const value = spec.value ? spec.value(state) : 0;
        if (better(value)) {
          incumbent = { value: value, state: state };
          report.incumbentUpdates += 1;
        }
        return;
      }

      const children = spec.successors(state);
      if (!children.length) { report.leaves += 1; return; }
      report.expanded += 1;
      children.forEach(function (child) { descend(child, depth + 1, id); });
    }

    descend(spec.root, 0, -1);
    report.pruningRatio = pruningRatio(report);
    return {
      incumbent: incumbent.state === null ? null : incumbent,
      report: report,
      tree: { nodes: nodes, edges: edges }
    };
  }

  /* --------------------------------------------------- n-queens as a spec */

  /** The n-queens state space expressed for the generic explorer, so the
   *  pruning toggles in the demo are the explorer's toggles rather than a
   *  second implementation that has to be kept in step. */
  function queensSpec(n, settings) {
    const options = settings || {};
    return {
      root: [],
      maximise: true,
      label: function (state) { return state.join(''); },
      successors: function (state) {
        if (state.length === n) return [];
        const out = [];
        for (let column = 0; column < n; column += 1) {
          if (options.symmetry && state.length === 0 && column >= Math.ceil(n / 2)) continue;
          out.push(state.concat([column]));
        }
        return out;
      },
      isFeasible: function (state) {
        if (!options.earlyCheck) return true;
        const row = state.length - 1;
        if (row < 0) return true;
        for (let r = 0; r < row; r += 1) {
          if (state[r] === state[row]) return false;
          if (row - r === Math.abs(state[row] - state[r])) return false;
        }
        return true;
      },
      isGoal: function (state) { return state.length === n; },
      value: function (state) { return legalBoard(state) ? 1 : 0; }
    };
  }

  function legalBoard(state) {
    for (let i = 0; i < state.length; i += 1) {
      for (let j = i + 1; j < state.length; j += 1) {
        if (state[i] === state[j]) return false;
        if (j - i === Math.abs(state[j] - state[i])) return false;
      }
    }
    return true;
  }

  /* -------------------------------------------------- knapsack as a spec */

  /** 0/1 knapsack for the explorer, with the bound as a supplied function so
   *  the branch-and-bound section can swap it and watch the tree collapse. */
  function knapsackSpec(items, capacity, boundFn) {
    const sorted = items.slice().sort(function (a, b) {
      return (b.value / b.weight) - (a.value / a.weight);
    });

    return {
      root: { at: 0, value: 0, room: capacity, taken: [] },
      maximise: true,
      label: function (state) { return state.taken.length + '/' + state.at; },
      successors: function (state) {
        if (state.at === sorted.length) return [];
        const item = sorted[state.at];
        const out = [];
        if (item.weight <= state.room) {
          out.push({
            at: state.at + 1, value: state.value + item.value,
            room: state.room - item.weight, taken: state.taken.concat([item.id])
          });
        }
        out.push({ at: state.at + 1, value: state.value, room: state.room, taken: state.taken });
        return out;
      },
      isGoal: function (state) { return state.at === sorted.length; },
      value: function (state) { return state.value; },
      bound: boundFn ? function (state) { return boundFn(sorted, state.at, state.value, state.room); } : null
    };
  }

  return {
    TREE_LIMIT: TREE_LIMIT,
    NODE_BUDGET: NODE_BUDGET,
    emptyReport: emptyReport,
    pruningRatio: pruningRatio,
    explore: explore,
    queensSpec: queensSpec,
    knapsackSpec: knapsackSpec,
    legalBoard: legalBoard
  };
}));
