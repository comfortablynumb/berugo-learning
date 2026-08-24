/**
 * GLR: LR parsing that forks instead of failing, and a shared packed parse
 * forest so the forks stay affordable.
 *
 * An LR table with a conflict is not a broken table — it is a table that
 * describes two possible parses. A deterministic parser must pick one (and
 * bison picks shift, silently). A GLR parser takes BOTH: the stack becomes a
 * graph — the graph-structured stack, or GSS — whose branches share their
 * common prefix, so forking is cheap and merging back is automatic when two
 * branches reach the same state at the same input position.
 *
 * The output is not a tree, because an ambiguous input has several. It is a
 * shared packed parse forest: one node per (symbol, span), and a node with two
 * derivations holds both as PACKINGS rather than being duplicated. That is what
 * keeps an exponential number of trees in a polynomial amount of memory — the
 * forest for `a+a+a+…` grows quadratically while the tree count grows like the
 * Catalan numbers.
 *
 * Everything here is checked against Earley on the same grammar: same accept
 * decision, same number of distinct trees. Two general parsers that disagree
 * mean one of them is wrong, and the test says which inputs.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Glr = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');
  const Items = root && root.LrItems ? root.LrItems : require('./lr-items.js');
  const LrParser = root && root.LrParser ? root.LrParser : require('./lr-parser.js');

  /* ------------------------------------------------------------- forest */

  /**
   * A forest node is keyed by (symbol, from, to). `packings` holds each way the
   * span can be derived; more than one is an ambiguity, and the node is where
   * the sharing happens.
   */
  function forest() {
    return { nodes: {}, order: [] };
  }

  function nodeKey(symbol, from, to) { return symbol + ':' + from + ':' + to; }

  function intern(store, symbol, from, to) {
    const key = nodeKey(symbol, from, to);

    if (!store.nodes[key]) {
      store.nodes[key] = { symbol: symbol, from: from, to: to, packings: [], key: key };
      store.order.push(key);
    }
    return store.nodes[key];
  }

  function pack(node, rule, children) {
    const signature = rule.index + '|' + children.map(function (child) {
      return child.key;
    }).join(',');

    if (node.packings.some(function (existing) { return existing.signature === signature; })) {
      return;
    }
    node.packings.push({ rule: rule, children: children, signature: signature });
  }

  /* --------------------------------------------------------- the parser */

  /**
   * Parse with the LR automaton, taking every action a conflicted cell offers.
   * `mode` selects which table drives it, so the demo can show the same grammar
   * needing GLR under LR(0) and being deterministic under LR(1).
   */
  function parse(grammar, tokens, options) {
    const settings = options || {};
    const built = LrParser.build(grammar, settings.mode || 'lr0');
    const state = {
      built: built, input: tokens.concat([Grammar.END]), store: forest(),
      frontier: [vertex(0, 0)], steps: 0, forks: 0, merges: 0, vertices: 1,
      cap: settings.cap === undefined ? 200000 : settings.cap,
      overflow: false, widest: 1
    };

    for (let at = 0; at <= tokens.length; at += 1) {
      state.frontier = advance(state, at);
      state.widest = Math.max(state.widest, state.frontier.length);
      if (state.frontier.length === 0 || state.overflow) break;
    }
    return finish(state, grammar, tokens);
  }

  /** A GSS vertex: an LR state reached at an input position. Its edges point
   *  BACKWARDS and carry the forest node that was on the stack. */
  function vertex(lrState, at) {
    return { state: lrState, at: at, edges: [] };
  }

  function link(from, to, node) {
    const exists = from.edges.some(function (edge) {
      return edge.to === to && edge.node === node;
    });

    if (exists) return false;
    from.edges.push({ to: to, node: node });
    return true;
  }

  function finish(state, grammar, tokens) {
    const root_ = state.store.nodes[nodeKey(grammar.start, 0, tokens.length)];

    return {
      accepted: Boolean(root_) && !state.overflow,
      root: root_ || null, store: state.store,
      steps: state.steps, forks: state.forks, merges: state.merges,
      widest: state.widest, overflow: state.overflow,
      vertices: state.vertices,
      nodes: state.store.order.length,
      ambiguous: state.store.order.filter(function (key) {
        return state.store.nodes[key].packings.length > 1;
      }).length,
      states: state.built.states, conflicts: state.built.conflicts.length
    };
  }

  /**
   * One input position: reduce to a fixed point across every live vertex, then
   * shift the lookahead. The fixed point is not decoration — adding an edge to
   * a vertex that has already been reduced from opens paths that were not
   * there the first time, and a single pass silently loses those derivations.
   */
  function advance(state, at) {
    const scope = { state: state, at: at, lookahead: state.input[at],
      live: state.frontier.slice(), index: {} };

    scope.live.forEach(function (v) { scope.index[v.state] = v; });
    let changed = true;

    while (changed && !state.overflow) {
      changed = false;
      for (let i = 0; i < scope.live.length; i += 1) {
        if (reduceFrom(scope, scope.live[i])) changed = true;
      }
    }
    return shiftAll(scope);
  }

  function reduceFrom(scope, from) {
    let changed = false;

    actionsFor(scope.state, from.state, scope.lookahead).forEach(function (action) {
      if (action.kind !== 'reduce') return;
      scope.state.steps += 1;
      if (scope.state.steps > scope.state.cap) { scope.state.overflow = true; return; }
      walkBack(from, action.rule.rhs.length).forEach(function (path) {
        if (applyReduction(scope, action, path)) changed = true;
      });
    });
    return changed;
  }

  /**
   * Pop |rhs| links off the GSS, intern the forest node for the span, and push
   * the GOTO state. Two branches that reduce to the same (symbol, span) land
   * on the SAME forest node with two packings — that is the whole of "shared
   * packed", and it is why the forest stays polynomial while the tree count
   * does not.
   */
  function applyReduction(scope, action, path) {
    const target = scope.state.built.goTo[path.base.state][action.rule.lhs];

    if (target === undefined) return false;
    const node = intern(scope.state.store, action.rule.lhs, path.base.at, scope.at);
    const before = node.packings.length;

    pack(node, action.rule, path.children);
    let to = scope.index[target];

    if (!to) {
      to = vertex(target, scope.at);
      scope.index[target] = to;
      scope.live.push(to);
      scope.state.vertices += 1;
    } else if (node.packings.length > before) {
      scope.state.merges += 1;
    }
    const added = link(to, path.base, node);

    return added || node.packings.length > before;
  }

  /** Every way to pop `count` links: a merged vertex has several predecessors
   *  and each one is a different derivation of the same span. */
  function walkBack(from, count) {
    let frontier = [{ base: from, children: [] }];

    for (let i = 0; i < count; i += 1) {
      const next = [];

      frontier.forEach(function (path) {
        path.base.edges.forEach(function (edge) {
          next.push({ base: edge.to, children: [edge.node].concat(path.children) });
        });
      });
      frontier = next;
      if (frontier.length === 0) return [];
    }
    return frontier;
  }

  function shiftAll(scope) {
    const next = {};
    const out = [];

    scope.live.forEach(function (from) {
      actionsFor(scope.state, from.state, scope.lookahead).forEach(function (action) {
        if (action.kind !== 'shift') return;
        const node = intern(scope.state.store, scope.lookahead, scope.at, scope.at + 1);
        let to = next[action.target];

        if (!to) {
          to = vertex(action.target, scope.at + 1);
          next[action.target] = to;
          out.push(to);
          scope.state.vertices += 1;
        } else {
          scope.state.merges += 1;
        }
        link(to, from, node);
      });
    });
    return out;
  }

  /** Every action the cell offers, including the ones a deterministic parser
   *  threw away when it resolved the conflict — which is recoverable only
   *  because the conflict report kept both actions rather than a count. */
  function actionsFor(state, lrState, lookahead) {
    const out = [];
    const entry = state.built.action[lrState][lookahead];

    if (entry) out.push(entry);
    state.built.conflicts.forEach(function (conflict) {
      if (conflict.state !== lrState || conflict.terminal !== lookahead) return;
      [conflict.firstAction, conflict.secondAction].forEach(function (action) {
        if (!action || out.indexOf(action) !== -1) return;
        if (out.some(function (kept) { return same(kept, action); })) return;
        out.push(action);
        state.forks += 1;
      });
    });
    return out;
  }

  function same(a, b) {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'shift') return a.target === b.target;
    if (a.kind === 'reduce') return a.rule.index === b.rule.index;
    return true;
  }

  /* ------------------------------------------------------ reading it out */

  /**
   * Unfold the forest into individual trees, capped. Unfolding is where the
   * sharing is paid back: a forest with k ambiguous binary nodes unfolds into
   * a number of trees exponential in k, which is why tools hand you the forest
   * and let you filter it instead.
   */
  function trees(result, cap) {
    if (!result.root) return [];
    const limit = cap === undefined ? 50 : cap;

    return unfold(result.root, limit, {});
  }

  function unfold(node, cap, visiting) {
    if (node.packings.length === 0) return [Grammar.node(node.symbol, [])];
    if (visiting[node.key]) return [];
    visiting[node.key] = true;
    const out = [];

    node.packings.forEach(function (packing) {
      if (out.length >= cap) return;
      childCombinations(packing.children, cap, visiting).forEach(function (children) {
        if (out.length >= cap) return;
        out.push(Grammar.node(node.symbol, children));
      });
    });
    delete visiting[node.key];
    return out;
  }

  function childCombinations(children, cap, visiting) {
    let combinations = [[]];

    children.forEach(function (child) {
      const options = unfold(child, cap, visiting);
      const next = [];

      combinations.forEach(function (prefix) {
        options.forEach(function (option) {
          if (next.length < cap) next.push(prefix.concat([option]));
        });
      });
      combinations = next;
    });
    return combinations;
  }

  /** The forest as rows for the demo: the ambiguous nodes first, since those
   *  are the only interesting ones. */
  function forestRows(result) {
    return result.store.order.map(function (key) {
      const node = result.store.nodes[key];

      return {
        symbol: node.symbol, span: node.from + '–' + node.to,
        derivations: node.packings.length,
        packings: node.packings.map(function (packing) {
          return packing.rule.lhs + ' → ' + (packing.rule.rhs.join(' ') || 'ε');
        }),
        ambiguous: node.packings.length > 1
      };
    }).sort(function (a, b) { return b.derivations - a.derivations; });
  }

  return {
    parse: parse, trees: trees, forestRows: forestRows, forest: forest,
    intern: intern, pack: pack, vertex: vertex, walkBack: walkBack
  };
}));
