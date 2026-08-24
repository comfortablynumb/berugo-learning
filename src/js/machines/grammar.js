/**
 * One representation for context-free grammars, with the two computations
 * every parser in M25 is built on.
 *
 * A grammar is a start symbol and a list of productions:
 *
 *   { start: 'E', productions: { E: [['E', '+', 'T'], ['T']], … } }
 *
 * A symbol is a NONTERMINAL exactly when it has productions of its own, so
 * there is no separate terminal declaration to keep in step with the rules —
 * which removes the class of bug where a typo in a right-hand side silently
 * becomes a terminal that nothing can produce. An empty right-hand side is the
 * ε-production.
 *
 * FIRST and FOLLOW are the whole of predictive parsing and half of SLR, and
 * both are least fixed points computed by iterating to stability rather than by
 * recursion — a recursive FIRST loops forever on a left-recursive grammar,
 * which is exactly the grammar shape section 25.2 exists to remove.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Grammar = api;
}(this, function () {
  'use strict';

  const END = '$';

  /* --------------------------------------------------------- construction */

  function create(config) {
    const productions = [];
    const byLhs = {};
    const order = Object.keys(config.productions);

    order.forEach(function (lhs) {
      byLhs[lhs] = [];
      config.productions[lhs].forEach(function (rhs) {
        const rule = { lhs: lhs, rhs: rhs.slice(), index: productions.length };

        productions.push(rule);
        byLhs[lhs].push(rule);
      });
    });
    return {
      start: config.start,
      nonterminals: order,
      terminals: terminalsOf(order, productions),
      productions: productions,
      byLhs: byLhs,
      label: config.label || null
    };
  }

  function terminalsOf(nonterminals, productions) {
    const seen = {};

    productions.forEach(function (rule) {
      rule.rhs.forEach(function (symbol) {
        if (nonterminals.indexOf(symbol) === -1) seen[symbol] = true;
      });
    });
    return Object.keys(seen).sort();
  }

  function isNonterminal(grammar, symbol) {
    return grammar.nonterminals.indexOf(symbol) !== -1;
  }

  /** The grammar as text, one production per line — what a demo prints. */
  function show(grammar) {
    return grammar.nonterminals.map(function (lhs) {
      return lhs + ' → ' + grammar.byLhs[lhs].map(function (rule) {
        return rule.rhs.length ? rule.rhs.join(' ') : 'ε';
      }).join(' | ');
    });
  }

  /* ------------------------------------------------------------- nullable */

  /** Which nonterminals derive the empty string. Iterate to stability: a
   *  recursive definition does not terminate on a left-recursive grammar. */
  function nullable(grammar) {
    const set = {};
    let changed = true;

    while (changed) {
      changed = false;
      grammar.productions.forEach(function (rule) {
        if (set[rule.lhs]) return;
        const derivesEmpty = rule.rhs.every(function (symbol) { return set[symbol]; });

        if (!derivesEmpty) return;
        set[rule.lhs] = true;
        changed = true;
      });
    }
    return set;
  }

  /* ---------------------------------------------------------------- FIRST */

  /**
   * FIRST(X): the terminals that can begin a string derived from X. The fixed
   * point is over all nonterminals at once, so left recursion is not a problem
   * — a left-recursive rule simply contributes nothing new after the first
   * round.
   */
  function first(grammar) {
    const empty = nullable(grammar);
    const sets = {};
    let changed = true;

    grammar.nonterminals.forEach(function (name) { sets[name] = {}; });
    while (changed) {
      changed = false;
      grammar.productions.forEach(function (rule) {
        if (extendFirst(grammar, sets, empty, rule)) changed = true;
      });
    }
    return { sets: sets, nullable: empty };
  }

  function extendFirst(grammar, sets, empty, rule) {
    let changed = false;

    for (let i = 0; i < rule.rhs.length; i += 1) {
      const symbol = rule.rhs[i];

      if (!isNonterminal(grammar, symbol)) {
        if (!sets[rule.lhs][symbol]) { sets[rule.lhs][symbol] = true; changed = true; }
        return changed;
      }
      Object.keys(sets[symbol]).forEach(function (terminal) {
        if (sets[rule.lhs][terminal]) return;
        sets[rule.lhs][terminal] = true;
        changed = true;
      });
      if (!empty[symbol]) return changed;
    }
    return changed;
  }

  /** FIRST of a sequence, with `nullable` reported separately rather than as a
   *  sentinel in the set — a sentinel gets copied into FOLLOW by accident. */
  function firstOfSequence(grammar, analysis, sequence) {
    const out = {};

    for (let i = 0; i < sequence.length; i += 1) {
      const symbol = sequence[i];

      if (!isNonterminal(grammar, symbol)) {
        out[symbol] = true;
        return { set: out, nullable: false };
      }
      Object.keys(analysis.sets[symbol]).forEach(function (t) { out[t] = true; });
      if (!analysis.nullable[symbol]) return { set: out, nullable: false };
    }
    return { set: out, nullable: true };
  }

  /* --------------------------------------------------------------- FOLLOW */

  /**
   * FOLLOW(A): the terminals that can appear immediately after A in some
   * sentential form, plus the end marker where A can end the input. Again a
   * fixed point, because FOLLOW(A) can depend on FOLLOW(B) which depends on
   * FOLLOW(A).
   */
  function follow(grammar, firstAnalysis) {
    const analysis = firstAnalysis || first(grammar);
    const sets = {};
    let changed = true;

    grammar.nonterminals.forEach(function (name) { sets[name] = {}; });
    sets[grammar.start][END] = true;
    while (changed) {
      changed = false;
      grammar.productions.forEach(function (rule) {
        if (extendFollow(grammar, analysis, sets, rule)) changed = true;
      });
    }
    return sets;
  }

  function extendFollow(grammar, analysis, sets, rule) {
    let changed = false;

    for (let i = 0; i < rule.rhs.length; i += 1) {
      const symbol = rule.rhs[i];

      if (!isNonterminal(grammar, symbol)) continue;
      const rest = firstOfSequence(grammar, analysis, rule.rhs.slice(i + 1));

      Object.keys(rest.set).forEach(function (terminal) {
        if (sets[symbol][terminal]) return;
        sets[symbol][terminal] = true;
        changed = true;
      });
      if (!rest.nullable) continue;
      Object.keys(sets[rule.lhs]).forEach(function (terminal) {
        if (sets[symbol][terminal]) return;
        sets[symbol][terminal] = true;
        changed = true;
      });
    }
    return changed;
  }

  function sorted(set) {
    return Object.keys(set).sort();
  }

  /* ------------------------------------------------------------ reachable */

  /** Symbols reachable from the start, and symbols that derive a terminal
   *  string. A symbol failing either is USELESS and must go before anything
   *  else — a parse table built over one is full of unreachable cells. */
  function useful(grammar) {
    const generating = generatingSet(grammar);
    const reachable = reachableSet(grammar, generating);

    return { generating: generating, reachable: reachable,
      useless: grammar.nonterminals.filter(function (name) {
        return !generating[name] || !reachable[name];
      }) };
  }

  function generatingSet(grammar) {
    const set = {};
    let changed = true;

    while (changed) {
      changed = false;
      grammar.productions.forEach(function (rule) {
        if (set[rule.lhs]) return;
        const ok = rule.rhs.every(function (symbol) {
          return !isNonterminal(grammar, symbol) || set[symbol];
        });

        if (!ok) return;
        set[rule.lhs] = true;
        changed = true;
      });
    }
    return set;
  }

  function reachableSet(grammar, generating) {
    const set = {};
    const stack = [grammar.start];

    set[grammar.start] = true;
    while (stack.length) {
      const name = stack.pop();

      (grammar.byLhs[name] || []).forEach(function (rule) {
        const ok = rule.rhs.every(function (symbol) {
          return !isNonterminal(grammar, symbol) || generating[symbol];
        });

        if (!ok) return;
        rule.rhs.forEach(function (symbol) {
          if (!isNonterminal(grammar, symbol) || set[symbol]) return;
          set[symbol] = true;
          stack.push(symbol);
        });
      });
    }
    return set;
  }

  /* ------------------------------------------------------------ languages */

  /**
   * Every string the grammar derives up to a length bound, by breadth-first
   * expansion of sentential forms. This is the reference every transformation
   * in section 25.2 is checked against, and every parser is checked against —
   * it is slow, and it is derived from the grammar rather than from any parser,
   * which is the whole point.
   */
  function language(grammar, maxLength, cap) {
    const limit = cap === undefined ? 20000 : cap;
    const seen = {};
    const words = {};
    const queue = [[grammar.start]];

    seen[grammar.start] = true;
    let expansions = 0;

    while (queue.length && expansions < limit) {
      const form = queue.shift();

      expansions += 1;
      if (form.every(function (s) { return !isNonterminal(grammar, s); })) {
        words[form.join('')] = true;
        continue;
      }
      expand(grammar, form, maxLength, seen, queue);
    }
    return { words: Object.keys(words).sort(byLength), expansions: expansions,
      truncated: queue.length > 0 };
  }

  function expand(grammar, form, maxLength, seen, queue) {
    const at = form.findIndex(function (s) { return isNonterminal(grammar, s); });

    grammar.byLhs[form[at]].forEach(function (rule) {
      const next = form.slice(0, at).concat(rule.rhs, form.slice(at + 1));
      const terminals = next.filter(function (s) { return !isNonterminal(grammar, s); });

      if (terminals.length > maxLength) return;
      const key = next.join('');

      if (seen[key]) return;
      seen[key] = true;
      queue.push(next);
    });
  }

  function byLength(a, b) {
    return a.length === b.length ? (a < b ? -1 : 1) : a.length - b.length;
  }

  /** Do two grammars derive the same strings up to a bound? The check every
   *  transformation must pass. */
  function sameLanguage(first_, second, maxLength) {
    const left = language(first_, maxLength).words;
    const right = language(second, maxLength).words;
    const missing = left.filter(function (word) { return right.indexOf(word) === -1; });
    const extra = right.filter(function (word) { return left.indexOf(word) === -1; });

    return { same: missing.length === 0 && extra.length === 0,
      missing: missing, extra: extra, tested: left.length + right.length };
  }

  /* ---------------------------------------------------------- parse trees */

  function node(symbol, children) {
    return { symbol: symbol, children: children || null };
  }

  function leaves(tree, out) {
    const acc = out || [];

    if (!tree.children) {
      if (tree.symbol !== '') acc.push(tree.symbol);
      return acc;
    }
    tree.children.forEach(function (child) { leaves(child, acc); });
    return acc;
  }

  /** A canonical string for a tree, so two parses can be compared and
   *  duplicates removed when ambiguity is enumerated. */
  function shape(tree) {
    if (!tree.children) return tree.symbol === '' ? 'ε' : tree.symbol;
    return tree.symbol + '(' + tree.children.map(shape).join(' ') + ')';
  }

  function height(tree) {
    if (!tree.children || tree.children.length === 0) return 1;
    return 1 + Math.max.apply(null, tree.children.map(height));
  }

  function size(tree) {
    if (!tree.children) return 1;
    return 1 + tree.children.reduce(function (total, child) { return total + size(child); }, 0);
  }

  return {
    END: END,
    create: create, isNonterminal: isNonterminal, show: show, sorted: sorted,
    nullable: nullable, first: first, follow: follow, firstOfSequence: firstOfSequence,
    useful: useful, language: language, sameLanguage: sameLanguage,
    node: node, leaves: leaves, shape: shape, height: height, size: size
  };
}));
