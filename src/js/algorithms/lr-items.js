/**
 * LR item sets: the automaton every bottom-up parser is driven by.
 *
 * An item is a production with a dot in it — `A → α • β` — and it means "we
 * are parsing an A, we have seen α, and β is still to come". A STATE is a set
 * of such items, and the automaton over those sets is what the parser walks
 * while shifting: the stack holds states, and a reduce happens when a state
 * contains an item with the dot at the end.
 *
 * Four flavours share this construction and differ only in what lookahead they
 * attach:
 *
 *   - LR(0): no lookahead; reduce on everything, which conflicts constantly.
 *   - SLR(1): reduce on FOLLOW(A); cheap, and too coarse for some grammars.
 *   - LR(1): a lookahead per item, computed during closure. Precise, and the
 *     state count explodes.
 *   - LALR(1): LR(1) states merged by core. The size of LR(0) with almost the
 *     precision of LR(1) — and the merge can introduce reduce/reduce conflicts
 *     that neither of the others has, which is the section's measurement.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LrItems = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');

  const AUGMENTED = "S'";

  /** Add a fresh start production `S' → S`, so accepting is a state rather
   *  than a special case in the parser loop. */
  function augment(grammar) {
    const productions = {};
    let start = AUGMENTED;

    while (grammar.nonterminals.indexOf(start) !== -1) start += "'";
    productions[start] = [[grammar.start]];
    grammar.nonterminals.forEach(function (name) {
      productions[name] = grammar.byLhs[name].map(function (rule) { return rule.rhs.slice(); });
    });
    return Grammar.create({ start: start, productions: productions,
      label: 'augmented ' + (grammar.label || '') });
  }

  function itemKey(item) {
    return item.rule.index + ':' + item.dot + (item.lookahead ? ':' + item.lookahead : '');
  }

  function coreKey(item) {
    return item.rule.index + ':' + item.dot;
  }

  function setKey(items, withLookahead) {
    return items.map(withLookahead ? itemKey : coreKey).sort()
      .filter(function (key, i, all) { return all.indexOf(key) === i; }).join('|');
  }

  function nextSymbol(item) {
    return item.dot < item.rule.rhs.length ? item.rule.rhs[item.dot] : null;
  }

  function show(item) {
    const parts = item.rule.rhs.slice();

    parts.splice(item.dot, 0, '•');
    return item.rule.lhs + ' → ' + (parts.length ? parts.join(' ') : '•') +
      (item.lookahead ? ', ' + item.lookahead : '');
  }

  /* --------------------------------------------------------------- closure */

  /**
   * Close a set of items: whenever the dot is before a nonterminal, add that
   * nonterminal's own productions with the dot at the start. For LR(1) the
   * lookahead of the added items is FIRST of whatever follows the nonterminal
   * in the current item, falling back to the current item's own lookahead when
   * that is nullable — which is the one line separating LR(1) from LR(0).
   */
  function closure(grammar, items, analysis) {
    const out = items.slice();
    const seen = {};

    out.forEach(function (item) { seen[itemKey(item)] = true; });
    for (let i = 0; i < out.length; i += 1) {
      const symbol = nextSymbol(out[i]);

      if (symbol === null || !Grammar.isNonterminal(grammar, symbol)) continue;
      lookaheadsFor(grammar, out[i], analysis).forEach(function (lookahead) {
        grammar.byLhs[symbol].forEach(function (rule) {
          const item = { rule: rule, dot: 0, lookahead: lookahead };

          if (seen[itemKey(item)]) return;
          seen[itemKey(item)] = true;
          out.push(item);
        });
      });
    }
    return out;
  }

  function lookaheadsFor(grammar, item, analysis) {
    if (!analysis) return [null];
    const rest = item.rule.rhs.slice(item.dot + 1);
    const head = Grammar.firstOfSequence(grammar, analysis, rest);
    const out = Object.keys(head.set);

    if (head.nullable && item.lookahead) out.push(item.lookahead);
    return out.length ? out : [item.lookahead || Grammar.END];
  }

  /** The state reached from a set by reading one symbol. */
  function goTo(grammar, items, symbol, analysis) {
    const moved = items.filter(function (item) { return nextSymbol(item) === symbol; })
      .map(function (item) {
        return { rule: item.rule, dot: item.dot + 1, lookahead: item.lookahead };
      });

    return moved.length ? closure(grammar, moved, analysis) : [];
  }

  /* ------------------------------------------------------ the collection */

  /**
   * Every reachable item set, and the transitions between them. `mode` is
   * 'lr0' (no lookahead, used by LR(0) and SLR) or 'lr1'.
   */
  function collection(grammar, mode) {
    const analysis = mode === 'lr1' ? Grammar.first(grammar) : null;
    const startItem = { rule: grammar.byLhs[grammar.start][0], dot: 0,
      lookahead: mode === 'lr1' ? Grammar.END : null };
    const first_ = closure(grammar, [startItem], analysis);
    const states = [first_];
    const index = {};
    const transitions = [];

    index[setKey(first_, mode === 'lr1')] = 0;
    for (let i = 0; i < states.length; i += 1) {
      symbolsAfterDot(grammar, states[i]).forEach(function (symbol) {
        const next = goTo(grammar, states[i], symbol, analysis);

        if (next.length === 0) return;
        const key = setKey(next, mode === 'lr1');

        if (index[key] === undefined) {
          index[key] = states.length;
          states.push(next);
        }
        transitions.push({ from: i, symbol: symbol, to: index[key] });
      });
    }
    return { states: states, transitions: transitions, grammar: grammar, mode: mode,
      analysis: analysis };
  }

  function symbolsAfterDot(grammar, items) {
    const seen = [];

    items.forEach(function (item) {
      const symbol = nextSymbol(item);

      if (symbol === null || seen.indexOf(symbol) !== -1) return;
      seen.push(symbol);
    });
    return seen;
  }

  /* ------------------------------------------------------------- LALR */

  /**
   * Merge LR(1) states whose CORES are equal, unioning their lookaheads.
   *
   * That is the whole of LALR, and it is why LALR has exactly as many states
   * as LR(0) — the cores are the LR(0) states. It is also where reduce/reduce
   * conflicts appear that neither LR(1) nor SLR has: two states that were
   * distinguishable only by lookahead become one, and their lookahead sets are
   * pooled.
   */
  function mergeByCore(built) {
    const groups = {};
    const order = [];

    built.states.forEach(function (items, i) {
      const key = setKey(items, false);

      if (groups[key] === undefined) { groups[key] = { members: [], index: order.length };
        order.push(key); }
      groups[key].members.push(i);
    });
    const states = order.map(function (key) { return unionOf(built, groups[key].members); });
    const mapping = {};

    order.forEach(function (key, i) {
      groups[key].members.forEach(function (member) { mapping[member] = i; });
    });
    return { states: states, transitions: remapTransitions(built, mapping),
      grammar: built.grammar, mode: 'lalr', analysis: built.analysis,
      merged: order.filter(function (key) { return groups[key].members.length > 1; }).length,
      mapping: mapping };
  }

  function unionOf(built, members) {
    const out = [];
    const seen = {};

    members.forEach(function (index) {
      built.states[index].forEach(function (item) {
        if (seen[itemKey(item)]) return;
        seen[itemKey(item)] = true;
        out.push(item);
      });
    });
    return out;
  }

  function remapTransitions(built, mapping) {
    const out = [];
    const seen = {};

    built.transitions.forEach(function (edge) {
      const key = mapping[edge.from] + ' ' + edge.symbol + ' ' + mapping[edge.to];

      if (seen[key]) return;
      seen[key] = true;
      out.push({ from: mapping[edge.from], symbol: edge.symbol, to: mapping[edge.to] });
    });
    return out;
  }

  /** The state graph as rows for the demo. */
  function stateRows(built) {
    return built.states.map(function (items, i) {
      return {
        state: i,
        items: items.map(show),
        kernel: items.filter(function (item) {
          return item.dot > 0 || item.rule.lhs === built.grammar.start;
        }).map(show),
        transitions: built.transitions.filter(function (edge) { return edge.from === i; })
          .map(function (edge) { return edge.symbol + ' → ' + edge.to; })
      };
    });
  }

  return {
    AUGMENTED: AUGMENTED, augment: augment, closure: closure, goTo: goTo,
    collection: collection, mergeByCore: mergeByCore, stateRows: stateRows,
    nextSymbol: nextSymbol, show: show, setKey: setKey, coreKey: coreKey,
    itemKey: itemKey, symbolsAfterDot: symbolsAfterDot
  };
}));
