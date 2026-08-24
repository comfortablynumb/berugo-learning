/**
 * Earley parsing: the reference every other parser in M25 is checked against.
 *
 * It accepts ANY context-free grammar — left-recursive, ambiguous, ε-ridden,
 * with no massaging at all — which is why it is the right oracle. Every other
 * parser here needs the grammar in some shape, and a bug in the transformation
 * that gets it there is invisible unless something that needed no
 * transformation agrees.
 *
 * The chart is one column per input position holding items `A → α • β` with the
 * position where that item started. Three operations fill it: PREDICT adds the
 * items for a nonterminal about to be parsed, SCAN advances items whose next
 * symbol matches the input, and COMPLETE advances items that were waiting on a
 * nonterminal that has just finished.
 *
 * The ε-rule case is the one that breaks naive implementations. A nullable
 * nonterminal can complete in the same column it was predicted in, so a
 * completion may need to revisit items added earlier in the SAME column — and
 * a loop written as a plain `for` over a snapshot misses them. The loop below
 * re-reads `column.length` every iteration for exactly that reason, and the
 * test suite includes the fixture that catches it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Earley = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');

  function itemKey(item) {
    return item.rule.index + ':' + item.dot + ':' + item.origin;
  }

  function nextSymbol(item) {
    return item.dot < item.rule.rhs.length ? item.rule.rhs[item.dot] : null;
  }

  /* --------------------------------------------------------------- the chart */

  /**
   * Recognise, and keep the chart. `tokens` is an array of terminal symbols —
   * the lexer's output, not raw characters, because a grammar's terminals are
   * token types.
   */
  function parse(grammar, tokens) {
    const columns = [];
    const seen = [];

    for (let i = 0; i <= tokens.length; i += 1) { columns.push([]); seen.push({}); }
    grammar.byLhs[grammar.start].forEach(function (rule) {
      add(columns, seen, 0, { rule: rule, dot: 0, origin: 0, from: null });
    });
    const empty = Grammar.nullable(grammar);

    for (let i = 0; i <= tokens.length; i += 1) {
      fillColumn({ grammar: grammar, columns: columns, seen: seen, tokens: tokens,
        nullable: empty, at: i });
    }
    return finish(grammar, tokens, columns);
  }

  function add(columns, seen, at, item) {
    const key = itemKey(item);

    if (seen[at][key]) {
      /* The same item reached two ways is an ambiguity: keep both derivations
         so the forest can be unfolded later. */
      seen[at][key].from.push(item.from);
      return false;
    }
    const stored = { rule: item.rule, dot: item.dot, origin: item.origin,
      from: [item.from] };

    seen[at][key] = stored;
    columns[at].push(stored);
    return true;
  }

  /**
   * One column, to a fixed point. The loop re-reads `length` because COMPLETE
   * can append to the column it is scanning — which is how a nullable
   * nonterminal completes in the column it was predicted in.
   */
  function fillColumn(state) {
    const column = state.columns[state.at];

    for (let i = 0; i < column.length; i += 1) {
      const item = column[i];
      const symbol = nextSymbol(item);

      if (symbol === null) { complete(state, item); continue; }
      if (Grammar.isNonterminal(state.grammar, symbol)) { predict(state, item, symbol); continue; }
      scan(state, item, symbol);
    }
  }

  /**
   * Predict, with the Aycock–Horspool fix for nullable nonterminals.
   *
   * If the predicted nonterminal can derive the empty string, advance the
   * predicting item straight away rather than relying on a completion to do
   * it. Without this line, a nullable nonterminal completes in the column it
   * was predicted in, and any item added to that column AFTER the completion
   * never gets advanced — so `S → A A A A` with `A → a | ε` rejects the empty
   * string and accepts "aa", which is exactly the wrong half of its language.
   */
  function predict(state, item, symbol) {
    state.grammar.byLhs[symbol].forEach(function (rule) {
      add(state.columns, state.seen, state.at,
        { rule: rule, dot: 0, origin: state.at, from: null });
    });
    if (!state.nullable[symbol]) return;
    add(state.columns, state.seen, state.at,
      { rule: item.rule, dot: item.dot + 1, origin: item.origin,
        from: { item: item, child: Grammar.node(symbol, []), at: state.at } });
  }

  function scan(state, item, symbol) {
    if (state.tokens[state.at] !== symbol) return;
    add(state.columns, state.seen, state.at + 1,
      { rule: item.rule, dot: item.dot + 1, origin: item.origin,
        from: { item: item, child: { symbol: symbol, children: null }, at: state.at } });
  }

  function complete(state, item) {
    state.columns[item.origin].forEach(function (waiting) {
      if (nextSymbol(waiting) !== item.rule.lhs) return;
      add(state.columns, state.seen, state.at,
        { rule: waiting.rule, dot: waiting.dot + 1, origin: waiting.origin,
          from: { item: waiting, child: item, at: state.at } });
    });
  }

  function finish(grammar, tokens, columns) {
    const roots = columns[tokens.length].filter(function (item) {
      return item.rule.lhs === grammar.start && item.origin === 0
        && item.dot === item.rule.rhs.length;
    });

    return { accepted: roots.length > 0, columns: columns, roots: roots,
      tokens: tokens.slice(), grammar: grammar,
      items: columns.reduce(function (total, column) { return total + column.length; }, 0) };
  }

  function accepts(grammar, tokens) {
    return parse(grammar, tokens).accepted;
  }

  /* ------------------------------------------------------------- the forest */

  /**
   * Unfold the completed items back into parse trees. An item reached two
   * different ways is an ambiguity, and this walks every combination — bounded
   * by `limit`, because an ambiguous grammar can have exponentially many trees
   * and the demo only ever shows a handful.
   */
  function trees(result, limit) {
    const cap = limit === undefined ? 32 : limit;
    const out = [];
    const seen = {};

    result.roots.forEach(function (root_) {
      buildFrom(root_, cap).forEach(function (children) {
        const tree = Grammar.node(root_.rule.lhs, children);
        const key = Grammar.shape(tree);

        if (seen[key] || out.length >= cap) return;
        seen[key] = true;
        out.push(tree);
      });
    });
    return out;
  }

  /**
   * Every child list for a completed item, following the derivation links
   * backwards to the start of the rule.
   *
   * `visiting` is the cycle guard and it is not optional: a grammar with a
   * nullable cycle — `S → S S | a | ε` is the smallest — has derivations that
   * refer to themselves, so an unguarded walk recurses until the stack runs
   * out. Refusing to re-enter an item already on the path drops the infinite
   * families and keeps every finite tree, which is the honest answer: an
   * infinitely ambiguous grammar has no finite list of parses to show.
   */
  function buildFrom(item, cap, visiting) {
    if (item.dot === 0) return [[]];
    const guard = visiting || new Set();

    if (guard.has(item)) return [];
    guard.add(item);
    const out = [];

    item.from.forEach(function (link) {
      if (link === null || out.length >= cap) return;
      combine(buildFrom(link.item, cap, guard), tailsOf(link.child, cap, guard), out, cap);
    });
    guard.delete(item);
    return out.length ? out : (item.dot === 0 ? [[]] : []);
  }

  function combine(heads, tails, out, cap) {
    heads.forEach(function (head) {
      tails.forEach(function (tail) {
        if (out.length >= cap) return;
        out.push(head.concat([tail]));
      });
    });
  }

  function tailsOf(child, cap, visiting) {
    if (!child.rule) return [child];
    return buildFrom(child, cap, visiting).map(function (children) {
      return Grammar.node(child.rule.lhs, children);
    });
  }

  /** How many distinct parse trees, up to the cap — the ambiguity measure. */
  function ambiguity(grammar, tokens, limit) {
    return trees(parse(grammar, tokens), limit).length;
  }

  /* --------------------------------------------------------------- reporting */

  /** The chart as rows, for the demo: one entry per item with the operation
   *  that produced it. */
  function chartRows(result, column) {
    return (result.columns[column] || []).map(function (item) {
      return {
        rule: item.rule.lhs + ' → ' + dotted(item),
        origin: item.origin,
        operation: item.dot === 0 ? 'predict'
          : (item.rule.rhs[item.dot - 1] !== undefined
            && !Grammar.isNonterminal(result.grammar, item.rule.rhs[item.dot - 1])
            ? 'scan' : 'complete'),
        complete: item.dot === item.rule.rhs.length,
        derivations: item.from.filter(function (link) { return link !== null; }).length
      };
    });
  }

  function dotted(item) {
    const parts = item.rule.rhs.slice();

    parts.splice(item.dot, 0, '•');
    return parts.length ? parts.join(' ') : '•';
  }

  /** Where the parse died: the last column that got any item at all. */
  function failurePoint(result) {
    for (let i = result.columns.length - 1; i >= 0; i -= 1) {
      if (result.columns[i].length > 0) {
        return { at: i, token: result.tokens[i] === undefined ? null : result.tokens[i],
          expected: expectedAt(result, i) };
      }
    }
    return { at: 0, token: result.tokens[0] || null, expected: [] };
  }

  /** The terminals that could have continued the parse at a position — the
   *  raw material of a useful error message. */
  function expectedAt(result, at) {
    const seen = {};

    (result.columns[at] || []).forEach(function (item) {
      const symbol = nextSymbol(item);

      if (symbol === null || Grammar.isNonterminal(result.grammar, symbol)) return;
      seen[symbol] = true;
    });
    return Object.keys(seen).sort();
  }

  return {
    parse: parse, accepts: accepts, trees: trees, ambiguity: ambiguity,
    chartRows: chartRows, dotted: dotted, failurePoint: failurePoint,
    expectedAt: expectedAt, nextSymbol: nextSymbol
  };
}));
