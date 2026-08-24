/**
 * Pushdown automata: a finite automaton plus one unbounded stack.
 *
 * That single addition is the whole difference between M24 and M25. A finite
 * automaton can count modulo k and cannot count to n; a stack lifts exactly
 * that restriction and gives matched pairs — which is why parsers rather than
 * tokenisers handle nesting, and where every "a regex cannot match balanced
 * brackets" argument bottoms out.
 *
 * The CFG → PDA construction below is the shorter direction of the equivalence
 * and it is only three transitions: push the start symbol, expand a
 * nonterminal on top of the stack into one of its right-hand sides, and match
 * a terminal on top against the input. That machine is a nondeterministic
 * top-down parser, which is why it accepts exactly what the grammar derives —
 * and it is checked against Earley over exhaustive short strings rather than
 * argued.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Pda = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');

  const BOTTOM = 'Z';

  /**
   * A machine is `{ states, start, startStack, accepting, byEmptyStack,
   * transitions }`. A transition reads an input symbol (or ε), pops one stack
   * symbol, and pushes a string — the standard shape, with pushes written
   * top-first so `['A', 'B']` leaves A on top.
   */
  function create(config) {
    return {
      states: config.states.slice(),
      start: config.start,
      startStack: config.startStack || BOTTOM,
      accepting: (config.accepting || []).slice(),
      byEmptyStack: config.byEmptyStack === true,
      transitions: config.transitions.slice(),
      label: config.label || null
    };
  }

  function applicable(machine, configuration, symbol) {
    return machine.transitions.filter(function (edge) {
      if (edge.from !== configuration.state) return false;
      if (edge.read !== '' && edge.read !== symbol) return false;
      return edge.pop === configuration.stack[configuration.stack.length - 1];
    });
  }

  /**
   * Run every configuration in parallel, breadth-first — a PDA is
   * nondeterministic, so "run it" means tracking the set of live
   * configurations exactly as an NFA does, with the stack as the extra state.
   *
   * The step cap is not optional: a grammar with a left-recursive rule makes
   * the CFG→PDA machine expand forever without consuming input, so a search
   * with no bound does not terminate. Reporting the cap honestly is better
   * than pretending the machine rejected.
   */
  function run(machine, tokens, limit) {
    const cap = limit === undefined ? 20000 : limit;
    const start = { state: machine.start, stack: [machine.startStack], at: 0, depth: 0 };
    const seen = {};
    const queue = [start];
    const trace = [];
    let steps = 0;

    seen[key(start)] = true;
    while (queue.length && steps < cap) {
      const current = queue.shift();

      steps += 1;
      if (trace.length < 40) trace.push(snapshot(current));
      if (isAccepting(machine, current, tokens)) {
        return { accepted: true, steps: steps, trace: trace, exhausted: false };
      }
      expand(machine, current, tokens, seen, queue);
    }
    return { accepted: false, steps: steps, trace: trace, exhausted: queue.length > 0 };
  }

  function expand(machine, current, tokens, seen, queue) {
    const symbol = tokens[current.at];

    applicable(machine, current, symbol).forEach(function (edge) {
      if (edge.read !== '' && current.at >= tokens.length) return;
      const stack = current.stack.slice(0, current.stack.length - 1)
        .concat(edge.push.slice().reverse());

      if (stack.length > 64) return;
      const next = { state: edge.to, stack: stack,
        at: current.at + (edge.read === '' ? 0 : 1), depth: current.depth + 1 };

      if (seen[key(next)]) return;
      seen[key(next)] = true;
      queue.push(next);
    });
  }

  function isAccepting(machine, configuration, tokens) {
    if (configuration.at !== tokens.length) return false;
    if (machine.byEmptyStack) return configuration.stack.length === 0;
    return machine.accepting.indexOf(configuration.state) !== -1;
  }

  function key(configuration) {
    return configuration.state + '|' + configuration.stack.join(',') + '|' + configuration.at;
  }

  function snapshot(configuration) {
    return { state: configuration.state, at: configuration.at,
      stack: configuration.stack.slice().reverse().join(' '), depth: configuration.depth };
  }

  function accepts(machine, tokens, limit) {
    return run(machine, tokens, limit).accepted;
  }

  /* ----------------------------------------------------- CFG → PDA */

  /**
   * One state, acceptance by empty stack, three kinds of transition. The
   * machine is a nondeterministic top-down parser: it guesses which production
   * to use and the search explores every guess.
   */
  function fromGrammar(grammar) {
    const transitions = [];

    grammar.nonterminals.forEach(function (name) {
      grammar.byLhs[name].forEach(function (rule) {
        transitions.push({ from: 'q', to: 'q', read: '', pop: name, push: rule.rhs.slice(),
          why: 'expand ' + name + ' → ' + (rule.rhs.join(' ') || 'ε') });
      });
    });
    grammar.terminals.forEach(function (terminal) {
      transitions.push({ from: 'q', to: 'q', read: terminal, pop: terminal, push: [],
        why: 'match ' + terminal });
    });
    return create({ states: ['q'], start: 'q', startStack: grammar.start, accepting: [],
      byEmptyStack: true, transitions: transitions,
      label: 'PDA for ' + (grammar.label || 'grammar') });
  }

  /* ------------------------------------------------------ ready-made */

  /** Balanced brackets by empty stack — the canonical example, and the
   *  smallest language a finite automaton cannot recognise. */
  function brackets() {
    return create({
      states: ['q'], start: 'q', startStack: BOTTOM, accepting: [], byEmptyStack: true,
      transitions: [
        { from: 'q', to: 'q', read: '(', pop: BOTTOM, push: ['(', BOTTOM],
          why: 'push the first bracket' },
        { from: 'q', to: 'q', read: '(', pop: '(', push: ['(', '('],
          why: 'push a nested bracket' },
        { from: 'q', to: 'q', read: ')', pop: '(', push: [], why: 'match a pair' },
        { from: 'q', to: 'q', read: '', pop: BOTTOM, push: [], why: 'accept when balanced' }
      ],
      label: 'balanced brackets'
    });
  }

  /** `aⁿbⁿ`, the language the whole hierarchy argument is about. */
  function anbn() {
    return create({
      states: ['push', 'pop'], start: 'push', startStack: BOTTOM, accepting: [],
      byEmptyStack: true,
      transitions: [
        { from: 'push', to: 'push', read: 'a', pop: BOTTOM, push: ['A', BOTTOM],
          why: 'first a' },
        { from: 'push', to: 'push', read: 'a', pop: 'A', push: ['A', 'A'], why: 'another a' },
        { from: 'push', to: 'pop', read: 'b', pop: 'A', push: [], why: 'first b matches an a' },
        { from: 'pop', to: 'pop', read: 'b', pop: 'A', push: [], why: 'another b matches an a' },
        { from: 'push', to: 'pop', read: '', pop: BOTTOM, push: [], why: 'the empty string' },
        { from: 'pop', to: 'pop', read: '', pop: BOTTOM, push: [], why: 'accept when balanced' }
      ],
      label: 'aⁿbⁿ'
    });
  }

  /** Transitions as rows for the demo. */
  function transitionRows(machine) {
    return machine.transitions.map(function (edge) {
      return {
        from: edge.from, to: edge.to,
        read: edge.read === '' ? 'ε' : edge.read,
        pop: edge.pop,
        push: edge.push.length ? edge.push.join(' ') : 'ε',
        why: edge.why || ''
      };
    });
  }

  return {
    BOTTOM: BOTTOM, create: create, run: run, accepts: accepts,
    fromGrammar: fromGrammar, brackets: brackets, anbn: anbn,
    transitionRows: transitionRows, applicable: applicable
  };
}));
