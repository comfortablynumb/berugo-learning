/**
 * Brzozowski derivatives: a DFA built with no graph at all.
 *
 * The derivative of a pattern with respect to a symbol is the pattern matching
 * whatever must follow that symbol. Take derivatives until the set stops
 * growing and you have a deterministic automaton whose STATE IS A REGULAR
 * EXPRESSION — no ε-transitions, no subset construction, no separate
 * minimisation pass to reach something close to minimal.
 *
 * Termination depends entirely on `simplify`. Without it the derivatives of
 * `a*` grow forever as `a*`, `ε·a*`, `ε·(ε·a*)` and so on, all denoting the
 * same language and none of them equal as trees, so the worklist never
 * empties. Brzozowski's similarity rules — associativity, commutativity and
 * idempotence of alternation, plus the identities for ∅ and ε — are the
 * minimum that makes the set finite, and they are why this construction is
 * usually described as "obvious and then subtle".
 *
 * Split out of `regex-compile.js` because the two together crossed the file
 * budget; the parser is shared through `RegexCompile.parse`.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Derivatives = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('../machines/automaton.js');
  const Regex = root && root.RegexCompile ? root.RegexCompile
    : require('./regex-compile.js');

  const NONE = { type: 'none' };
  const EMPTY = { type: 'empty' };
  const LIMIT = 4096;

  /* ------------------------------------------------------------- nullable */

  /** Does the pattern match the empty string? */
  function nullable(node) {
    if (!node || node.type === 'empty') return true;
    if (node.type === 'none' || node.type === 'literal' || node.type === 'any') return false;
    if (node.type === 'star' || node.type === 'opt') return true;
    if (node.type === 'plus') return nullable(node.child);
    if (node.type === 'alt') return nullable(node.left) || nullable(node.right);
    return nullable(node.left) && nullable(node.right);
  }

  /* ---------------------------------------------------------- derivation */

  function derive(node, symbol) {
    if (!node || node.type === 'empty' || node.type === 'none') return NONE;
    if (node.type === 'any') return EMPTY;
    if (node.type === 'literal') return node.symbol === symbol ? EMPTY : NONE;
    if (node.type === 'alt') {
      return { type: 'alt', left: derive(node.left, symbol),
        right: derive(node.right, symbol) };
    }
    if (node.type === 'star') {
      return { type: 'concat', left: derive(node.child, symbol), right: node };
    }
    if (node.type === 'plus') {
      return { type: 'concat', left: derive(node.child, symbol),
        right: { type: 'star', child: node.child } };
    }
    if (node.type === 'opt') return derive(node.child, symbol);
    return deriveConcat(node, symbol);
  }

  /** For a concatenation the symbol may be consumed by the left side, or — if
   *  the left side can vanish — by the right. */
  function deriveConcat(node, symbol) {
    const head = { type: 'concat', left: derive(node.left, symbol), right: node.right };

    if (!nullable(node.left)) return head;
    return { type: 'alt', left: head, right: derive(node.right, symbol) };
  }

  /* -------------------------------------------------------- similarity */

  function simplify(node) {
    if (!node) return NONE;
    if (node.type === 'literal' || node.type === 'any'
      || node.type === 'empty' || node.type === 'none') return node;
    if (node.type === 'alt') return simplifyAlt(node);
    if (node.type === 'concat') return simplifyConcat(node);
    return simplifyRepeat(node);
  }

  function simplifyRepeat(node) {
    const child = simplify(node.child);

    if (node.type === 'opt') {
      if (child.type === 'none' || child.type === 'empty') return EMPTY;
      return { type: 'opt', child: child };
    }
    if (child.type === 'none') return node.type === 'star' ? EMPTY : NONE;
    if (child.type === 'empty') return EMPTY;
    if (child.type === 'star') return child;
    return { type: node.type, child: child };
  }

  /** Alternation is flattened, ∅ dropped, duplicates removed and the branches
   *  sorted — associativity, commutativity and idempotence in one pass. */
  function simplifyAlt(node) {
    const parts = [];

    flattenAlt(simplify(node.left), parts);
    flattenAlt(simplify(node.right), parts);
    const kept = [];
    const seen = {};

    parts.forEach(function (part) {
      const key = show(part);

      if (part.type === 'none' || seen[key]) return;
      seen[key] = true;
      kept.push(part);
    });
    if (kept.length === 0) return NONE;
    kept.sort(function (a, b) { return show(a) < show(b) ? -1 : 1; });
    return kept.reduce(function (left, right) {
      return { type: 'alt', left: left, right: right };
    });
  }

  function flattenAlt(node, out) {
    if (node.type !== 'alt') { out.push(node); return; }
    flattenAlt(node.left, out);
    flattenAlt(node.right, out);
  }

  function simplifyConcat(node) {
    const left = simplify(node.left);
    const right = simplify(node.right);

    if (left.type === 'none' || right.type === 'none') return NONE;
    if (left.type === 'empty') return right;
    if (right.type === 'empty') return left;
    return { type: 'concat', left: left, right: right };
  }

  /* ------------------------------------------------------------ printing */

  /** A canonical string for a derivative: both its state name in the DFA and
   *  the key that decides whether two derivatives are the same state. */
  function show(node) {
    if (!node || node.type === 'none') return '∅';
    if (node.type === 'empty') return 'ε';
    if (node.type === 'any') return '.';
    if (node.type === 'literal') return node.symbol;
    if (node.type === 'star') return group(node.child) + '*';
    if (node.type === 'plus') return group(node.child) + '+';
    if (node.type === 'opt') return group(node.child) + '?';
    if (node.type === 'alt') return show(node.left) + '|' + show(node.right);
    return group(node.left) + group(node.right);
  }

  function group(node) {
    const text = show(node);
    const atomic = node.type === 'literal' || node.type === 'any'
      || node.type === 'empty' || node.type === 'none'
      || node.type === 'star' || node.type === 'plus' || node.type === 'opt';

    return atomic ? text : '(' + text + ')';
  }

  /* --------------------------------------------------------- the machine */

  /**
   * Build the DFA. `steps` records each derivative taken so a demo can show
   * the construction growing, and `truncated` says so honestly if the
   * simplification rules were not enough to close the set.
   */
  function build(pattern, alphabet) {
    const tree = simplify(Regex.parse(pattern));
    const symbols = alphabet || Regex.alphabetOf(tree);
    const seen = {};
    const order = [tree];
    const queue = [tree];
    const steps = [];
    const delta = {};

    seen[show(tree)] = true;
    while (queue.length && order.length < LIMIT) {
      expand({ node: queue.shift(), symbols: symbols, seen: seen, order: order,
        queue: queue, steps: steps, delta: delta });
    }
    return assemble({ order: order, delta: delta, symbols: symbols, steps: steps,
      pattern: pattern, truncated: queue.length > 0 });
  }

  function expand(state) {
    const name = show(state.node);

    state.delta[name] = {};
    state.symbols.forEach(function (symbol) {
      const next = simplify(derive(state.node, symbol));
      const key = show(next);
      const fresh = !state.seen[key];

      if (fresh) {
        state.seen[key] = true;
        state.order.push(next);
        state.queue.push(next);
      }
      state.delta[name][symbol] = [key];
      state.steps.push({ from: name, symbol: symbol, to: key, fresh: fresh,
        nullable: nullable(next) });
    });
  }

  function assemble(config) {
    return {
      dfa: Automaton.create({
        states: config.order.map(show),
        alphabet: config.symbols,
        start: show(config.order[0]),
        accepting: config.order.filter(nullable).map(show),
        delta: config.delta,
        label: 'derivatives(' + config.pattern + ')'
      }),
      steps: config.steps,
      truncated: config.truncated,
      derivatives: config.order.map(function (node) {
        return { name: show(node), nullable: nullable(node) };
      })
    };
  }

  return {
    build: build, derive: derive, simplify: simplify, nullable: nullable, show: show,
    NONE: NONE, EMPTY: EMPTY, LIMIT: LIMIT
  };
}));
