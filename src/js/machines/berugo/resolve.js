/**
 * Name resolution: a separate pass that produces a table.
 *
 * The shortcut is to resolve names inside the type checker, where the scope is
 * already on hand. It works, and it means nothing else can ever answer "what
 * does this name refer to" — not the optimiser, not go-to-definition, not
 * rename. Producing an explicit binding table instead costs one pass and makes
 * every one of those free: each is a lookup in a map that already exists.
 *
 * The table is keyed by reference node, so the answer is per *occurrence*
 * rather than per name. That is what makes shadowing work: two references
 * spelled the same in the same file resolve to different bindings, and rename
 * has to touch one and not the other.
 *
 * Capture analysis falls out of the same walk. A reference whose binding lives
 * outside the function containing it is a capture, and recording which
 * function captured what is exactly what M29's escape analysis will need.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Resolve = api;
  }
}(this, function (root) {
  'use strict';

  const Ast = root && root.Berugo && root.Berugo.Ast ? root.Berugo.Ast : require('./ast.js');

  /** Modules the resolver knows about, so `import` has something to find. */
  const MODULES = {
    math: ['square', 'abs', 'max'],
    text: ['length', 'upper'],
    list: ['map', 'len']
  };

  /** Names available with no import at all. */
  const BUILTINS = ['print', 'some', 'none', 'len'];

  function makeScope(kind, parent, owner) {
    return { kind: kind, parent: parent, owner: owner, bindings: {},
      order: [], children: [], id: null };
  }

  function makeState() {
    return { bindings: [], references: [], captures: [], errors: [],
      scopes: [], functions: [], nextId: 0 };
  }

  /* ------------------------------------------------------------ the walk */

  function declare(state, current, spec) {
    if (Object.prototype.hasOwnProperty.call(current.bindings, spec.name)) {
      state.errors.push({ code: 'E-RESOLVE-SHADOW-SAME',
        message: spec.name + ' is already bound in this scope',
        span: spec.span, related: current.bindings[spec.name].span });
    }
    const binding = { id: 'b' + state.nextId, name: spec.name, span: spec.span,
      kind: spec.kind, scope: current, owner: current.owner, references: [],
      captured: false };

    state.nextId += 1;
    current.bindings[spec.name] = binding;
    current.order.push(binding);
    state.bindings.push(binding);
    return binding;
  }

  function lookup(current, name) {
    let at = current;

    while (at) {
      if (Object.prototype.hasOwnProperty.call(at.bindings, name)) return at.bindings[name];
      at = at.parent;
    }
    return null;
  }

  /**
   * Record a use. If the binding's owning function is not the function we are
   * standing in, the value has been captured — and the chain of functions
   * between them all have to close over it, which is what the loop records.
   */
  function use(state, current, node) {
    const binding = lookup(current, node.name);

    if (!binding) return unresolved(state, current, node);
    const reference = { node: node, binding: binding, span: node.span,
      scope: current, captured: binding.owner !== current.owner };

    binding.references.push(reference);
    state.references.push(reference);
    if (reference.captured) recordCapture(state, current, binding);
    return reference;
  }

  function recordCapture(state, current, binding) {
    binding.captured = true;
    let owner = current.owner;

    while (owner && owner !== binding.owner) {
      if (owner.captures.indexOf(binding) === -1) owner.captures.push(binding);
      state.captures.push({ fn: owner, binding: binding });
      owner = owner.parent;
    }
  }

  /** A name nothing binds, with the nearest spelling as a suggestion. */
  function unresolved(state, current, node) {
    const visible = visibleNames(current);
    const near = closest(node.name, visible);

    state.errors.push({ code: 'E-RESOLVE-UNBOUND',
      message: 'nothing named ' + node.name + ' is in scope'
        + (near ? '. Did you mean ' + near + '?' : ''),
      span: node.span, suggestion: near });
    return null;
  }

  function visibleNames(current) {
    const names = [];
    let at = current;

    while (at) {
      Object.keys(at.bindings).forEach(function (name) {
        if (names.indexOf(name) === -1) names.push(name);
      });
      at = at.parent;
    }
    return names;
  }

  /** Edit distance, capped — a suggestion three edits away is not a suggestion. */
  function closest(name, candidates) {
    let best = null;
    let bestScore = 3;

    candidates.forEach(function (candidate) {
      const score = distance(name, candidate);

      if (score >= bestScore) return;
      bestScore = score;
      best = candidate;
    });
    return best;
  }

  function distance(left, right) {
    const rows = [];

    for (let i = 0; i <= left.length; i += 1) rows.push([i]);
    for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
          rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      }
    }
    return rows[left.length][right.length];
  }

  /* ------------------------------------------------------- the traversal */

  const WALKERS = {
    program: function (node, ctx) { walkItems(node.items, ctx); },
    block: function (node, ctx) { walkBlock(node, ctx); },
    letDecl: function (node, ctx) { walkLet(node, ctx); },
    fnDecl: function (node, ctx) { walkFnDecl(node, ctx); },
    lambda: function (node, ctx) { walkLambda(node, ctx); },
    importDecl: function (node, ctx) { walkImport(node, ctx); },
    forStmt: function (node, ctx) { walkFor(node, ctx); },
    matchExpr: function (node, ctx) { walkMatch(node, ctx); },
    name: function (node, ctx) { use(ctx.state, ctx.scope, node); }
  };

  function walkNode(node, ctx) {
    if (!node || !node.kind) return;
    const walker = WALKERS[node.kind];

    if (walker) { walker(node, ctx); return; }
    Ast.childrenOf(node).forEach(function (child) { walkNode(child, ctx); });
  }

  /**
   * Function declarations are hoisted so mutual recursion works, and `let`
   * bindings are not, so a use before the binding is an error rather than a
   * silent undefined. Both choices are visible here in six lines, which is
   * where a language's hoisting rules should be readable.
   */
  function walkItems(items, ctx) {
    items.filter(function (item) { return item.kind === 'fnDecl'; })
      .forEach(function (item) {
        item.binding = declare(ctx.state, ctx.scope,
          { name: item.name, span: item.span, kind: 'fn' });
      });
    items.forEach(function (item) { walkNode(item, ctx); });
  }

  function walkBlock(node, ctx) {
    const inner = pushScope(ctx, 'block');

    walkItems(node.statements, Object.assign({}, ctx, { scope: inner }));
    if (node.tail) walkNode(node.tail, Object.assign({}, ctx, { scope: inner }));
  }

  function pushScope(ctx, kind) {
    const inner = makeScope(kind, ctx.scope, ctx.scope.owner);

    inner.id = 's' + ctx.state.scopes.length;
    ctx.state.scopes.push(inner);
    ctx.scope.children.push(inner);
    return inner;
  }

  function walkLet(node, ctx) {
    walkNode(node.value, ctx);
    node.binding = declare(ctx.state, ctx.scope,
      { name: node.name, span: node.span, kind: 'let' });
  }

  function walkFnDecl(node, ctx) {
    if (!node.binding) {
      node.binding = declare(ctx.state, ctx.scope,
        { name: node.name, span: node.span, kind: 'fn' });
    }
    walkFunctionBody(node, node.params, node.body, ctx);
  }

  function walkLambda(node, ctx) {
    walkFunctionBody(node, node.params, node.body, ctx);
  }

  function walkFunctionBody(node, params, body, ctx) {
    const fn = { node: node, parent: ctx.scope.owner, captures: [], params: [] };

    ctx.state.functions.push(fn);
    const inner = makeScope('function', ctx.scope, fn);

    inner.id = 's' + ctx.state.scopes.length;
    ctx.state.scopes.push(inner);
    ctx.scope.children.push(inner);
    params.forEach(function (param) {
      param.binding = declare(ctx.state, inner,
        { name: param.name, span: param.span, kind: 'param' });
      fn.params.push(param.binding);
    });
    node.fn = fn;
    walkNode(body, Object.assign({}, ctx, { scope: inner }));
  }

  function walkImport(node, ctx) {
    const exported = MODULES[node.name];

    if (!exported) {
      ctx.state.errors.push({ code: 'E-RESOLVE-MODULE',
        message: 'there is no module named ' + node.name, span: node.span });
      return;
    }
    node.binding = declare(ctx.state, ctx.scope,
      { name: node.name, span: node.span, kind: 'module' });
    node.binding.exports = exported.slice();
  }

  function walkFor(node, ctx) {
    walkNode(node.iterable, ctx);
    const inner = pushScope(ctx, 'for');

    node.binding = declare(ctx.state, inner,
      { name: node.name, span: node.span, kind: 'loop' });
    walkNode(node.body, Object.assign({}, ctx, { scope: inner }));
  }

  function walkMatch(node, ctx) {
    walkNode(node.subject, ctx);
    node.arms.forEach(function (arm) {
      const inner = pushScope(ctx, 'arm');
      const armCtx = Object.assign({}, ctx, { scope: inner });

      bindPattern(arm.pattern, armCtx);
      if (arm.guard) walkNode(arm.guard, armCtx);
      walkNode(arm.body, armCtx);
    });
  }

  /** A pattern binds its names; a constructor pattern's head is not a binding. */
  function bindPattern(pattern, ctx) {
    if (!pattern) return;
    if (pattern.kind === 'patternName') {
      pattern.binding = declare(ctx.state, ctx.scope,
        { name: pattern.name, span: pattern.span, kind: 'pattern' });
      return;
    }
    if (pattern.kind === 'patternCtor') {
      pattern.args.forEach(function (arg) { bindPattern(arg, ctx); });
      return;
    }
    if (pattern.kind === 'patternRecord') {
      pattern.fields.forEach(function (field) { bindPattern(field.pattern, ctx); });
    }
  }

  /* ---------------------------------------------------------- the entry */

  function resolve(tree) {
    const state = makeState();
    const global = makeScope('global', null, null);

    global.id = 's0';
    state.scopes.push(global);
    BUILTINS.forEach(function (name) {
      declare(state, global, { name: name, span: { start: 0, end: 0 }, kind: 'builtin' });
    });
    walkNode(tree, { state: state, scope: global });
    return finish(state, global);
  }

  function finish(state, global) {
    const byNode = new Map();

    state.references.forEach(function (reference) { byNode.set(reference.node, reference); });
    return { global: global, scopes: state.scopes, bindings: state.bindings,
      references: state.references, errors: state.errors, functions: state.functions,
      byNode: byNode,
      bindingOf: function (node) {
        const found = byNode.get(node);

        return found ? found.binding : null;
      },
      captured: state.bindings.filter(function (entry) { return entry.captured; }) };
  }

  /** Every reference to the binding a node refers to — what rename needs. */
  function referencesOf(table, node) {
    const binding = table.bindingOf(node);

    if (!binding) return [];
    return binding.references.map(function (reference) { return reference.span; });
  }

  /** The scope tree, flattened for display. */
  function scopeRows(table) {
    const rows = [];

    walkScope(table.global, 0, rows);
    return rows;
  }

  function walkScope(entry, depth, rows) {
    rows.push({ id: entry.id, kind: entry.kind, depth: depth,
      bindings: entry.order.filter(function (binding) {
        return binding.kind !== 'builtin';
      }).map(function (binding) {
        return { name: binding.name, kind: binding.kind, uses: binding.references.length,
          captured: binding.captured };
      }) });
    entry.children.forEach(function (child) { walkScope(child, depth + 1, rows); });
  }

  function summary(table) {
    return { scopes: table.scopes.length,
      bindings: table.bindings.filter(function (entry) {
        return entry.kind !== 'builtin';
      }).length,
      references: table.references.length,
      captured: table.captured.length,
      unresolved: table.errors.filter(function (entry) {
        return entry.code === 'E-RESOLVE-UNBOUND';
      }).length,
      functions: table.functions.length };
  }

  return {
    MODULES: MODULES, BUILTINS: BUILTINS,
    resolve: resolve, referencesOf: referencesOf, scopeRows: scopeRows,
    summary: summary, distance: distance, closest: closest
  };
}));
