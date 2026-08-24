/**
 * One representation for DFAs, NFAs, ε-NFAs and transducers, with execution
 * traces and the conversions between them.
 *
 * Everything in M24 and everything that reuses automata later — the lexer, the
 * protocol state machines, the model checker — runs on this shape:
 *
 *   { states: [...], alphabet: [...], start, accepting: [...], delta }
 *
 * `delta` maps a state to a symbol to a DESTINATION SET, always, even for a
 * deterministic machine. Carrying one shape rather than two removes the class
 * of bug where a conversion returns the other kind and every caller has to
 * branch; `isDeterministic` reports the property instead of the type declaring
 * it. The epsilon symbol is the empty string, which is why `alphabet` is
 * explicit rather than derived: a machine with an ε-transition and nothing else
 * still has an alphabet.
 *
 * Execution returns a trace rather than a boolean, because every demo in the
 * milestone shows the run and the animated view needs the set of active states
 * at each step. `accepts` is the boolean wrapper.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Automaton = api;
}(this, function () {
  'use strict';

  const EPSILON = '';

  /* --------------------------------------------------------- construction */

  /**
   * Normalise a machine description. `delta` may be written with a single
   * destination string per symbol — the readable form for a DFA — and is
   * widened to a set here so nothing downstream has to check.
   */
  function create(config) {
    const delta = {};

    Object.keys(config.delta || {}).forEach(function (state) {
      delta[state] = {};
      Object.keys(config.delta[state]).forEach(function (symbol) {
        const target = config.delta[state][symbol];

        delta[state][symbol] = Array.isArray(target) ? target.slice() : [target];
      });
    });
    const states = config.states ? config.states.slice() : Object.keys(delta);

    return {
      states: states,
      alphabet: (config.alphabet || []).slice(),
      start: Array.isArray(config.start) ? config.start.slice() : [config.start],
      accepting: (config.accepting || []).slice(),
      delta: delta,
      label: config.label || null
    };
  }

  function isAccepting(machine, state) {
    return machine.accepting.indexOf(state) !== -1;
  }

  /** Deterministic means: no ε-transitions, and at most one destination per
   *  (state, symbol) pair. A partial function still counts. */
  function isDeterministic(machine) {
    if (machine.start.length !== 1) return false;
    return machine.states.every(function (state) {
      const row = machine.delta[state] || {};

      return Object.keys(row).every(function (symbol) {
        return symbol !== EPSILON && row[symbol].length <= 1;
      });
    });
  }

  /** Every (state, symbol) pair has a destination, so complement is a matter
   *  of flipping the accepting set and nothing else. */
  function isTotal(machine) {
    return machine.states.every(function (state) {
      return machine.alphabet.every(function (symbol) {
        return step(machine, state, symbol).length === 1;
      });
    });
  }

  function step(machine, state, symbol) {
    const row = machine.delta[state];

    return row && row[symbol] ? row[symbol] : [];
  }

  /* ------------------------------------------------------------ execution */

  /** The set of states reachable from `states` by ε-transitions alone. */
  function epsilonClosure(machine, states) {
    const seen = {};
    const stack = states.slice();
    const out = [];

    states.forEach(function (state) { seen[state] = true; });
    while (stack.length) {
      const state = stack.pop();

      out.push(state);
      step(machine, state, EPSILON).forEach(function (next) {
        if (seen[next]) return;
        seen[next] = true;
        stack.push(next);
      });
    }
    return out.sort();
  }

  /** The set of states reachable from `states` on one input symbol, with the
   *  ε-closure applied after the move. */
  function advance(machine, states, symbol) {
    const seen = {};

    states.forEach(function (state) {
      step(machine, state, symbol).forEach(function (next) { seen[next] = true; });
    });
    return epsilonClosure(machine, Object.keys(seen).sort());
  }

  /**
   * Run the machine over an input and return every intermediate state set, so
   * the demos can show the run rather than the verdict.
   */
  function run(machine, input) {
    const symbols = Array.isArray(input) ? input : String(input).split('');
    let active = epsilonClosure(machine, machine.start);
    const trace = [{ index: -1, symbol: null, states: active.slice() }];

    for (let i = 0; i < symbols.length; i += 1) {
      active = advance(machine, active, symbols[i]);
      trace.push({ index: i, symbol: symbols[i], states: active.slice() });
      if (active.length === 0) break;
    }
    const accepted = active.some(function (state) { return isAccepting(machine, state); });

    return { accepted: accepted, trace: trace, consumed: trace.length - 1,
      stuck: trace.length - 1 < symbols.length, finalStates: active.slice() };
  }

  function accepts(machine, input) {
    return run(machine, input).accepted;
  }

  /* ------------------------------------------------------------ languages */

  /** Every string over the alphabet up to `maxLength`, in shortlex order —
   *  the enumeration every exhaustive equivalence test in this milestone uses. */
  function strings(alphabet, maxLength) {
    let level = [''];
    const out = [''];

    for (let length = 1; length <= maxLength; length += 1) {
      const next = [];

      level.forEach(function (prefix) {
        alphabet.forEach(function (symbol) { next.push(prefix + symbol); });
      });
      next.forEach(function (word) { out.push(word); });
      level = next;
    }
    return out;
  }

  /** The strings up to `maxLength` the machine accepts. */
  function language(machine, maxLength) {
    return strings(machine.alphabet, maxLength).filter(function (word) {
      return accepts(machine, word);
    });
  }

  /**
   * Exhaustive equivalence up to a length bound, with the shortest
   * disagreement returned rather than a bare boolean — a counter-example is
   * what makes a failed equivalence check actionable.
   */
  function agree(first, second, maxLength) {
    const alphabet = union(first.alphabet, second.alphabet);
    const words = strings(alphabet, maxLength);

    for (let i = 0; i < words.length; i += 1) {
      if (accepts(first, words[i]) !== accepts(second, words[i])) {
        return { equivalent: false, counterExample: words[i], tested: i + 1,
          firstAccepts: accepts(first, words[i]) };
      }
    }
    return { equivalent: true, counterExample: null, tested: words.length,
      firstAccepts: null };
  }

  function union(a, b) {
    const seen = {};

    a.concat(b).forEach(function (symbol) { seen[symbol] = true; });
    return Object.keys(seen).sort();
  }

  /* ------------------------------------------------------- subset construction */

  function nameOf(states) {
    return states.length === 0 ? '∅' : '{' + states.join(',') + '}';
  }

  /**
   * The subset construction, keeping the worklist order so the demo can build
   * the DFA one state at a time. The dead set is materialised as a real state,
   * because a total machine is what complement needs.
   */
  function toDfa(machine) {
    const startSet = epsilonClosure(machine, machine.start);
    const seen = {};
    const order = [];
    const steps = [];
    const queue = [startSet];

    seen[nameOf(startSet)] = startSet;
    order.push(startSet);
    while (queue.length) {
      const current = queue.shift();

      machine.alphabet.forEach(function (symbol) {
        const next = advance(machine, current, symbol);
        const key = nameOf(next);
        const fresh = !seen[key];

        if (fresh) {
          seen[key] = next;
          order.push(next);
          queue.push(next);
        }
        steps.push({ from: nameOf(current), symbol: symbol, to: key, fresh: fresh });
      });
    }
    return assembleDfa({ machine: machine, order: order, steps: steps });
  }

  function assembleDfa(config) {
    const machine = config.machine;
    const delta = {};
    const accepting = [];

    config.order.forEach(function (set) {
      const name = nameOf(set);

      delta[name] = {};
      machine.alphabet.forEach(function (symbol) {
        delta[name][symbol] = [nameOf(advance(machine, set, symbol))];
      });
      if (set.some(function (state) { return isAccepting(machine, state); })) {
        accepting.push(name);
      }
    });
    const dfa = create({
      states: config.order.map(nameOf),
      alphabet: machine.alphabet,
      start: nameOf(epsilonClosure(machine, machine.start)),
      accepting: accepting,
      delta: delta,
      label: 'subset of ' + (machine.label || 'nfa')
    });

    return { dfa: dfa, steps: config.steps,
      subsets: config.order.map(function (set) {
        return { name: nameOf(set), members: set.slice() };
      }) };
  }

  /* ------------------------------------------------------------- trimming */

  function reachable(machine) {
    const seen = {};
    const stack = epsilonClosure(machine, machine.start);

    stack.forEach(function (state) { seen[state] = true; });
    while (stack.length) {
      const state = stack.pop();
      const row = machine.delta[state] || {};

      Object.keys(row).forEach(function (symbol) {
        row[symbol].forEach(function (next) {
          if (seen[next]) return;
          seen[next] = true;
          stack.push(next);
        });
      });
    }
    return Object.keys(seen).sort();
  }

  /** States from which no accepting state is reachable — the dead ones. */
  function productive(machine) {
    const alive = {};
    let changed = true;

    machine.accepting.forEach(function (state) { alive[state] = true; });
    while (changed) {
      changed = false;
      machine.states.forEach(function (state) {
        if (alive[state]) return;
        const row = machine.delta[state] || {};
        const reaches = Object.keys(row).some(function (symbol) {
          return row[symbol].some(function (next) { return alive[next]; });
        });

        if (!reaches) return;
        alive[state] = true;
        changed = true;
      });
    }
    return Object.keys(alive).sort();
  }

  /** Drop unreachable and dead states. Minimisation wants this first, and the
   *  state count reported by a demo is meaningless without it. */
  function trim(machine) {
    const live = {};
    const keep = [];

    productive(machine).forEach(function (state) { live[state] = true; });
    reachable(machine).forEach(function (state) {
      if (live[state]) keep.push(state);
    });
    const delta = {};

    keep.forEach(function (state) {
      delta[state] = {};
      Object.keys(machine.delta[state] || {}).forEach(function (symbol) {
        const targets = machine.delta[state][symbol].filter(function (next) {
          return keep.indexOf(next) !== -1;
        });

        if (targets.length) delta[state][symbol] = targets;
      });
    });
    return create({
      states: keep, alphabet: machine.alphabet,
      start: machine.start.filter(function (state) { return keep.indexOf(state) !== -1; }),
      accepting: machine.accepting.filter(function (state) {
        return keep.indexOf(state) !== -1;
      }),
      delta: delta, label: machine.label
    });
  }

  /** Add a trap state so every (state, symbol) pair has a destination. */
  function complete(machine, trapName) {
    const trap = trapName || 'trap';
    const delta = {};
    let needed = false;

    machine.states.forEach(function (state) {
      delta[state] = {};
      machine.alphabet.forEach(function (symbol) {
        const targets = step(machine, state, symbol);

        if (targets.length) {
          delta[state][symbol] = targets.slice();
          return;
        }
        delta[state][symbol] = [trap];
        needed = true;
      });
    });
    if (!needed) return machine;
    delta[trap] = {};
    machine.alphabet.forEach(function (symbol) { delta[trap][symbol] = [trap]; });
    return create({
      states: machine.states.concat([trap]), alphabet: machine.alphabet,
      start: machine.start, accepting: machine.accepting, delta: delta,
      label: machine.label
    });
  }

  /**
   * An equivalent NFA with no ε-transitions: for each state and symbol, take
   * the ε-closure, move, and close again.
   *
   * Anything that reasons about PATHS rather than about the language needs
   * this first. Ambiguity detection is the example — two distinct runs on one
   * word are invisible once the two runs are represented as one state set, and
   * ε-edges make "one step" ambiguous in a way that hides them.
   */
  function removeEpsilon(machine) {
    const delta = {};
    const accepting = [];

    machine.states.forEach(function (state) {
      const closure = epsilonClosure(machine, [state]);

      delta[state] = {};
      machine.alphabet.forEach(function (symbol) {
        const targets = advance(machine, closure, symbol);

        if (targets.length) delta[state][symbol] = targets;
      });
      if (closure.some(function (s) { return isAccepting(machine, s); })) accepting.push(state);
    });
    return create({
      states: machine.states, alphabet: machine.alphabet,
      start: epsilonClosure(machine, machine.start),
      accepting: accepting, delta: delta,
      label: 'ε-free(' + (machine.label || 'nfa') + ')'
    });
  }

  /** Reverse every edge and swap start and accepting — the operation
   *  Brzozowski's minimisation runs twice. */
  function reverse(machine) {
    const delta = {};

    machine.states.forEach(function (state) { delta[state] = {}; });
    machine.states.forEach(function (state) {
      const row = machine.delta[state] || {};

      Object.keys(row).forEach(function (symbol) {
        row[symbol].forEach(function (next) {
          if (!delta[next]) delta[next] = {};
          if (!delta[next][symbol]) delta[next][symbol] = [];
          delta[next][symbol].push(state);
        });
      });
    });
    return create({
      states: machine.states, alphabet: machine.alphabet,
      start: machine.accepting, accepting: machine.start,
      delta: delta, label: 'reverse(' + (machine.label || '') + ')'
    });
  }

  /**
   * Rename states to q0, q1, … in breadth-first order from the start.
   *
   * Every construction here names states after what they were built from —
   * `{{n1,n13,n2},{n4,n6}}` after two rounds of subset construction and
   * minimisation — which is exactly the provenance you want while debugging
   * and exactly the noise you do not want in a diagram. The mapping is
   * returned so a demo can show both.
   */
  function relabel(machine, prefix) {
    const tag = prefix === undefined ? 'q' : prefix;
    const map = {};
    const order = [];
    const queue = epsilonClosure(machine, machine.start);

    queue.forEach(function (state) { map[state] = null; });
    while (queue.length) {
      const state = queue.shift();

      map[state] = tag + order.length;
      order.push(state);
      neighbours(machine, state).forEach(function (next) {
        if (map[next] !== undefined) return;
        map[next] = null;
        queue.push(next);
      });
    }
    machine.states.forEach(function (state) {
      if (map[state]) return;
      map[state] = tag + order.length;
      order.push(state);
    });
    return { machine: applyNames(machine, map, order), map: map };
  }

  function neighbours(machine, state) {
    const row = machine.delta[state] || {};
    const out = [];

    Object.keys(row).forEach(function (symbol) {
      row[symbol].forEach(function (next) { out.push(next); });
    });
    return out;
  }

  function applyNames(machine, map, order) {
    const delta = {};

    order.forEach(function (state) {
      delta[map[state]] = {};
      const row = machine.delta[state] || {};

      Object.keys(row).forEach(function (symbol) {
        delta[map[state]][symbol] = row[symbol].map(function (next) { return map[next]; });
      });
    });
    return create({
      states: order.map(function (state) { return map[state]; }),
      alphabet: machine.alphabet,
      start: machine.start.map(function (state) { return map[state]; }),
      accepting: machine.accepting.map(function (state) { return map[state]; }),
      delta: delta, label: machine.label
    });
  }

  /* ------------------------------------------------------------ reporting */

  function transitionRows(machine) {
    const rows = [];

    machine.states.forEach(function (state) {
      const row = machine.delta[state] || {};

      Object.keys(row).sort().forEach(function (symbol) {
        rows.push({ from: state, symbol: symbol === EPSILON ? 'ε' : symbol,
          to: row[symbol].slice(),
          start: machine.start.indexOf(state) !== -1,
          accepting: isAccepting(machine, state) });
      });
    });
    return rows;
  }

  function summary(machine) {
    return {
      states: machine.states.length,
      transitions: transitionRows(machine).length,
      accepting: machine.accepting.length,
      deterministic: isDeterministic(machine),
      total: isTotal(machine),
      epsilon: machine.states.some(function (state) {
        return step(machine, state, EPSILON).length > 0;
      })
    };
  }

  return {
    EPSILON: EPSILON,
    create: create, step: step, isAccepting: isAccepting,
    isDeterministic: isDeterministic, isTotal: isTotal,
    epsilonClosure: epsilonClosure, advance: advance, run: run, accepts: accepts,
    strings: strings, language: language, agree: agree, union: union,
    toDfa: toDfa, nameOf: nameOf,
    reachable: reachable, productive: productive, trim: trim, complete: complete,
    reverse: reverse, removeEpsilon: removeEpsilon, relabel: relabel,
    transitionRows: transitionRows, summary: summary
  };
}));
