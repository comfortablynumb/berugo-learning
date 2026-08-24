/**
 * Automata over infinite words: Büchi acceptance, and the emptiness check that
 * makes model checking possible.
 *
 * A reactive system never terminates, so the right model of its behaviour is an
 * infinite word rather than a finite one. A Büchi automaton reads such a word
 * and accepts when it visits an accepting state INFINITELY OFTEN — which is a
 * condition about the whole run rather than about where it stops, and that one
 * change is what lets the model express liveness.
 *
 * The trick that makes it computable is that a finite automaton with an
 * accepting run on some infinite word has one of LASSO shape: a finite stem
 * into a cycle it repeats forever. So "is the language non-empty" becomes "is
 * there a reachable accepting state on a cycle", which is the nested
 * depth-first search below, and the lasso it finds IS the counter-example
 * trace a model checker reports.
 *
 * Safety and liveness are the distinction the section is about, and it is
 * mechanical: a safety property is violated by a finite prefix, so a test can
 * find it; a liveness property is violated only by an infinite suffix, so no
 * finite test ever does. That is why liveness bugs survive testing.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Buchi = api;
}(this, function () {
  'use strict';

  /**
   * A Büchi automaton over an alphabet of PROPOSITION SETS: each symbol is a
   * sorted list of the atomic propositions true at that instant, joined with
   * commas, so `req` and `req,grant` are different symbols.
   */
  function create(config) {
    return {
      states: config.states.slice(),
      alphabet: config.alphabet.slice(),
      start: config.start,
      accepting: config.accepting.slice(),
      delta: config.delta,
      label: config.label || null
    };
  }

  function successors(machine, state, symbol) {
    const row = machine.delta[state];

    return row && row[symbol] ? row[symbol] : [];
  }

  function isAccepting(machine, state) {
    return machine.accepting.indexOf(state) !== -1;
  }

  /* --------------------------------------------------------- lasso traces */

  /** A lasso: a finite stem, then a cycle repeated forever. Every infinite word
   *  a finite automaton can accept has a representative of this shape. */
  function lasso(stem, cycle) {
    return { stem: stem.slice(), cycle: cycle.slice(),
      show: stem.join(' ') + ' (' + cycle.join(' ') + ')^ω' };
  }

  /** The first `length` symbols of the infinite word a lasso denotes. */
  function unroll(trace, length) {
    const out = trace.stem.slice();

    while (out.length < length && trace.cycle.length) {
      out.push(trace.cycle[(out.length - trace.stem.length) % trace.cycle.length]);
    }
    return out.slice(0, length);
  }

  /* ---------------------------------------------------- nested depth-first */

  /**
   * The classic two-pass emptiness check. The outer search finds accepting
   * states reachable from the start; for each one, as it is finished, the
   * inner search looks for a path back to it. A hit is an accepting cycle,
   * which is an accepted infinite word.
   *
   * Doing the inner search in outer POST-ORDER is what makes it linear: each
   * state is visited at most once by each search, so the whole check is
   * O(states + transitions) rather than one full search per accepting state.
   */
  function emptiness(machine) {
    const state = { outer: {}, inner: {}, stack: [], found: null, visits: 0 };

    outerSearch(machine, machine.start, state);
    if (state.found === null) {
      return { empty: true, trace: null, visits: state.visits, accepting: null };
    }
    return { empty: false, trace: state.found.trace, visits: state.visits,
      accepting: state.found.state };
  }

  function outerSearch(machine, state, run) {
    if (run.outer[state] || run.found) return;
    run.outer[state] = true;
    run.visits += 1;
    machine.alphabet.forEach(function (symbol) {
      successors(machine, state, symbol).forEach(function (next) {
        run.stack.push({ from: state, symbol: symbol, to: next });
        outerSearch(machine, next, run);
        run.stack.pop();
      });
    });
    if (!isAccepting(machine, state) || run.found) return;
    innerSearch(machine, state, state, run, []);
  }

  function innerSearch(machine, state, seed, run, path) {
    if (run.found) return;
    const mark = seed + '@' + state;

    if (run.inner[mark]) return;
    run.inner[mark] = true;
    run.visits += 1;
    machine.alphabet.forEach(function (symbol) {
      successors(machine, state, symbol).forEach(function (next) {
        if (run.found) return;
        if (next === seed) {
          run.found = { state: seed,
            trace: lasso(run.stack.map(function (edge) { return edge.symbol; }),
              path.concat([symbol])) };
          return;
        }
        innerSearch(machine, next, seed, run, path.concat([symbol]));
      });
    });
  }

  /* ----------------------------------------------------------- acceptance */

  /**
   * Does the machine accept the infinite word this lasso denotes? Run the stem,
   * then run the cycle until the (state, position-in-cycle) pair repeats, and
   * check whether an accepting state was seen inside that repetition.
   */
  function accepts(machine, trace) {
    const reached = runStem(machine, trace.stem);

    return reached.some(function (state) {
      return cycleAccepts(machine, state, trace.cycle);
    });
  }

  function runStem(machine, stem) {
    let active = [machine.start];

    stem.forEach(function (symbol) {
      const next = {};

      active.forEach(function (state) {
        successors(machine, state, symbol).forEach(function (to) { next[to] = true; });
      });
      active = Object.keys(next);
    });
    return active;
  }

  function cycleAccepts(machine, from, cycle) {
    const seen = {};
    let state = from;
    let sawAccepting = false;

    for (let round = 0; round < machine.states.length + 1; round += 1) {
      if (seen[state] !== undefined) return sawAccepting && seen[state] <= round;
      seen[state] = round;
      const walked = walkCycle(machine, state, cycle);

      if (walked === null) return false;
      sawAccepting = sawAccepting || walked.accepting;
      state = walked.state;
    }
    return sawAccepting;
  }

  function walkCycle(machine, from, cycle) {
    let state = from;
    let accepting = isAccepting(machine, state);

    for (let i = 0; i < cycle.length; i += 1) {
      const next = successors(machine, state, cycle[i]);

      if (next.length === 0) return null;
      state = next[0];
      accepting = accepting || isAccepting(machine, state);
    }
    return { state: state, accepting: accepting };
  }

  /* ------------------------------------------------ properties as machines */

  const SYMBOLS = ['', 'req', 'grant', 'req,grant'];

  function has(symbol, proposition) {
    return symbol.split(',').indexOf(proposition) !== -1;
  }

  /**
   * The NEGATION of "every request is eventually granted", which is what a
   * model checker actually builds: a machine accepting the traces that VIOLATE
   * the property, so a non-empty language is a bug with a witness.
   */
  function eventuallyGrantedViolation() {
    const delta = { idle: {}, waiting: {} };

    SYMBOLS.forEach(function (symbol) {
      delta.idle[symbol] = has(symbol, 'req') && !has(symbol, 'grant')
        ? ['idle', 'waiting'] : ['idle'];
      delta.waiting[symbol] = has(symbol, 'grant') ? [] : ['waiting'];
    });
    return create({ states: ['idle', 'waiting'], alphabet: SYMBOLS, start: 'idle',
      accepting: ['waiting'], delta: delta,
      label: 'violates: every request is eventually granted' });
  }

  /**
   * "no grant unless a request is outstanding" — a SAFETY property, whose
   * violation is a finite prefix and therefore visible to a test.
   *
   * The monitor has to REMEMBER that a request happened, which is the whole
   * point: a property about "earlier" needs state, and a monitor that only
   * looks at the current instant reports a violation every time a server
   * answers a request from the previous step.
   */
  function safetyViolation() {
    const delta = { idle: {}, pending: {}, bad: {} };

    SYMBOLS.forEach(function (symbol) {
      const request = has(symbol, 'req');
      const grant = has(symbol, 'grant');

      delta.idle[symbol] = grant ? ['bad'] : [request ? 'pending' : 'idle'];
      delta.pending[symbol] = [grant ? 'idle' : 'pending'];
      delta.bad[symbol] = ['bad'];
    });
    return create({ states: ['idle', 'pending', 'bad'], alphabet: SYMBOLS, start: 'idle',
      accepting: ['bad'], delta: delta,
      label: 'violates: no grant unless a request is outstanding' });
  }

  /**
   * The system under test: a server that grants after a request, with a
   * `starve` switch that makes it able to wait forever. The switch is the
   * point — the machine is correct for safety either way, and only the
   * liveness check tells the two apart.
   */
  function server(starve) {
    const delta = { free: {}, busy: {} };

    SYMBOLS.forEach(function (symbol) {
      delta.free[symbol] = has(symbol, 'req') && !has(symbol, 'grant') ? ['busy'] : [];
      delta.busy[symbol] = [];
    });
    delta.free[''] = ['free'];
    delta.busy['grant'] = ['free'];
    if (starve) delta.busy[''] = ['busy'];
    return create({ states: ['free', 'busy'], alphabet: SYMBOLS, start: 'free',
      accepting: ['free', 'busy'], delta: delta,
      label: starve ? 'server that may starve' : 'server that always grants' });
  }

  /** The product of the system with a violation monitor: the language is the
   *  set of system behaviours that break the property. */
  function product(system, monitor) {
    const delta = {};
    const states = [];
    const accepting = [];
    const queue = [[system.start, monitor.start]];
    const seen = {};

    seen[pair(queue[0])] = true;
    states.push(pair(queue[0]));
    while (queue.length) {
      expandPair(system, monitor, queue.shift(), { delta: delta, states: states,
        accepting: accepting, seen: seen, queue: queue });
    }
    return create({ states: states, alphabet: system.alphabet, start: pair([system.start,
      monitor.start]), accepting: accepting, delta: delta,
    label: 'product(' + system.label + ' × ' + monitor.label + ')' });
  }

  function expandPair(system, monitor, current, build) {
    const name = pair(current);

    build.delta[name] = {};
    if (isAccepting(monitor, current[1])) build.accepting.push(name);
    system.alphabet.forEach(function (symbol) {
      const lefts = successors(system, current[0], symbol);
      const rights = successors(monitor, current[1], symbol);
      const targets = [];

      lefts.forEach(function (left) {
        rights.forEach(function (right) {
          const next = [left, right];

          targets.push(pair(next));
          if (build.seen[pair(next)]) return;
          build.seen[pair(next)] = true;
          build.states.push(pair(next));
          build.queue.push(next);
        });
      });
      if (targets.length) build.delta[name][symbol] = targets;
    });
  }

  function pair(states) {
    return '(' + states[0] + ',' + states[1] + ')';
  }

  return {
    create: create, successors: successors, isAccepting: isAccepting,
    lasso: lasso, unroll: unroll, emptiness: emptiness, accepts: accepts,
    eventuallyGrantedViolation: eventuallyGrantedViolation,
    safetyViolation: safetyViolation, server: server, product: product,
    SYMBOLS: SYMBOLS, pair: pair, has: has
  };
}));
