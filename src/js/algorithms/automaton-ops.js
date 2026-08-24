/**
 * The closure properties, as constructions that run.
 *
 * Regular languages are closed under union, intersection, complement,
 * difference, concatenation, star and reversal, and every one of those is a
 * theorem with an algorithm attached. The product construction covers the
 * first four: run both machines at once on the same input and decide
 * acceptance from the pair, with only the accepting rule changing between
 * operations.
 *
 * The reason to care is that closure plus a decidable emptiness test makes
 * CONTAINMENT decidable — "does A match anything B does not" is
 * `empty(A ∩ complement(B))`, which is a real answer to a real policy question
 * rather than a testing exercise. When it fails, `shortestWord` produces the
 * counter-example, because "no" without a witness is not actionable.
 *
 * Complement needs a TOTAL machine, which is the trap-state detail people skip:
 * flipping the accepting set of a partial DFA accepts everything that used to
 * fall off the end, which is wrong in the other direction.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.AutomatonOps = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('../machines/automaton.js');

  const RULES = {
    intersection: function (a, b) { return a && b; },
    union: function (a, b) { return a || b; },
    difference: function (a, b) { return a && !b; },
    symmetric: function (a, b) { return a !== b; }
  };

  function pairName(left, right) {
    return '(' + left + ',' + right + ')';
  }

  /* ------------------------------------------------------------- product */

  /**
   * Run both machines at once. Only the accepting rule differs between the
   * four operations, which is the point worth showing: one construction, four
   * results.
   */
  function product(first, second, operation) {
    const left = prepare(first, first.alphabet.concat(second.alphabet));
    const right = prepare(second, first.alphabet.concat(second.alphabet));
    const rule = RULES[operation || 'intersection'];
    const alphabet = Automaton.union(left.alphabet, right.alphabet);
    const built = explore({ left: left, right: right, alphabet: alphabet, rule: rule });

    return {
      machine: Automaton.create({
        states: built.states, alphabet: alphabet,
        start: pairName(left.start[0], right.start[0]),
        accepting: built.accepting, delta: built.delta,
        label: operation + '(' + (first.label || 'a') + ', ' + (second.label || 'b') + ')'
      }),
      pairs: built.pairs, operation: operation || 'intersection'
    };
  }

  /** Determinise if needed, then total, so every pair has a successor. */
  function prepare(machine, alphabet) {
    const widened = Automaton.create({
      states: machine.states, alphabet: Automaton.union(machine.alphabet, alphabet),
      start: machine.start, accepting: machine.accepting, delta: machine.delta,
      label: machine.label
    });
    const deterministic = Automaton.isDeterministic(widened)
      ? widened : Automaton.toDfa(widened).dfa;

    return Automaton.complete(deterministic, 'dead');
  }

  function explore(config) {
    const start = [config.left.start[0], config.right.start[0]];
    const seen = {};
    const order = [start];
    const queue = [start];
    const delta = {};

    seen[pairName(start[0], start[1])] = true;
    while (queue.length) {
      const pair = queue.shift();
      const name = pairName(pair[0], pair[1]);

      delta[name] = {};
      config.alphabet.forEach(function (symbol) {
        const next = [only(config.left, pair[0], symbol), only(config.right, pair[1], symbol)];
        const key = pairName(next[0], next[1]);

        if (!seen[key]) {
          seen[key] = true;
          order.push(next);
          queue.push(next);
        }
        delta[name][symbol] = [key];
      });
    }
    return collect(config, order, delta);
  }

  function collect(config, order, delta) {
    const accepting = [];
    const pairs = order.map(function (pair) {
      const name = pairName(pair[0], pair[1]);
      const isLeft = Automaton.isAccepting(config.left, pair[0]);
      const isRight = Automaton.isAccepting(config.right, pair[1]);
      const accepts = config.rule(isLeft, isRight);

      if (accepts) accepting.push(name);
      return { name: name, left: pair[0], right: pair[1], leftAccepts: isLeft,
        rightAccepts: isRight, accepts: accepts };
    });

    return { states: order.map(function (pair) { return pairName(pair[0], pair[1]); }),
      accepting: accepting, delta: delta, pairs: pairs };
  }

  function only(machine, state, symbol) {
    const next = Automaton.step(machine, state, symbol);

    return next.length ? next[0] : 'dead';
  }

  /* ---------------------------------------------------------- complement */

  /** Determinise, total, then flip the accepting set. The order matters: flip
   *  first and every string that used to fall off the end is now accepted. */
  function complement(machine) {
    const total = prepare(machine, machine.alphabet);
    const accepting = total.states.filter(function (state) {
      return !Automaton.isAccepting(total, state);
    });

    return Automaton.create({
      states: total.states, alphabet: total.alphabet, start: total.start,
      accepting: accepting, delta: total.delta,
      label: 'complement(' + (machine.label || 'dfa') + ')'
    });
  }

  /* ------------------------------------------------------------ emptiness */

  /**
   * Breadth-first from the start state to any accepting one, returning the
   * shortest accepted word. Emptiness is reachability, and the path IS the
   * counter-example every containment answer needs.
   */
  function shortestWord(machine) {
    const start = Automaton.epsilonClosure(machine, machine.start);
    const seen = { };
    const queue = [{ states: start, word: '' }];

    seen[start.join(',')] = true;
    while (queue.length) {
      const node = queue.shift();

      if (node.states.some(function (s) { return Automaton.isAccepting(machine, s); })) {
        return node.word;
      }
      machine.alphabet.forEach(function (symbol) {
        const next = Automaton.advance(machine, node.states, symbol);
        const key = next.join(',');

        if (next.length === 0 || seen[key]) return;
        seen[key] = true;
        queue.push({ states: next, word: node.word + symbol });
      });
    }
    return null;
  }

  function isEmpty(machine) {
    return shortestWord(machine) === null;
  }

  /* --------------------------------------------------- containment / equality */

  /**
   * Does every string `first` accepts also get accepted by `second`? The
   * construction is `first ∩ complement(second)`, and the shortest word in it
   * is a string the first accepts and the second does not.
   */
  function contains(first, second) {
    const difference = product(first, complement(second), 'intersection');
    const witness = shortestWord(difference.machine);

    return { contained: witness === null, counterExample: witness,
      states: difference.machine.states.length };
  }

  /**
   * Equivalence in both directions, with the shorter counter-example reported
   * and which side accepts it — a bare "not equivalent" is not actionable.
   */
  function equivalent(first, second) {
    const forward = contains(first, second);
    const backward = contains(second, first);

    if (forward.contained && backward.contained) {
      return { equivalent: true, counterExample: null, acceptedBy: null };
    }
    const candidates = [
      { word: forward.counterExample, side: 'first' },
      { word: backward.counterExample, side: 'second' }
    ].filter(function (entry) { return entry.word !== null; });

    candidates.sort(function (a, b) { return a.word.length - b.word.length; });
    return { equivalent: false, counterExample: candidates[0].word,
      acceptedBy: candidates[0].side };
  }

  /* -------------------------------------------- concatenation, star, reversal */

  function rename(machine, prefix) {
    const map = {};
    const delta = {};

    machine.states.forEach(function (state) { map[state] = prefix + state; });
    machine.states.forEach(function (state) {
      delta[map[state]] = {};
      Object.keys(machine.delta[state] || {}).forEach(function (symbol) {
        delta[map[state]][symbol] = machine.delta[state][symbol].map(function (next) {
          return map[next];
        });
      });
    });
    return { machine: Automaton.create({
      states: machine.states.map(function (s) { return map[s]; }),
      alphabet: machine.alphabet,
      start: machine.start.map(function (s) { return map[s]; }),
      accepting: machine.accepting.map(function (s) { return map[s]; }),
      delta: delta, label: machine.label }), map: map };
  }

  /** Join the first machine's accepting states to the second's start with
   *  ε-transitions. The result is an ε-NFA, which is what the shared
   *  representation is for. */
  function concat(first, second) {
    const left = rename(first, 'L');
    const right = rename(second, 'R');
    const delta = merge(left.machine, right.machine);

    left.machine.accepting.forEach(function (state) {
      addEpsilon(delta, state, right.machine.start);
    });
    return Automaton.create({
      states: left.machine.states.concat(right.machine.states),
      alphabet: Automaton.union(first.alphabet, second.alphabet),
      start: left.machine.start, accepting: right.machine.accepting, delta: delta,
      label: 'concat(' + (first.label || 'a') + ', ' + (second.label || 'b') + ')'
    });
  }

  function merge(left, right) {
    const delta = {};

    [left, right].forEach(function (machine) {
      machine.states.forEach(function (state) {
        delta[state] = {};
        Object.keys(machine.delta[state] || {}).forEach(function (symbol) {
          delta[state][symbol] = machine.delta[state][symbol].slice();
        });
      });
    });
    return delta;
  }

  function addEpsilon(delta, from, targets) {
    if (!delta[from][Automaton.EPSILON]) delta[from][Automaton.EPSILON] = [];
    targets.forEach(function (state) { delta[from][Automaton.EPSILON].push(state); });
  }

  /** A fresh start state that is also accepting, with ε back-edges from every
   *  old accepting state. */
  function star(machine) {
    const inner = rename(machine, 'S');
    const delta = merge(inner.machine, inner.machine);

    delta.star0 = {};
    addEpsilon(delta, 'star0', inner.machine.start);
    inner.machine.accepting.forEach(function (state) {
      addEpsilon(delta, state, inner.machine.start);
      addEpsilon(delta, state, ['star0']);
    });
    return Automaton.create({
      states: ['star0'].concat(inner.machine.states), alphabet: machine.alphabet,
      start: 'star0', accepting: ['star0'], delta: delta,
      label: 'star(' + (machine.label || 'a') + ')'
    });
  }

  return {
    RULES: RULES, product: product, complement: complement,
    shortestWord: shortestWord, isEmpty: isEmpty,
    contains: contains, equivalent: equivalent,
    concat: concat, star: star, rename: rename, pairName: pairName
  };
}));
