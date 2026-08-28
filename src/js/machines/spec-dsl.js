/**
 * A TLA-shaped modelling language, small enough to print and real enough to
 * check.
 *
 * A specification here is DATA: named boolean variables, an initial
 * assignment, a list of actions written as "when these conditions hold, set
 * these variables", and invariants written as "whenever this holds, that must
 * too". Nothing in a spec is a function, which is the point — a spec you can
 * print, diff and put in a table is a spec somebody will read, and reading it
 * is where most of the value is. The industrial reports agree on that finding:
 * the model checker mostly confirms what writing the specification already
 * revealed.
 *
 * What it compiles to is `algorithms/model-check.js`, so a spec gets both the
 * explicit-state search and the SAT-based bounded check for free, and the
 * counter-example comes back as a sequence of named actions rather than as a
 * sequence of bit patterns.
 *
 * The deliberate limitation: variables are boolean. That is enough for the
 * protocols this milestone models — mutual exclusion, two-phase commit, a lost
 * message — and it keeps the state space small enough to enumerate, which is
 * what lets the two checkers be compared against each other. A real modelling
 * language has sets, functions and integers, and pays for them with a state
 * space no explicit search can enumerate.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SpecDsl = api;
}(this, function (root) {
  'use strict';

  const ModelCheck = root && root.ModelCheck
    ? root.ModelCheck : require('../algorithms/model-check.js');

  /* ------------------------------------------------------- the conditions */

  /** `x` is "x holds"; `!x` is "x does not". That is the whole syntax. */
  function holds(condition, state) {
    if (condition.charAt(0) === '!') return !state[condition.slice(1)];
    return Boolean(state[condition]);
  }

  function allHold(conditions, state) {
    return (conditions || []).every(function (row) { return holds(row, state); });
  }

  function showCondition(condition) {
    return condition.charAt(0) === '!' ? 'not ' + condition.slice(1) : condition;
  }

  function showAction(action) {
    const when = (action.when || []).map(showCondition).join(' and ') || 'always';
    const then = Object.keys(action.then || {}).map(function (name) {
      return name + ' := ' + (action.then[name] ? 'true' : 'false');
    }).join(', ');

    return { name: action.name, when: when, then: then };
  }

  /* --------------------------------------------------------- compilation */

  /**
   * An invariant is `when → require`, which is the shape almost every safety
   * property has: "whenever the coordinator has committed, both participants
   * had prepared". Writing it as an implication rather than as a predicate is
   * what makes a violated invariant explain itself — the report can say which
   * side held and which did not.
   */
  function invariantOf(spec) {
    const rows = spec.invariants || [];

    return function (state) {
      return rows.every(function (row) {
        if (!allHold(row.when, state)) return true;
        return allHold(row.require, state);
      });
    };
  }

  function firstBroken(spec, state) {
    return (spec.invariants || []).filter(function (row) {
      return allHold(row.when, state) && !allHold(row.require, state);
    })[0] || null;
  }

  function compile(spec) {
    return ModelCheck.create({
      name: spec.name || 'spec',
      vars: spec.vars.slice(),
      init: Object.assign({}, spec.init || {}),
      invariantName: (spec.invariants || []).map(function (row) { return row.name; })
        .join(' and ') || 'the invariant',
      invariant: invariantOf(spec),
      actions: spec.actions.map(function (action) {
        return { name: action.name,
          guard: function (state) { return allHold(action.when, state); },
          effect: function (state) { return Object.assign({}, state, action.then || {}); } };
      })
    });
  }

  /* ------------------------------------------------------------- the check */

  /**
   * Check a spec and report the counter-example in the spec's own vocabulary:
   * which action fired, which variables changed, and which invariant was
   * broken. A trace in bit patterns is technically the same information and is
   * not a bug report.
   */
  function check(spec, options) {
    const model = compile(spec);
    const search = ModelCheck.explore(model, options || {});

    if (!search.violated) {
      return { spec: spec.name, violated: false, states: search.states,
        transitions: search.transitions, depth: search.depth,
        exhausted: search.exhausted,
        why: search.exhausted ? 'stopped at the state limit'
          : 'every reachable state satisfies every invariant' };
    }
    return { spec: spec.name, violated: true, states: search.states,
      transitions: search.transitions, at: search.at,
      broken: firstBroken(spec, search.state),
      trace: annotate(spec, search.trace),
      replay: ModelCheck.replay(model, search.trace) };
  }

  function annotate(spec, trace) {
    return trace.map(function (row, at) {
      const before = at ? trace[at - 1].state : row.state;

      return { step: at, action: row.action,
        changed: spec.vars.filter(function (name) {
          return Boolean(before[name]) !== Boolean(row.state[name]);
        }),
        holding: spec.vars.filter(function (name) { return row.state[name]; }) };
    });
  }

  /** The reachable state graph, for the diagram and for the state count. */
  function states(spec, options) {
    const model = compile(spec);
    const all = ModelCheck.allStates(model);
    const reachable = {};
    const queue = ModelCheck.initialStates(model);
    const edges = [];

    while (queue.length && Object.keys(reachable).length < ((options || {}).limit || 4000)) {
      const state = queue.shift();
      const key = ModelCheck.keyOf(model, state);

      if (reachable[key]) continue;
      reachable[key] = state;
      collectEdges(model, state, key, queue, edges);
    }
    return { reachable: Object.keys(reachable).length, total: all.length,
      edges: edges, rows: Object.keys(reachable).map(function (key) {
        return { key: key, state: reachable[key],
          ok: model.invariant(reachable[key]) };
      }) };
  }

  function collectEdges(model, state, key, queue, edges) {
    model.actions.forEach(function (action) {
      if (!action.guard(state)) return;
      const next = action.effect(state);

      edges.push({ from: key, to: ModelCheck.keyOf(model, next), action: action.name });
      queue.push(next);
    });
  }

  /**
   * The two-phase commit fixture, and the scenario the protocol is known for.
   * Once a participant has voted to prepare it may not decide on its own, so a
   * coordinator that fails after collecting the votes leaves it holding its
   * locks with no way forward — which is not a bug in the model and is the
   * reason three-phase commit and consensus exist.
   */
  function twoPhaseCommit(options) {
    const settings = options || {};

    return { name: settings.crash === false ? 'two-phase commit' : 'two-phase commit with a crash',
      vars: ['prepare', 'v1', 'v2', 'commit', 'abort', 'down', 'stuck1', 'stuck2'],
      init: { prepare: false, v1: false, v2: false, commit: false, abort: false,
        down: false, stuck1: false, stuck2: false },
      actions: commitActions(settings.crash !== false),
      invariants: [
        { name: 'no commit without both votes', when: ['commit'], require: ['v1', 'v2'] },
        { name: 'never both commit and abort', when: ['commit'], require: ['!abort'] },
        { name: 'no participant is stuck', when: ['stuck1'], require: ['!stuck1'] }
      ] };
  }

  function commitActions(crash) {
    const rows = [
      { name: 'coordinator sends prepare', when: ['!prepare', '!down'],
        then: { prepare: true } },
      { name: 'participant 1 votes yes', when: ['prepare', '!v1'], then: { v1: true } },
      { name: 'participant 2 votes yes', when: ['prepare', '!v2'], then: { v2: true } },
      { name: 'coordinator commits', when: ['v1', 'v2', '!commit', '!abort', '!down'],
        then: { commit: true } },
      { name: 'coordinator aborts', when: ['prepare', '!commit', '!abort', '!down'],
        then: { abort: true } }
    ];

    if (!crash) return rows;
    return rows.concat([
      { name: 'the coordinator fails', when: ['prepare', '!commit', '!abort', '!down'],
        then: { down: true } },
      /* A participant that has voted and has heard nothing is blocked. It is
         not allowed to decide for itself, and saying so in the model is what
         turns the famous scenario into a checkable invariant. */
      { name: 'participant 1 is blocked', when: ['v1', 'down', '!commit', '!abort'],
        then: { stuck1: true } },
      { name: 'participant 2 is blocked', when: ['v2', 'down', '!commit', '!abort'],
        then: { stuck2: true } }
    ]);
  }

  return { holds: holds, allHold: allHold, showCondition: showCondition,
    showAction: showAction, invariantOf: invariantOf, firstBroken: firstBroken,
    compile: compile, check: check, states: states, annotate: annotate,
    twoPhaseCommit: twoPhaseCommit };
}));
