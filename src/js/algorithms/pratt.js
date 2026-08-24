/**
 * Pratt parsing: precedence as data rather than as grammar structure.
 *
 * An expression grammar encodes precedence in its shape — one nonterminal per
 * level, `E → E + T`, `T → T * F`, `F → …` — so adding an operator means
 * adding a level and rewriting the rules around it. Pratt parsing puts the
 * precedence in a TABLE instead: each token carries a binding power, the
 * parser loops while the next operator binds tighter than the caller's limit,
 * and adding an operator is a one-line table change.
 *
 * That is why it dominates hand-written parsers. Clang, Roslyn, Go and V8 all
 * parse expressions this way, and the reason is not performance — it is that
 * the operator set is data the rest of the compiler can also read, and that a
 * new operator does not perturb the parse of the old ones.
 *
 * Associativity falls out of one asymmetry: a left-associative operator
 * recurses with a limit one higher than its own binding power, so an equal
 * operator to its right stops the loop; a right-associative one recurses with
 * its own power, so the equal operator continues.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Pratt = api;
}(this, function () {
  'use strict';

  /**
   * A table is `{ prefix, infix, postfix }` keyed by token. An infix entry is
   * `{ power, right }`, a prefix entry `{ power }`, and a postfix entry
   * `{ power }`. Everything about how the language parses lives here.
   */
  function table(config) {
    return {
      prefix: config.prefix || {},
      infix: config.infix || {},
      postfix: config.postfix || {},
      ternary: config.ternary || null,
      label: config.label || null
    };
  }

  /* ---------------------------------------------------------- the parser */

  function parse(spec, tokens) {
    const state = { spec: spec, tokens: tokens, at: 0, steps: 0 };
    const tree = expression(state, 0);

    return { tree: tree, consumed: state.at, complete: state.at === tokens.length,
      steps: state.steps, text: tree ? show(tree) : null };
  }

  /**
   * Parse an expression, stopping when the next operator binds no tighter than
   * `limit`. That one comparison is the whole algorithm.
   */
  function expression(state, limit) {
    state.steps += 1;
    let left = nud(state);

    if (left === null) return null;
    for (;;) {
      const token = state.tokens[state.at];

      if (token === undefined) return left;
      const next = led(state, token, left, limit);

      if (next === null) return left;
      left = next;
    }
  }

  /** The NULL denotation: what a token means with nothing to its left. */
  function nud(state) {
    const token = state.tokens[state.at];

    if (token === undefined) return null;
    const prefix = state.spec.prefix[token];

    if (prefix) {
      state.at += 1;
      const operand = expression(state, prefix.power);

      return operand === null ? null : { op: token, kind: 'prefix', children: [operand] };
    }
    if (token === '(') {
      state.at += 1;
      const inner = expression(state, 0);

      if (state.tokens[state.at] === ')') state.at += 1;
      return inner;
    }
    if (state.spec.infix[token] || state.spec.postfix[token] || token === ')') return null;
    state.at += 1;
    return { op: token, kind: 'atom', children: null };
  }

  /**
   * The LEFT denotation: what a token means with an expression to its left.
   * The asymmetry between left and right associativity is the `+ 1`.
   */
  function led(state, token, left, limit) {
    const postfix = state.spec.postfix[token];

    if (postfix && postfix.power > limit) {
      state.at += 1;
      return { op: token, kind: 'postfix', children: [left] };
    }
    if (state.spec.ternary && token === state.spec.ternary.question
      && state.spec.ternary.power > limit) {
      return ternary(state, left);
    }
    const infix = state.spec.infix[token];

    if (!infix || infix.power <= limit) return null;
    state.at += 1;
    const right = expression(state, infix.right ? infix.power - 1 : infix.power);

    return right === null ? null : { op: token, kind: 'infix', children: [left, right] };
  }

  /** `a ? b : c`, which is right-associative and spans two tokens. */
  function ternary(state, left) {
    const spec = state.spec.ternary;

    state.at += 1;
    const middle = expression(state, 0);

    if (state.tokens[state.at] === spec.colon) state.at += 1;
    const right = expression(state, spec.power - 1);

    return { op: spec.question, kind: 'ternary', children: [left, middle, right] };
  }

  /* -------------------------------------------------------------- output */

  /** Fully parenthesised, which is what a tree-shape assertion compares. */
  function show(tree) {
    if (!tree) return '';
    if (tree.kind === 'atom') return tree.op;
    if (tree.kind === 'prefix') return '(' + tree.op + ' ' + show(tree.children[0]) + ')';
    if (tree.kind === 'postfix') return '(' + show(tree.children[0]) + ' ' + tree.op + ')';
    if (tree.kind === 'ternary') {
      return '(' + show(tree.children[0]) + ' ? ' + show(tree.children[1]) + ' : ' +
        show(tree.children[2]) + ')';
    }
    return '(' + show(tree.children[0]) + ' ' + tree.op + ' ' + show(tree.children[1]) + ')';
  }

  function depth(tree) {
    if (!tree || !tree.children) return 1;
    return 1 + Math.max.apply(null, tree.children.map(depth));
  }

  /* ------------------------------------------------------- a real table */

  /** A C-like operator set, which is what the demo lets you edit. */
  function standard() {
    return table({
      prefix: { '-': { power: 90 }, '!': { power: 90 }, '~': { power: 90 } },
      infix: {
        '||': { power: 10, right: false },
        '&&': { power: 20, right: false },
        '==': { power: 30, right: false }, '!=': { power: 30, right: false },
        '<': { power: 40, right: false }, '>': { power: 40, right: false },
        '+': { power: 50, right: false }, '-': { power: 50, right: false },
        '*': { power: 60, right: false }, '/': { power: 60, right: false },
        '%': { power: 60, right: false },
        '^': { power: 80, right: true }
      },
      postfix: { '!': { power: 95 }, '++': { power: 95 } },
      ternary: { question: '?', colon: ':', power: 5 },
      label: 'C-like'
    });
  }

  /** The table as rows for the demo, sorted by binding power. */
  function tableRows(spec) {
    const rows = [];

    Object.keys(spec.prefix).forEach(function (token) {
      rows.push({ token: token, position: 'prefix', power: spec.prefix[token].power,
        associativity: 'right, by construction' });
    });
    Object.keys(spec.infix).forEach(function (token) {
      rows.push({ token: token, position: 'infix', power: spec.infix[token].power,
        associativity: spec.infix[token].right ? 'right' : 'left' });
    });
    Object.keys(spec.postfix).forEach(function (token) {
      rows.push({ token: token, position: 'postfix', power: spec.postfix[token].power,
        associativity: 'left, by construction' });
    });
    if (spec.ternary) {
      rows.push({ token: spec.ternary.question, position: 'ternary',
        power: spec.ternary.power, associativity: 'right' });
    }
    return rows.sort(function (a, b) { return b.power - a.power; });
  }

  /** Split an expression into tokens: the multi-character operators first, so
   *  `&&` does not come back as two `&`. */
  function tokenise(text) {
    const operators = ['&&', '||', '==', '!=', '++', '+', '-', '*', '/', '%', '^', '<', '>',
      '!', '~', '(', ')', '?', ':'];
    const out = [];
    let at = 0;

    while (at < text.length) {
      if (text[at] === ' ') { at += 1; continue; }
      const operator = operators.filter(function (candidate) {
        return text.slice(at, at + candidate.length) === candidate;
      })[0];

      if (operator) { out.push(operator); at += operator.length; continue; }
      let length = 0;

      while (at + length < text.length && /[A-Za-z0-9_]/.test(text[at + length])) length += 1;
      if (length === 0) { at += 1; continue; }
      out.push(text.slice(at, at + length));
      at += length;
    }
    return out;
  }

  return {
    table: table, parse: parse, show: show, depth: depth, standard: standard,
    tableRows: tableRows, tokenise: tokenise, expression: expression
  };
}));
