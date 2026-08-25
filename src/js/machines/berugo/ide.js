/**
 * The editor, built out of the compiler's own tables.
 *
 * Nothing here is a new analysis. Hover reads the type table, go-to-definition
 * and rename read the binding table, completion reads the scope tree. That is
 * the argument the milestone is making: if name resolution is a data structure
 * rather than something the type checker does on its way past, these features
 * cost a lookup each. If it is not, every one of them is a rewrite.
 *
 * Rename is the one that has to be right, and it is the one people get wrong,
 * because the naive implementation is a text substitution and the correct one
 * is a walk over an occurrence-keyed table. Two names spelled the same in one
 * file can be different bindings, and a rename must touch one and not the
 * other.
 *
 * So rename checks itself. It applies its edits, resolves the result from
 * scratch, and compares the reference-to-binding structure against the
 * original. Renaming cannot change what any name means; if it did, the new
 * name captured something, and the answer is a refusal with the reason rather
 * than an edit that silently changes the program. A rename that only inspects
 * the scope it is renaming in cannot see the capture that happens three scopes
 * down, and that is precisely the case that reaches production.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Ide = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ast = berugo && berugo.Ast ? berugo.Ast : require('./ast.js');
  const Parser = berugo && berugo.Parser ? berugo.Parser : require('./parser.js');
  const Resolve = berugo && berugo.Resolve ? berugo.Resolve : require('./resolve.js');
  const Typecheck = berugo && berugo.Typecheck ? berugo.Typecheck : require('./typecheck.js');
  const Diagnostics = berugo && berugo.Diagnostics
    ? berugo.Diagnostics : require('./diagnostics.js');

  const KEYWORDS = ['let', 'fn', 'if', 'else', 'while', 'for', 'in', 'match',
    'return', 'break', 'continue', 'import', 'true', 'false'];

  /* ------------------------------------------------------------- analysis */

  function analyse(source) {
    const parsed = Parser.parse(source);
    const table = Resolve.resolve(parsed.tree);
    const typed = Typecheck.typecheck(parsed.tree, table);
    const raw = Diagnostics.collect({ parse: parsed.errors, resolve: table.errors,
      typecheck: typed.errors });

    return { source: source, tree: parsed.tree, tokens: parsed.tokens, table: table,
      types: typed, diagnostics: Diagnostics.suppress(raw), raw: raw };
  }

  /* --------------------------------------------------------------- lookup */

  /**
   * What the cursor is on. A declaration site and a use site are different
   * nodes with the same name, and both have to answer, so the binding is found
   * either through the reference table or through the node's own `binding`
   * field — whichever the node has.
   */
  function at(analysis, offset) {
    const node = Ast.nodeAt(analysis.tree, offset);

    if (!node) return null;
    return { node: node, binding: bindingFor(analysis, node) };
  }

  function bindingFor(analysis, node) {
    const reference = analysis.table.bindingOf(node);

    if (reference) return reference;
    return node.binding || declarationBinding(analysis, node);
  }

  /** A `letDecl` carries no binding field; its binding is the one at its span. */
  function declarationBinding(analysis, node) {
    return analysis.table.bindings.find(function (entry) {
      return entry.span && entry.span.start === node.span.start
        && entry.name === node.name;
    }) || null;
  }

  function hover(analysis, offset) {
    const found = at(analysis, offset);

    if (!found) return null;
    return { kind: found.node.kind, span: found.node.span,
      name: found.node.name || '', type: analysis.types.typeOf(found.node),
      binding: found.binding ? describeBinding(found.binding) : '',
      text: analysis.source.slice(found.node.span.start, found.node.span.end) };
  }

  function describeBinding(binding) {
    return binding.kind + ' ' + binding.name
      + (binding.captured ? ' (captured by a closure)' : '');
  }

  function definition(analysis, offset) {
    const found = at(analysis, offset);

    if (!found || !found.binding || !found.binding.span) return null;
    return { span: found.binding.span, name: found.binding.name,
      kind: found.binding.kind };
  }

  function references(analysis, offset) {
    const found = at(analysis, offset);

    if (!found || !found.binding) return [];
    return analysis.table.references.filter(function (entry) {
      return entry.binding === found.binding;
    }).map(function (entry) { return entry.node.span; });
  }

  /** Every name a scope at this offset can see, plus the keywords. */
  function completions(analysis, offset) {
    const found = at(analysis, offset);
    const names = visibleAt(analysis, found ? found.node : null);

    return { names: names, keywords: KEYWORDS.slice(),
      total: names.length + KEYWORDS.length };
  }

  function visibleAt(analysis, node) {
    const seen = [];
    let here = enclosingScope(analysis, node);

    while (here) {
      here.order.forEach(function (binding) {
        if (seen.indexOf(binding.name) === -1) seen.push(binding.name);
      });
      here = here.parent;
    }
    return seen;
  }

  /**
   * The innermost scope containing the offset. A scope has no span of its own,
   * so it is found through the binding whose scope it is — the deepest binding
   * whose declaration site encloses the cursor. Falling back to the global
   * scope is right rather than empty: at the top level of a file, the global
   * scope IS the answer.
   */
  function enclosingScope(analysis, node) {
    if (!node) return analysis.table.global;
    const inside = analysis.table.references.filter(function (entry) {
      return entry.node.span.start <= node.span.start
        && entry.node.span.end >= node.span.end;
    });

    if (inside.length) return inside[inside.length - 1].scope;
    return deepestScopeFor(analysis, node);
  }

  function deepestScopeFor(analysis, node) {
    const owning = analysis.table.bindings.filter(function (entry) {
      return entry.kind !== 'builtin' && entry.span
        && entry.span.start <= node.span.start && entry.span.end >= node.span.end;
    });

    if (!owning.length) return analysis.table.global;
    return owning[owning.length - 1].scope;
  }

  function symbols(analysis) {
    return analysis.table.bindings.filter(function (entry) {
      return entry.kind !== 'builtin' && entry.scope === analysis.table.global;
    }).map(function (entry) {
      return { name: entry.name, kind: entry.kind, span: entry.span };
    });
  }

  /* --------------------------------------------------------------- rename */

  /**
   * The structure a rename must not change: for every reference in document
   * order, which binding (by index) it resolves to. Renaming is a change of
   * spelling, so this list has to come out identical. It is compared rather
   * than reasoned about, which is what catches capture at any depth.
   */
  function shape(table) {
    const index = new Map();

    table.bindings.forEach(function (binding, position) { index.set(binding, position); });
    return table.references.map(function (entry) {
      return index.has(entry.binding) ? index.get(entry.binding) : -1;
    }).join(',');
  }

  function rename(source, offset, newName) {
    const analysis = analyse(source);
    const found = at(analysis, offset);

    if (!found || !found.binding) return refusal('the cursor is not on a name', []);
    if (found.binding.kind === 'builtin') {
      return refusal('builtins are not renameable', []);
    }
    if (!validName(newName)) return refusal(newName + ' is not a valid identifier', []);
    return applyRename(analysis, found.binding, newName);
  }

  function validName(name) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && KEYWORDS.indexOf(name) === -1;
  }

  function refusal(why, edits) {
    return { ok: false, why: why, edits: edits, source: '', touched: 0, verified: false };
  }

  function editsFor(analysis, binding) {
    const spans = analysis.table.references.filter(function (entry) {
      return entry.binding === binding;
    }).map(function (entry) { return entry.node.span; });

    if (binding.span && binding.nameSpan) spans.push(binding.nameSpan);
    else if (binding.span) spans.push(declarationNameSpan(analysis, binding));
    return spans.filter(Boolean).sort(function (a, b) { return b.start - a.start; });
  }

  /**
   * A declaration's span covers the whole statement (`let a = 1;`), not the
   * name, so the name's own offsets have to be recovered — editing the whole
   * span would replace the initialiser with the new name.
   *
   * It is recovered from the TOKEN stream, not by searching the text. A text
   * search for `f` inside `fn f(a) { … }` finds the `f` of `fn`, renames that,
   * and produces a file that no longer parses — which is what this did until
   * the fixture set included a function. A token of kind `name` cannot be part
   * of a keyword, so the token stream cannot make that mistake.
   */
  function declarationNameSpan(analysis, binding) {
    const found = analysis.tokens.find(function (token) {
      return token.kind === 'name' && token.value === binding.name
        && token.start >= binding.span.start && token.end <= binding.span.end;
    });

    if (!found) return null;
    return { start: found.start, end: found.end };
  }

  function applyRename(analysis, binding, newName) {
    const spans = editsFor(analysis, binding);
    const next = spans.reduce(function (text, span) {
      return text.slice(0, span.start) + newName + text.slice(span.end);
    }, analysis.source);

    return verifyRename(analysis, { spans: spans, source: next, name: newName });
  }

  /**
   * Two checks, and the second is not implied by the first.
   *
   * The structure check catches a rename that changes what an existing name
   * refers to. It does NOT catch a rename that introduces a name clash: the
   * references still resolve to the same bindings by position, so the shape is
   * identical, and the program now has two bindings of one name in one scope.
   * Comparing the resolver's error list is what closes that gap, and the pair
   * is why this refuses rather than reasons — either check alone accepts a
   * rename it should not.
   */
  function verifyRename(analysis, attempt) {
    const after = Parser.parse(attempt.source);
    const table = Resolve.resolve(after.tree);

    if (after.errors.length) {
      return refusal('the renamed program no longer parses', attempt.spans);
    }
    if (shape(table) !== shape(analysis.table)) {
      return refusal('renaming to ' + attempt.name
        + ' would change what some other name refers to', attempt.spans);
    }
    if (newProblems(analysis.table, table)) {
      return refusal('renaming to ' + attempt.name + ' would '
        + newProblems(analysis.table, table), attempt.spans);
    }
    return { ok: true, why: '', edits: attempt.spans.slice().reverse(),
      source: attempt.source, touched: attempt.spans.length, verified: true };
  }

  /** Any resolution problem the rename introduced, described for a refusal. */
  function newProblems(before, after) {
    const had = codeCounts(before.errors);
    const has = codeCounts(after.errors);
    const worse = Object.keys(has).filter(function (code) {
      return has[code] > (had[code] || 0);
    });

    if (!worse.length) return '';
    if (worse.indexOf('E-RESOLVE-SHADOW-SAME') !== -1) {
      return 'bind that name twice in one scope';
    }
    return 'introduce ' + worse.join(' and ');
  }

  function codeCounts(errors) {
    const counts = {};

    errors.forEach(function (entry) {
      counts[entry.code] = (counts[entry.code] || 0) + 1;
    });
    return counts;
  }

  /* ---------------------------------------------------- incremental recheck */

  /**
   * A session caches the last analysis and reports whether an edit could reuse
   * anything. The reuse test here is deliberately the honest one: only an edit
   * that changes nothing reuses the analysis. A real language server keys each
   * stage on a content hash of its input and reuses per stage; the point of
   * measuring it this way is that the number reported is the number achieved,
   * and `relexed` shows what the lexer alone could have saved.
   */
  function session() {
    const state = { last: null, source: '', edits: 0, reused: 0 };

    return {
      update: function (source) { return update(state, source); },
      analysis: function () { return state.last; },
      stats: function () {
        return { edits: state.edits, reused: state.reused,
          reuseRate: state.edits ? state.reused / state.edits : 0 };
      }
    };
  }

  function update(state, source) {
    state.edits += 1;
    if (state.last && state.source === source) {
      state.reused += 1;
      return { analysis: state.last, reused: true, stages: 0 };
    }
    state.last = analyse(source);
    state.source = source;
    return { analysis: state.last, reused: false, stages: 4 };
  }

  return {
    KEYWORDS: KEYWORDS,
    analyse: analyse, at: at, hover: hover, definition: definition,
    references: references, completions: completions, symbols: symbols,
    rename: rename, shape: shape, validName: validName, session: session
  };
}));
