/**
 * Regular expressions, three ways into an automaton, and one way back out.
 *
 * The three constructions are here together because they disagree about state
 * count in ways that are worth measuring rather than asserting. Thompson's
 * construction is the textbook one and produces an ε-NFA with at most 2m states
 * for a pattern of m symbols — a fixed budget per operator, which is why it is
 * the easy one to prove correct and the wasteful one to run. Glushkov's
 * position automaton has exactly one state per literal position plus a start,
 * so it is smaller and ε-free, at the cost of computing first, last and follow
 * sets. Brzozowski derivatives build a DFA directly with no graph at all: the
 * state IS a regular expression, and the construction terminates only because
 * a handful of similarity rules keep the set of derivatives finite.
 *
 * State elimination goes the other way, which is Kleene's theorem made
 * executable: any automaton has a regular expression, and the one you get
 * depends on the order you eliminate states in.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.RegexCompile = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('../machines/automaton.js');

  /* ------------------------------------------------------------- parsing */

  /**
   * A recursive-descent parser for the regular fragment only: literals,
   * concatenation, `|`, `*`, `+`, `?`, `.` and parentheses. There are no
   * backreferences and no lookaround, deliberately — those are the features
   * that stop a pattern being a regular expression at all.
   */
  function parse(pattern) {
    const state = { input: pattern, at: 0 };
    const tree = parseAlternation(state);

    if (state.at !== pattern.length) {
      throw new Error('regex-compile: unexpected "' + pattern[state.at] + '" at ' + state.at);
    }
    return tree;
  }

  function peek(state) {
    return state.at < state.input.length ? state.input[state.at] : null;
  }

  function parseAlternation(state) {
    let node = parseConcat(state);

    while (peek(state) === '|') {
      state.at += 1;
      node = { type: 'alt', left: node, right: parseConcat(state) };
    }
    return node;
  }

  function parseConcat(state) {
    let node = null;

    while (peek(state) !== null && peek(state) !== '|' && peek(state) !== ')') {
      const next = parseRepeat(state);

      node = node === null ? next : { type: 'concat', left: node, right: next };
    }
    return node === null ? { type: 'empty' } : node;
  }

  function parseRepeat(state) {
    let node = parseAtom(state);

    for (;;) {
      const symbol = peek(state);

      if (symbol === '*') node = { type: 'star', child: node };
      else if (symbol === '+') node = { type: 'plus', child: node };
      else if (symbol === '?') node = { type: 'opt', child: node };
      else return node;
      state.at += 1;
    }
  }

  function parseAtom(state) {
    const symbol = peek(state);

    if (symbol === '(') {
      state.at += 1;
      const inner = parseAlternation(state);

      if (peek(state) !== ')') throw new Error('regex-compile: unclosed group');
      state.at += 1;
      return inner;
    }
    if (symbol === '\\') {
      state.at += 2;
      return { type: 'literal', symbol: state.input[state.at - 1] };
    }
    state.at += 1;
    if (symbol === '.') return { type: 'any' };
    /* `ε` and `∅` are how this milestone prints the empty string and the empty
       language, so the parser has to read back what state elimination and the
       derivative construction write out. */
    if (symbol === 'ε') return { type: 'empty' };
    if (symbol === '∅') return { type: 'none' };
    return { type: 'literal', symbol: symbol };
  }

  /** Every literal the pattern mentions, which is the alphabet unless the
   *  caller supplies a wider one. */
  function alphabetOf(node, out) {
    const seen = out || {};

    if (!node) return Object.keys(seen).sort();
    if (node.type === 'literal') seen[node.symbol] = true;
    ['left', 'right', 'child'].forEach(function (key) {
      if (node[key]) alphabetOf(node[key], seen);
    });
    return Object.keys(seen).sort();
  }

  /* -------------------------------------------------- Thompson construction */

  /**
   * One fragment per operator, glued with ε-transitions. The state count is
   * the measurement the demo compares: two states per literal, two more per
   * star, and nothing is ever shared.
   */
  function thompson(pattern, alphabet) {
    const tree = parse(pattern);
    const symbols = alphabet || alphabetOf(tree);
    const builder = { next: 0, delta: {} };
    const fragment = buildFragment(builder, tree, symbols);

    return Automaton.create({
      states: Object.keys(builder.delta).sort(numericState),
      alphabet: symbols,
      start: fragment.start,
      accepting: [fragment.accept],
      delta: builder.delta,
      label: 'thompson(' + pattern + ')'
    });
  }

  function numericState(a, b) {
    return Number(a.slice(1)) - Number(b.slice(1));
  }

  function freshState(builder) {
    const name = 'n' + builder.next;

    builder.next += 1;
    builder.delta[name] = {};
    return name;
  }

  function link(builder, from, symbol, to) {
    if (!builder.delta[from][symbol]) builder.delta[from][symbol] = [];
    builder.delta[from][symbol].push(to);
  }

  function buildFragment(builder, node, alphabet) {
    if (node.type === 'alt') return altFragment(builder, node, alphabet);
    if (node.type === 'concat') return concatFragment(builder, node, alphabet);
    if (node.type === 'star') return starFragment(builder, node.child, alphabet);
    if (node.type === 'plus') return plusFragment(builder, node.child, alphabet);
    if (node.type === 'opt') return optFragment(builder, node.child, alphabet);
    return atomFragment(builder, node, alphabet);
  }

  function atomFragment(builder, node, alphabet) {
    const start = freshState(builder);
    const accept = freshState(builder);

    if (node.type === 'empty') link(builder, start, Automaton.EPSILON, accept);
    else if (node.type === 'any') {
      alphabet.forEach(function (symbol) { link(builder, start, symbol, accept); });
    } else if (node.type !== 'none') link(builder, start, node.symbol, accept);
    /* `none` gets a fragment with no edge at all: two states and no way from
       one to the other is exactly the empty language. */
    return { start: start, accept: accept };
  }

  function concatFragment(builder, node, alphabet) {
    const left = buildFragment(builder, node.left, alphabet);
    const right = buildFragment(builder, node.right, alphabet);

    link(builder, left.accept, Automaton.EPSILON, right.start);
    return { start: left.start, accept: right.accept };
  }

  function altFragment(builder, node, alphabet) {
    const start = freshState(builder);
    const accept = freshState(builder);
    const left = buildFragment(builder, node.left, alphabet);
    const right = buildFragment(builder, node.right, alphabet);

    link(builder, start, Automaton.EPSILON, left.start);
    link(builder, start, Automaton.EPSILON, right.start);
    link(builder, left.accept, Automaton.EPSILON, accept);
    link(builder, right.accept, Automaton.EPSILON, accept);
    return { start: start, accept: accept };
  }

  function starFragment(builder, child, alphabet) {
    const start = freshState(builder);
    const accept = freshState(builder);
    const inner = buildFragment(builder, child, alphabet);

    link(builder, start, Automaton.EPSILON, inner.start);
    link(builder, start, Automaton.EPSILON, accept);
    link(builder, inner.accept, Automaton.EPSILON, inner.start);
    link(builder, inner.accept, Automaton.EPSILON, accept);
    return { start: start, accept: accept };
  }

  function plusFragment(builder, child, alphabet) {
    const inner = buildFragment(builder, child, alphabet);
    const accept = freshState(builder);

    link(builder, inner.accept, Automaton.EPSILON, inner.start);
    link(builder, inner.accept, Automaton.EPSILON, accept);
    return { start: inner.start, accept: accept };
  }

  function optFragment(builder, child, alphabet) {
    const start = freshState(builder);
    const accept = freshState(builder);
    const inner = buildFragment(builder, child, alphabet);

    link(builder, start, Automaton.EPSILON, inner.start);
    link(builder, start, Automaton.EPSILON, accept);
    link(builder, inner.accept, Automaton.EPSILON, accept);
    return { start: start, accept: accept };
  }

  /* --------------------------------------------------- Glushkov construction */

  /**
   * Number every literal position, compute which positions a match can start
   * at, end at, and follow each other, and read the automaton straight off
   * those three sets. One state per position plus a start state, and no
   * ε-transitions at all.
   */
  function glushkov(pattern, alphabet) {
    const tree = parse(pattern);
    const symbols = alphabet || alphabetOf(tree);
    const marked = markPositions(tree, { next: 0, symbols: [] });
    const sets = positionSets(marked.node);
    const delta = { q0: {} };

    marked.symbols.forEach(function (ignored, i) { delta['p' + (i + 1)] = {}; });
    sets.first.forEach(function (position) {
      addEdge(delta, 'q0', marked.symbols[position - 1], 'p' + position);
    });
    Object.keys(sets.follow).forEach(function (from) {
      sets.follow[from].forEach(function (to) {
        addEdge(delta, 'p' + from, marked.symbols[to - 1], 'p' + to);
      });
    });
    return Automaton.create({
      states: ['q0'].concat(marked.symbols.map(function (ignored, i) { return 'p' + (i + 1); })),
      alphabet: symbols,
      start: 'q0',
      accepting: (sets.nullable ? ['q0'] : []).concat(sets.last.map(function (p) {
        return 'p' + p;
      })),
      delta: delta,
      label: 'glushkov(' + pattern + ')'
    });
  }

  function addEdge(delta, from, symbol, to) {
    if (!delta[from][symbol]) delta[from][symbol] = [];
    if (delta[from][symbol].indexOf(to) === -1) delta[from][symbol].push(to);
  }

  /** Replace each literal with its position number, recording the symbol. */
  function markPositions(node, state) {
    if (!node) return { node: node, symbols: state.symbols };
    if (node.type === 'literal' || node.type === 'any') {
      state.next += 1;
      state.symbols.push(node.type === 'any' ? '.' : node.symbol);
      return { node: { type: 'position', at: state.next, symbol: node.symbol },
        symbols: state.symbols };
    }
    const copy = { type: node.type };

    ['left', 'right', 'child'].forEach(function (key) {
      if (node[key]) copy[key] = markPositions(node[key], state).node;
    });
    return { node: copy, symbols: state.symbols };
  }

  function positionSets(node) {
    const follow = {};
    const computed = walkPositions(node, follow);

    return { nullable: computed.nullable, first: computed.first, last: computed.last,
      follow: follow };
  }

  function walkPositions(node, follow) {
    if (!node || node.type === 'empty') return { nullable: true, first: [], last: [] };
    if (node.type === 'position') {
      return { nullable: false, first: [node.at], last: [node.at] };
    }
    if (node.type === 'concat') return concatPositions(node, follow);
    if (node.type === 'alt') return altPositions(node, follow);
    return repeatPositions(node, follow);
  }

  function concatPositions(node, follow) {
    const left = walkPositions(node.left, follow);
    const right = walkPositions(node.right, follow);

    left.last.forEach(function (from) { addFollow(follow, from, right.first); });
    return {
      nullable: left.nullable && right.nullable,
      first: left.nullable ? left.first.concat(right.first) : left.first,
      last: right.nullable ? right.last.concat(left.last) : right.last
    };
  }

  function altPositions(node, follow) {
    const left = walkPositions(node.left, follow);
    const right = walkPositions(node.right, follow);

    return { nullable: left.nullable || right.nullable,
      first: left.first.concat(right.first), last: left.last.concat(right.last) };
  }

  function repeatPositions(node, follow) {
    const inner = walkPositions(node.child, follow);

    if (node.type !== 'opt') {
      inner.last.forEach(function (from) { addFollow(follow, from, inner.first); });
    }
    return { nullable: node.type !== 'plus' || inner.nullable,
      first: inner.first, last: inner.last };
  }

  function addFollow(follow, from, positions) {
    if (!follow[from]) follow[from] = [];
    positions.forEach(function (to) {
      if (follow[from].indexOf(to) === -1) follow[from].push(to);
    });
  }

  /* ---------------------------------------------- Kleene: automaton to regex */

  /**
   * State elimination. Add a fresh start and accept, label every edge with a
   * regular expression, then remove the interior states one at a time, routing
   * each one's incoming and outgoing labels around it through its own loop.
   * What is left on the single remaining edge is the language.
   *
   * The expression you get depends on the ELIMINATION ORDER — every order is
   * correct and they differ wildly in size — so the order is a parameter and
   * the step log records what each removal cost. Eliminating the
   * highest-degree state last is the usual heuristic.
   */
  function toRegex(machine, order) {
    const edges = seedEdges(machine);
    const interior = (order || machine.states.slice()).filter(function (state) {
      return machine.states.indexOf(state) !== -1;
    });
    const steps = [];

    interior.forEach(function (state) {
      eliminate(edges, state);
      steps.push({ removed: state, edges: countEdges(edges),
        size: (edges.START && edges.START.ACCEPT ? edges.START.ACCEPT.length : 0) });
    });
    const result = edges.START && edges.START.ACCEPT ? edges.START.ACCEPT : null;

    return { pattern: result === null ? '∅' : result, steps: steps,
      order: interior.slice() };
  }

  function seedEdges(machine) {
    const edges = { START: {} };

    machine.states.forEach(function (state) { edges[state] = {}; });
    edges.ACCEPT = {};
    machine.start.forEach(function (state) { edges.START[state] = 'ε'; });
    machine.accepting.forEach(function (state) { edges[state].ACCEPT = 'ε'; });
    machine.states.forEach(function (from) {
      const row = machine.delta[from] || {};

      Object.keys(row).forEach(function (symbol) {
        row[symbol].forEach(function (to) {
          const label = symbol === Automaton.EPSILON ? 'ε' : symbol;

          edges[from][to] = edges[from][to] ? edges[from][to] + '|' + label : label;
        });
      });
    });
    return edges;
  }

  function eliminate(edges, state) {
    const loop = edges[state][state] ? star(edges[state][state]) : '';
    const incoming = Object.keys(edges).filter(function (from) {
      return from !== state && edges[from][state];
    });
    const outgoing = Object.keys(edges[state]).filter(function (to) { return to !== state; });

    incoming.forEach(function (from) {
      outgoing.forEach(function (to) {
        const route = join([edges[from][state], loop, edges[state][to]]);

        edges[from][to] = edges[from][to] ? edges[from][to] + '|' + route : route;
      });
      delete edges[from][state];
    });
    delete edges[state];
  }

  function star(label) {
    if (label === 'ε' || label === '') return '';
    return label.length === 1 ? label + '*' : '(' + label + ')*';
  }

  function join(parts) {
    const kept = parts.filter(function (part) { return part && part !== 'ε'; })
      .map(function (part) {
        return part.indexOf('|') === -1 ? part : '(' + part + ')';
      });

    return kept.length === 0 ? 'ε' : kept.join('');
  }

  function countEdges(edges) {
    return Object.keys(edges).reduce(function (total, from) {
      return total + Object.keys(edges[from]).length;
    }, 0);
  }

  return {
    parse: parse, alphabetOf: alphabetOf,
    thompson: thompson, glushkov: glushkov,
    positionSets: positionSets, markPositions: markPositions,
    toRegex: toRegex, star: star, join: join
  };
}));
