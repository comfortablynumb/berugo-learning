/**
 * LR parse tables, the four flavours, and conflict reports worth reading.
 *
 * ACTION says what to do on a terminal: shift and go to a state, reduce by a
 * production, or accept. GOTO says which state to move to after a reduction
 * exposes a nonterminal. Both are read off the item-set automaton, and the
 * only difference between LR(0), SLR, LALR and canonical LR(1) is WHICH
 * lookaheads a reduce action is entered under.
 *
 * A conflict is a cell wanting two actions, and the report names the state,
 * both competing actions, and the items responsible. "Shift/reduce conflict"
 * on its own tells you nothing; "state 9 wants to shift `else` and also reduce
 * `S → i E t S`, from these two items" tells you it is the dangling else and
 * that shifting is the behaviour you want. Generators default to shift and
 * print a count, which is how grammars rot: the default is usually right and
 * nobody ever finds out which conflicts were not.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LrParser = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');
  const Items = root && root.LrItems ? root.LrItems : require('./lr-items.js');

  const MODES = ['lr0', 'slr', 'lalr', 'lr1'];

  /**
   * Build the automaton and the tables for one flavour. The grammar is
   * augmented here, so a caller passes the grammar they wrote.
   */
  function build(grammar, mode) {
    const augmented = Items.augment(grammar);
    const collection = mode === 'lr0' || mode === 'slr'
      ? Items.collection(augmented, 'lr0')
      : Items.collection(augmented, 'lr1');
    const built = mode === 'lalr' ? Items.mergeByCore(collection) : collection;
    const follows = mode === 'slr' ? Grammar.follow(augmented) : null;
    const tables = fill({ built: built, mode: mode, follows: follows, augmented: augmented });

    return {
      mode: mode, grammar: grammar, augmented: augmented, collection: built,
      action: tables.action, goTo: tables.goTo, conflicts: tables.conflicts,
      states: built.states.length,
      canonicalStates: collection.states.length,
      merged: built.merged === undefined ? 0 : built.merged
    };
  }

  function fill(config) {
    const action = [];
    const goTo = [];
    const conflicts = [];

    config.built.states.forEach(function (items, state) {
      action.push({});
      goTo.push({});
    });
    config.built.transitions.forEach(function (edge) {
      if (Grammar.isNonterminal(config.augmented, edge.symbol)) {
        goTo[edge.from][edge.symbol] = edge.to;
        return;
      }
      place(action, conflicts, config, edge.from, edge.symbol,
        { kind: 'shift', target: edge.to });
    });
    config.built.states.forEach(function (items, state) {
      items.forEach(function (item) {
        if (Items.nextSymbol(item) !== null) return;
        reduceEntries(config, item).forEach(function (terminal) {
          place(action, conflicts, config, state, terminal, actionFor(config, item));
        });
      });
    });
    return { action: action, goTo: goTo, conflicts: conflicts };
  }

  function actionFor(config, item) {
    if (item.rule.lhs === config.augmented.start) return { kind: 'accept' };
    return { kind: 'reduce', rule: item.rule };
  }

  /** Which lookaheads a reduce is entered under — the only thing separating
   *  the four flavours. */
  function reduceEntries(config, item) {
    if (item.rule.lhs === config.augmented.start) return [Grammar.END];
    if (config.mode === 'lr0') {
      return config.augmented.terminals.concat([Grammar.END]);
    }
    if (config.mode === 'slr') return Object.keys(config.follows[item.rule.lhs]);
    return [item.lookahead === null ? Grammar.END : item.lookahead];
  }

  function place(action, conflicts, config, state, terminal, entry) {
    const existing = action[state][terminal];

    if (existing && !sameAction(existing, entry)) {
      conflicts.push(describe(config, state, terminal, existing, entry));
      /* Generators default to shift, and so does this one — the point is that
         the conflict is REPORTED rather than silently resolved. */
      if (entry.kind === 'shift') action[state][terminal] = entry;
      return;
    }
    action[state][terminal] = entry;
  }

  function sameAction(a, b) {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'shift') return a.target === b.target;
    if (a.kind === 'reduce') return a.rule.index === b.rule.index;
    return true;
  }

  function describe(config, state, terminal, first, second) {
    const kinds = [first.kind, second.kind].sort().join('/');
    const items = config.built.states[state].filter(function (item) {
      return Items.nextSymbol(item) === terminal || Items.nextSymbol(item) === null;
    }).map(Items.show);

    return {
      state: state, terminal: terminal,
      kind: kinds === 'reduce/shift' ? 'shift/reduce' : kinds,
      first: text(first), second: text(second),
      /* The actions themselves, not only their prose: GLR reads them back to
         take the branch this table threw away. */
      firstAction: first, secondAction: second,
      items: items,
      resolved: second.kind === 'shift' || first.kind === 'shift' ? 'shift' : 'the earlier rule'
    };
  }

  function text(entry) {
    if (entry.kind === 'shift') return 'shift to state ' + entry.target;
    if (entry.kind === 'accept') return 'accept';
    return 'reduce by ' + entry.rule.lhs + ' → ' + (entry.rule.rhs.join(' ') || 'ε');
  }

  /* --------------------------------------------------------- the parser */

  /**
   * The shift-reduce loop, with every step recorded. The stack holds states
   * and the symbols between them, which is what makes the trace readable —
   * a stack of bare state numbers is correct and unreadable.
   */
  function parse(built, tokens) {
    const input = tokens.concat([Grammar.END]);
    const stack = [{ state: 0, symbol: null }];
    const steps = [];
    let at = 0;

    while (steps.length < 4000) {
      const state = stack[stack.length - 1].state;
      const lookahead = input[at];
      const entry = built.action[state][lookahead];

      if (!entry) {
        steps.push(step(stack, input, at, 'error: no action for ' + lookahead));
        return { accepted: false, steps: steps, consumed: at,
          expected: Object.keys(built.action[state]).sort() };
      }
      if (entry.kind === 'accept') {
        steps.push(step(stack, input, at, 'accept'));
        return { accepted: true, steps: steps, consumed: at, expected: [] };
      }
      if (entry.kind === 'shift') {
        steps.push(step(stack, input, at, 'shift ' + lookahead + ' → state ' + entry.target));
        stack.push({ state: entry.target, symbol: lookahead });
        at += 1;
        continue;
      }
      if (!applyReduce(built, stack, entry, steps, input, at)) {
        return { accepted: false, steps: steps, consumed: at, expected: [] };
      }
    }
    return { accepted: false, steps: steps, consumed: at, expected: [] };
  }

  function applyReduce(built, stack, entry, steps, input, at) {
    steps.push(step(stack, input, at,
      'reduce by ' + entry.rule.lhs + ' → ' + (entry.rule.rhs.join(' ') || 'ε')));
    for (let i = 0; i < entry.rule.rhs.length; i += 1) stack.pop();
    const target = built.goTo[stack[stack.length - 1].state][entry.rule.lhs];

    if (target === undefined) {
      steps.push(step(stack, input, at, 'error: no goto for ' + entry.rule.lhs));
      return false;
    }
    stack.push({ state: target, symbol: entry.rule.lhs });
    return true;
  }

  function step(stack, input, at, action) {
    return {
      stack: stack.map(function (entry) {
        return entry.symbol === null ? String(entry.state) : entry.symbol + entry.state;
      }).join(' '),
      remaining: input.slice(at).join(' '),
      action: action
    };
  }

  function accepts(built, tokens) {
    return parse(built, tokens).accepted;
  }

  /* -------------------------------------------------------- comparisons */

  /**
   * All four flavours on one grammar, which is the demo's table: state counts,
   * conflict counts, and what LALR's merge cost. The interesting row is the
   * grammar that is LR(1) and not LALR(1) — the merge introduces a
   * reduce/reduce conflict that neither neighbour has.
   */
  function compare(grammar) {
    return MODES.map(function (mode) {
      const built = build(grammar, mode);
      const byKind = {};

      built.conflicts.forEach(function (conflict) {
        byKind[conflict.kind] = (byKind[conflict.kind] || 0) + 1;
      });
      return { mode: mode, states: built.states, conflicts: built.conflicts.length,
        shiftReduce: byKind['shift/reduce'] || 0,
        reduceReduce: byKind['reduce/reduce'] || 0,
        merged: built.merged, canonicalStates: built.canonicalStates };
    });
  }

  /** The ACTION and GOTO tables as rows for the demo. */
  function tableRows(built) {
    const terminals = built.augmented.terminals.concat([Grammar.END]);

    return built.action.map(function (row, state) {
      return {
        state: state,
        actions: terminals.filter(function (t) { return row[t]; })
          .map(function (t) { return t + ': ' + text(row[t]); }),
        gotos: Object.keys(built.goTo[state]).sort().map(function (name) {
          return name + ' → ' + built.goTo[state][name];
        }),
        conflicts: built.conflicts.filter(function (c) { return c.state === state; }).length
      };
    });
  }

  return {
    MODES: MODES, build: build, parse: parse, accepts: accepts,
    compare: compare, tableRows: tableRows, text: text
  };
}));
