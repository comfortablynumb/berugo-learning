/**
 * Model checking a finite-state system two ways, and requiring them to agree.
 *
 * A model here is boolean state variables, an initial condition, and a set of
 * guarded actions. That is small enough to fit on a page and large enough for
 * every protocol bug in this milestone: mutual exclusion, two-phase commit's
 * blocking scenario, a lost message.
 *
 * **Explicit-state search** enumerates the reachable states breadth-first,
 * checks the invariant at each, and returns the path to the first violation.
 * That path is the artefact worth having — a counter-example is a bug report
 * with an exact reproduction, produced before the code exists.
 *
 * **Bounded model checking** asks the same question as a SAT problem: unroll
 * the transition relation k times, assert the invariant fails at some step,
 * and hand it to the solver. If it answers SAT the model is a violating trace;
 * if UNSAT there is no violation within k steps, which is a weaker statement
 * than "no violation" and the report says so.
 *
 * The two are run against each other because they fail differently. Explicit
 * search is limited by the state space and exact within it; BMC is limited by
 * the depth and exact within that. A disagreement is a bug in one of them, and
 * `compare` reports the first depth at which they differ rather than a
 * boolean.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ModelCheck = api;
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  const Sat = pick('Sat', '../machines/solver/sat.js');
  const SatCheck = pick('SatCheck', '../machines/solver/check.js');

  function pick(name, file) {
    if (root && root.Berugo && root.Berugo[name]) return root.Berugo[name];
    return require(file);
  }

  /* --------------------------------------------------------- the model */

  /**
   * `vars` are boolean names; `init` is a partial assignment (anything absent
   * is free, which is how a model says "either"); `actions` are
   * `{ name, guard, effect }` over a plain object; `invariant` is the property.
   */
  function create(spec) {
    return { name: spec.name || 'model', vars: spec.vars.slice(),
      init: Object.assign({}, spec.init || {}),
      actions: spec.actions.slice(), invariant: spec.invariant,
      invariantName: spec.invariantName || 'the invariant' };
  }

  function keyOf(model, state) {
    return model.vars.map(function (name) { return state[name] ? '1' : '0'; }).join('');
  }

  function initialStates(model) {
    let states = [{}];

    model.vars.forEach(function (name) {
      if (model.init[name] !== undefined) {
        states = states.map(function (state) {
          const next = Object.assign({}, state);

          next[name] = Boolean(model.init[name]);
          return next;
        });
        return;
      }
      states = states.reduce(function (into, state) {
        return into.concat([Object.assign({}, state, { name: undefined })]
          .map(function () { return Object.assign({}, state); })
          .concat([]));
      }, []).concat([]);
      states = expand(states, name);
    });
    return states;
  }

  function expand(states, name) {
    const out = [];

    states.forEach(function (state) {
      out.push(Object.assign({}, state, keyed(name, false)));
      out.push(Object.assign({}, state, keyed(name, true)));
    });
    return out;
  }

  function keyed(name, value) {
    const row = {};

    row[name] = value;
    return row;
  }

  /* ------------------------------------------------- explicit-state search */

  /**
   * Breadth-first, so the first violation found is at the shortest depth —
   * which is what makes the counter-example readable. A depth-first search
   * finds a violation just as reliably and hands back a trace nobody wants to
   * read.
   */
  function explore(model, options) {
    const settings = options || {};
    const limit = settings.states || 20000;
    const seen = {};
    const queue = initialStates(model).map(function (state) {
      return { state: state, trace: [{ action: 'init', state: state }] };
    });
    const run = { states: 0, transitions: 0, frontier: queue.length, depth: 0 };

    while (queue.length && run.states < limit) {
      const here = queue.shift();
      const outcome = visit(model, here, seen, queue, run);

      if (outcome) return Object.assign({ model: model.name }, outcome, run);
    }
    return { violated: false, model: model.name, states: run.states,
      transitions: run.transitions, depth: run.depth, exhausted: run.states >= limit,
      why: run.states >= limit ? 'stopped at the state limit' : 'every reachable state holds' };
  }

  function visit(model, here, seen, queue, run) {
    const key = keyOf(model, here.state);

    if (seen[key]) return null;
    seen[key] = true;
    run.states += 1;
    run.depth = Math.max(run.depth, here.trace.length - 1);
    if (!model.invariant(here.state)) {
      return { violated: true, trace: here.trace, at: here.trace.length - 1,
        state: here.state };
    }
    model.actions.forEach(function (action) {
      if (!action.guard(here.state)) return;
      run.transitions += 1;
      queue.push({ state: action.effect(here.state),
        trace: here.trace.concat([{ action: action.name,
          state: action.effect(here.state) }]) });
    });
    return null;
  }

  /**
   * Replay a counter-example against the model and confirm it really violates
   * the property. A trace nobody replayed is a claim; this is the check that
   * turns it into a fact, and it is separate from the search that produced it.
   */
  function replay(model, trace) {
    let state = trace[0].state;

    for (let at = 1; at < trace.length; at += 1) {
      const action = model.actions.filter(function (row) {
        return row.name === trace[at].action;
      })[0];

      if (!action) return { ok: false, at: at, why: 'unknown action ' + trace[at].action };
      if (!action.guard(state)) {
        return { ok: false, at: at, why: 'the guard of ' + action.name + ' does not hold' };
      }
      state = action.effect(state);
    }
    return { ok: !model.invariant(state), state: state, steps: trace.length - 1,
      why: model.invariant(state)
        ? 'the trace ends in a state that satisfies the invariant'
        : 'the trace reaches a state violating ' + model.invariantName };
  }

  /* ------------------------------------------------ bounded model checking */

  /**
   * The unrolling. Variable `v` at step `t` becomes one propositional
   * variable; the transition relation becomes "at every step, exactly one
   * action fires and its effect holds"; and the property becomes "at some
   * step, the invariant is false". The whole thing goes to the SAT solver, and
   * the model it returns IS the counter-example trace.
   *
   * Actions are encoded by enumerating their behaviour over the state space,
   * which is honest for a model of this size and is where a real BMC tool
   * would use a symbolic transition relation instead.
   */
  function encode(model, depth) {
    const box = { index: {}, next: 1 };

    model.vars.forEach(function (name) {
      for (let step = 0; step <= depth; step += 1) fresh(box, name + '@' + step);
    });
    const clauses = [];

    encodeInit(model, box.index, clauses);
    encodeSteps(model, box, clauses, depth);
    encodeProperty(model, box, clauses, depth);
    return { clauses: clauses, variables: box.next - 1, index: box.index, depth: depth };
  }

  /** One counter, so a variable number is never derived from a key count. */
  function fresh(box, key) {
    if (box.index[key] === undefined) {
      box.index[key] = box.next;
      box.next += 1;
    }
    return box.index[key];
  }

  function encodeInit(model, index, clauses) {
    model.vars.forEach(function (name) {
      if (model.init[name] === undefined) return;
      const literal = index[name + '@0'];

      clauses.push([model.init[name] ? literal : -literal]);
    });
  }

  /**
   * One clause per (state, step) pair saying "if the state at step t is this
   * one, then the state at t+1 is one of the successors". Enumerating the
   * state space to build it is exponential and exact, and it is the honest
   * thing at this scale — the alternative is a symbolic relation, which is a
   * different section.
   */
  function encodeSteps(model, box, clauses, depth) {
    const states = allStates(model);

    for (let step = 0; step < depth; step += 1) {
      states.forEach(function (state, at) {
        const successors = successorsOf(model, state);
        const premise = model.vars.map(function (name) {
          return state[name] ? -box.index[name + '@' + step] : box.index[name + '@' + step];
        });

        if (!successors.length) { clauses.push(premise.slice()); return; }
        encodeChoice(model, box, clauses, { premise: premise, state: state,
          successors: successors, step: step, at: at });
      });
    }
  }

  /**
   * "One of these successors" is a disjunction over states, which is not a
   * clause. It is encoded with one selector variable per successor: the
   * selectors are a disjunction, and each selector implies its state's values
   * at the next step. That is the standard Tseitin trick and it is why the
   * encoding stays in CNF.
   */
  function encodeChoice(model, box, clauses, run) {
    const selectors = run.successors.map(function (successor, at) {
      return fresh(box, 'sel@' + run.step + '@' + run.at + '@' + at);
    });

    clauses.push(run.premise.concat(selectors));
    run.successors.forEach(function (successor, at) {
      /* A selector must imply the state it was created FOR as well as the
         state it leads to. Without the first half a selector can be true when
         its premise does not hold, and the trace teleports to an arbitrary
         successor of an unrelated state - which is how bounded model checking
         reported a mutual-exclusion violation at depth 1 that the explicit
         search puts at depth 4. */
      model.vars.forEach(function (name) {
        const here = box.index[name + '@' + run.step];
        const there = box.index[name + '@' + (run.step + 1)];

        clauses.push([-selectors[at], run.state[name] ? here : -here]);
        clauses.push([-selectors[at], successor[name] ? there : -there]);
      });
    });
  }

  function encodeProperty(model, box, clauses, depth) {
    const anyStep = [];
    const states = allStates(model).filter(function (state) {
      return !model.invariant(state);
    });

    for (let step = 0; step <= depth; step += 1) {
      states.forEach(function (state, at) {
        const selector = fresh(box, 'bad@' + step + '@' + at);

        anyStep.push(selector);
        model.vars.forEach(function (name) {
          const literal = box.index[name + '@' + step];

          clauses.push([-selector, state[name] ? literal : -literal]);
        });
      });
    }
    clauses.push(anyStep.length ? anyStep : []);
  }

  function allStates(model) {
    let states = [{}];

    model.vars.forEach(function (name) { states = expand(states, name); });
    return states;
  }

  function successorsOf(model, state) {
    const out = [];
    const seen = {};

    model.actions.forEach(function (action) {
      if (!action.guard(state)) return;
      const next = action.effect(state);
      const key = keyOf(model, next);

      if (seen[key]) return;
      seen[key] = true;
      out.push(next);
    });
    return out;
  }

  /**
   * Bounded model checking at one depth: encode, solve, and decode the model
   * back into a trace of states. The UNSAT answer means "no violation within
   * this depth", which is a bounded statement and is reported as one.
   */
  function bmc(model, depth, options) {
    const encoded = encode(model, depth);
    const variables = encoded.variables;
    const answer = Sat.solve({ variables: variables, clauses: encoded.clauses },
      options || {});

    if (answer.verdict !== 'sat') {
      return { violated: false, depth: depth, verdict: answer.verdict,
        conflicts: answer.conflicts, clauses: encoded.clauses.length,
        why: 'no violation within ' + depth + ' steps — which is not "no violation"' };
    }
    return { violated: true, depth: depth, verdict: 'sat',
      conflicts: answer.conflicts, clauses: encoded.clauses.length,
      states: decodeTrace(model, encoded, answer.model),
      modelCheck: SatCheck.checkModel({ variables: variables,
        clauses: encoded.clauses }, answer.model) };
  }

  function decodeTrace(model, encoded, assignment) {
    const rows = [];

    for (let step = 0; step <= encoded.depth; step += 1) {
      const state = {};

      model.vars.forEach(function (name) {
        state[name] = Boolean(assignment[encoded.index[name + '@' + step] - 1]);
      });
      rows.push(state);
    }
    return rows;
  }

  /**
   * The differential: search finds the shallowest violation, and BMC is asked
   * at increasing depths. The depth at which BMC first reports one must equal
   * the depth the search reported, and a disagreement names which of the two
   * is wrong rather than which answer to believe.
   */
  function compare(model, maxDepth, options) {
    const search = explore(model, options);
    const rows = [];
    let firstBmc = null;

    for (let depth = 0; depth <= maxDepth; depth += 1) {
      const out = bmc(model, depth, options);

      rows.push({ depth: depth, violated: out.violated, clauses: out.clauses,
        conflicts: out.conflicts });
      if (out.violated && firstBmc === null) firstBmc = depth;
    }
    return { search: search, rows: rows, searchDepth: search.violated ? search.at : null,
      bmcDepth: firstBmc,
      agree: (search.violated ? search.at : null) === firstBmc };
  }

  return { create: create, keyOf: keyOf, initialStates: initialStates, allStates: allStates,
    explore: explore, replay: replay, encode: encode, bmc: bmc, compare: compare,
    successorsOf: successorsOf };
}));
