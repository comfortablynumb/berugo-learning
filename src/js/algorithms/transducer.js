/**
 * Finite-state transducers: automata that write as well as read.
 *
 * A Mealy machine labels each TRANSITION with an output, a Moore machine
 * labels each STATE, and the two are interconvertible — Moore is easier to
 * reason about and Mealy is usually one state smaller, which is the whole
 * trade. Both are here because text pipelines in the wild use both shapes.
 *
 * The operation that matters is COMPOSITION. Chaining two text passes means
 * materialising the intermediate string: a full copy, a second traversal, and
 * every position offset in the original lost. Composing the two transducers
 * instead produces one machine that does both jobs in a single pass, which is
 * why speech and NLP pipelines are built from FSTs rather than from `replace`
 * calls. The composed machine's state is a pair, exactly as in the product
 * construction.
 *
 * `epsilonOutput` is the empty string, so a transition may consume a symbol and
 * emit nothing — which is what makes deletion (whitespace collapsing, case
 * folding to a shorter form) expressible at all.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Transducer = api;
}(this, function () {
  'use strict';

  /* --------------------------------------------------------- construction */

  /**
   * A Mealy machine. `delta[state][symbol]` is `{ to, out }`: where to go and
   * what to write.
   */
  function mealy(config) {
    return {
      kind: 'mealy',
      states: config.states.slice(),
      alphabet: config.alphabet.slice(),
      start: config.start,
      delta: config.delta,
      label: config.label || null
    };
  }

  /**
   * A Moore machine. The output hangs off the state, so it is emitted on
   * ARRIVAL — which means a Moore machine always writes one more symbol than a
   * Mealy machine reads, the one for its start state.
   */
  function moore(config) {
    return {
      kind: 'moore',
      states: config.states.slice(),
      alphabet: config.alphabet.slice(),
      start: config.start,
      delta: config.delta,
      output: config.output,
      label: config.label || null
    };
  }

  function stepOf(machine, state, symbol) {
    const row = machine.delta[state];

    if (!row || row[symbol] === undefined) return null;
    const target = row[symbol];

    if (machine.kind === 'moore') {
      return { to: target, out: machine.output[target] === undefined ? '' : machine.output[target] };
    }
    return { to: target.to, out: target.out === undefined ? '' : target.out };
  }

  /* ------------------------------------------------------------ execution */

  /**
   * Run the machine and return the output plus the per-symbol trace, so a demo
   * can show which transition produced which characters.
   */
  function run(machine, input) {
    const symbols = String(input).split('');
    const trace = [];
    let state = machine.start;
    let output = machine.kind === 'moore' && machine.output[state] !== undefined
      ? machine.output[state] : '';

    for (let i = 0; i < symbols.length; i += 1) {
      const move = stepOf(machine, state, symbols[i]);

      if (move === null) {
        return { output: output, trace: trace, complete: false, stoppedAt: i, state: state };
      }
      trace.push({ index: i, symbol: symbols[i], from: state, to: move.to, out: move.out });
      output += move.out;
      state = move.to;
    }
    return { output: output, trace: trace, complete: true, stoppedAt: symbols.length,
      state: state };
  }

  /* ---------------------------------------------------------- composition */

  /**
   * Compose two Mealy machines: run the first, feed its output into the
   * second, and produce one machine that does both in a single pass.
   *
   * The subtlety is that the first machine may emit several symbols — or none
   * — for one input symbol, so the second machine advances zero or many steps
   * per composed transition. The composed output is whatever the second
   * machine wrote along the way, and its state moves accordingly.
   */
  function compose(first, second) {
    const start = [first.start, second.start];
    const seen = { };
    const order = [start];
    const queue = [start];
    const delta = {};

    seen[pair(start)] = true;
    while (queue.length) {
      const current = queue.shift();

      delta[pair(current)] = {};
      first.alphabet.forEach(function (symbol) {
        const edge = composedEdge(first, second, current, symbol);

        if (edge === null) return;
        if (!seen[pair(edge.to)]) {
          seen[pair(edge.to)] = true;
          order.push(edge.to);
          queue.push(edge.to);
        }
        delta[pair(current)][symbol] = { to: pair(edge.to), out: edge.out };
      });
    }
    return mealy({ states: order.map(pair), alphabet: first.alphabet.slice(),
      start: pair(start), delta: delta,
      label: 'compose(' + (first.label || 'f') + ', ' + (second.label || 'g') + ')' });
  }

  function pair(states) {
    return '(' + states[0] + ',' + states[1] + ')';
  }

  /** One composed transition: the first machine moves once, and the second
   *  consumes every symbol the first wrote. */
  function composedEdge(first, second, current, symbol) {
    const outer = stepOf(first, current[0], symbol);

    if (outer === null) return null;
    let inner = current[1];
    let written = '';
    const middle = outer.out.split('');

    for (let i = 0; i < middle.length; i += 1) {
      const move = stepOf(second, inner, middle[i]);

      if (move === null) return null;
      written += move.out;
      inner = move.to;
    }
    return { to: [outer.to, inner], out: written };
  }

  /* ------------------------------------------------------------ weighting */

  /**
   * A weighted transducer over the tropical semiring: weights add along a path
   * and the best path is the minimum. That one choice of semiring turns
   * "run the machine" into "find the shortest path", which is the general
   * shape every decoder in this area has, including Viterbi.
   */
  function bestPath(machine, input) {
    const symbols = String(input).split('');
    let frontier = {};

    frontier[machine.start] = { cost: 0, output: '', path: [machine.start] };
    for (let i = 0; i < symbols.length; i += 1) {
      frontier = relax(machine, frontier, symbols[i]);
      if (Object.keys(frontier).length === 0) {
        return { found: false, cost: Infinity, output: null, path: [], consumed: i };
      }
    }
    return finish(frontier, symbols.length);
  }

  function relax(machine, frontier, symbol) {
    const next = {};

    Object.keys(frontier).forEach(function (state) {
      const row = machine.delta[state] || {};
      const edges = row[symbol] || [];

      (Array.isArray(edges) ? edges : [edges]).forEach(function (edge) {
        const cost = frontier[state].cost + (edge.weight === undefined ? 0 : edge.weight);
        const found = next[edge.to];

        if (found && found.cost <= cost) return;
        next[edge.to] = { cost: cost, output: frontier[state].output + (edge.out || ''),
          path: frontier[state].path.concat([edge.to]) };
      });
    });
    return next;
  }

  function finish(frontier, consumed) {
    let best = null;

    Object.keys(frontier).forEach(function (state) {
      if (best === null || frontier[state].cost < best.cost) best = frontier[state];
    });
    return { found: true, cost: best.cost, output: best.output, path: best.path,
      consumed: consumed };
  }

  /* --------------------------------------------------- ready-made machines */

  /** Case folding: one state, one output per letter. The simplest useful
   *  transducer, and the baseline the composition demo builds on. */
  function caseFolder(alphabet) {
    const delta = { q: {} };

    alphabet.forEach(function (symbol) {
      delta.q[symbol] = { to: 'q', out: symbol.toLowerCase() };
    });
    return mealy({ states: ['q'], alphabet: alphabet.slice(), start: 'q', delta: delta,
      label: 'case-fold' });
  }

  /**
   * Whitespace collapsing: two states, because "am I just after a space" is
   * exactly the one bit that must be remembered. It emits nothing for a
   * repeated space, which is the deletion case.
   */
  function spaceCollapser(alphabet) {
    const delta = { text: {}, space: {} };

    alphabet.forEach(function (symbol) {
      if (symbol === ' ') {
        delta.text[symbol] = { to: 'space', out: ' ' };
        delta.space[symbol] = { to: 'space', out: '' };
        return;
      }
      delta.text[symbol] = { to: 'text', out: symbol };
      delta.space[symbol] = { to: 'text', out: symbol };
    });
    return mealy({ states: ['text', 'space'], alphabet: alphabet.slice(), start: 'text',
      delta: delta, label: 'collapse-spaces' });
  }

  /* ------------------------------------------------------- Mealy ↔ Moore */

  /**
   * Mealy to Moore: split each state by the output that arrives at it, which
   * is why the Moore machine is usually larger. The conversion is exact
   * except for the leading symbol Moore emits for its start state.
   */
  function toMoore(machine) {
    const outputs = collectOutputs(machine);
    const states = [];
    const output = {};
    const delta = {};

    machine.states.forEach(function (state) {
      outputs[state].forEach(function (out) {
        const name = state + '/' + (out === '' ? 'ε' : out);

        states.push(name);
        output[name] = out;
        delta[name] = {};
      });
    });
    states.forEach(function (name) {
      const origin = name.slice(0, name.lastIndexOf('/'));

      machine.alphabet.forEach(function (symbol) {
        const move = stepOf(machine, origin, symbol);

        if (move === null) return;
        delta[name][symbol] = move.to + '/' + (move.out === '' ? 'ε' : move.out);
      });
    });
    return moore({ states: states, alphabet: machine.alphabet.slice(),
      start: machine.start + '/ε', delta: delta, output: output,
      label: 'moore(' + (machine.label || 'mealy') + ')' });
  }

  function collectOutputs(machine) {
    const outputs = {};

    machine.states.forEach(function (state) { outputs[state] = ['']; });
    machine.states.forEach(function (state) {
      machine.alphabet.forEach(function (symbol) {
        const move = stepOf(machine, state, symbol);

        if (move === null) return;
        if (outputs[move.to].indexOf(move.out) === -1) outputs[move.to].push(move.out);
      });
    });
    return outputs;
  }

  return {
    mealy: mealy, moore: moore, stepOf: stepOf, run: run,
    compose: compose, composedEdge: composedEdge, pair: pair,
    bestPath: bestPath, toMoore: toMoore,
    caseFolder: caseFolder, spaceCollapser: spaceCollapser
  };
}));
