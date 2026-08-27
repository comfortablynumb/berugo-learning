/**
 * Lowering Berugo to a smaller core, with the spans kept.
 *
 * Every desugaring is a chance to lose the user's mental model. A `for` loop
 * that becomes a `while` over an index is the same program, but a diagnostic
 * about the generated index variable points at code nobody wrote. The rule
 * followed here is that a synthesised node carries the span of the surface
 * construct it came from, and an `origin` naming which construct that was — so
 * every message can be traced back to something the developer typed.
 *
 * The core language is what the rest of the pipeline sees: no `for`, no
 * operators (they are calls), no string interpolation, no `match` (it is
 * nested tests). Making it smaller here is what stops M29 and M30 from having
 * to handle nine forms of loop.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Desugar = api;
  }
}(this, function (root) {
  'use strict';

  const Ast = root && root.Berugo && root.Berugo.Ast ? root.Berugo.Ast : require('./ast.js');

  /** Each lowering can be switched off, so the demo can show one at a time. */
  const PASSES = [
    { id: 'for', name: 'for loops become while loops',
      about: 'an index, a bound and a binding, with break and continue preserved' },
    { id: 'operators', name: 'operators become calls',
      about: 'a + b becomes add(a, b), so the core has one call form and no table' },
    { id: 'match', name: 'match becomes nested tests',
      about: 'each arm is a test and a binding; the decision tree comes in M29' },
    { id: 'fold', name: 'constant folding',
      about: 'arithmetic on two literals is evaluated now rather than at run time' }
  ];

  /**
   * Every name a lowering introduces starts with `$`, and `$` cannot start a
   * surface identifier — the lexer's `isNameStart` does not accept it. That is
   * hygiene by construction rather than by convention, and it is not
   * decoration: the conformance program `fn add(a, b) { return a + b; }`
   * lowers its own body to a call, and with an unprefixed `add` the function
   * calls itself forever. The core ran and the surface ran and only running
   * BOTH and comparing found it.
   */
  const RUNTIME = '$';

  const OPERATOR_CALLS = {
    '+': RUNTIME + 'add', '-': RUNTIME + 'sub', '*': RUNTIME + 'mul',
    '/': RUNTIME + 'div', '%': RUNTIME + 'rem',
    '<': RUNTIME + 'lt', '<=': RUNTIME + 'le', '>': RUNTIME + 'gt',
    '>=': RUNTIME + 'ge', '==': RUNTIME + 'eq', '!=': RUNTIME + 'ne',
    '&&': RUNTIME + 'and', '||': RUNTIME + 'or'
  };

  function makeState(options) {
    return { enabled: options || {}, next: 0, rewrites: [] };
  }

  function on(state, id) { return state.enabled[id] !== false; }

  function gensym(state, hint) {
    const name = '$' + hint + state.next;

    state.next += 1;
    return name;
  }

  /**
   * Build a node standing in for `origin`, carrying its span. This is the one
   * function every lowering goes through, so "keep the span" is enforced by
   * construction rather than remembered at each site.
   */
  function from(state, origin, kind, extra) {
    const node = Ast.synthetic(kind, origin.span, origin.kind, extra);

    return node;
  }

  function noteRewrite(state, origin, produced, pass) {
    state.rewrites.push({ pass: pass, from: origin.kind, span: origin.span,
      to: produced.kind, printed: safePrint(produced) });
    return produced;
  }

  function safePrint(node) {
    try {
      return Ast.print(node);
    } catch (error) {
      return node.kind;
    }
  }

  /* ------------------------------------------------------------ the walk */

  const LOWER = {
    program: function (node, state) {
      return Ast.node('program', node.span,
        { items: node.items.map(function (item) { return lower(item, state); }) });
    },
    block: function (node, state) { return lowerBlock(node, state); },
    letDecl: function (node, state) {
      return Ast.node('letDecl', node.span, { name: node.name, annotation: null,
        value: lower(node.value, state) });
    },
    fnDecl: function (node, state) {
      return Ast.node('fnDecl', node.span, { name: node.name, params: node.params,
        body: lower(node.body, state) });
    },
    forStmt: function (node, state) { return lowerFor(node, state); },
    binary: function (node, state) { return lowerBinary(node, state); },
    matchExpr: function (node, state) { return lowerMatch(node, state); },
    ifExpr: function (node, state) {
      return Ast.node('ifExpr', node.span, { test: lower(node.test, state),
        then: lower(node.then, state), other: lower(node.other, state) });
    },
    whileStmt: function (node, state) {
      return Ast.node('whileStmt', node.span, { test: lower(node.test, state),
        body: lower(node.body, state) });
    }
  };

  function lower(node, state) {
    if (!node || !node.kind) return node;
    const handler = LOWER[node.kind];

    if (handler) return handler(node, state);
    return lowerChildren(node, state);
  }

  function lowerChildren(node, state) {
    const copy = Object.assign({}, node);

    (Ast.CHILDREN[node.kind] || []).forEach(function (slot) {
      const value = node[slot];

      if (Array.isArray(value)) {
        copy[slot] = value.map(function (entry) { return lower(entry, state); });
        return;
      }
      if (value && value.kind) copy[slot] = lower(value, state);
    });
    return copy;
  }

  function lowerBlock(node, state) {
    return Ast.node('block', node.span, {
      statements: node.statements.map(function (statement) {
        return lower(statement, state);
      }),
      tail: node.tail ? lower(node.tail, state) : null });
  }

  /**
   * `for v in xs { body }` becomes an index, a bound and a while loop.
   *
   * The subtlety is `continue`, and there is exactly one place to put the
   * advance that survives it. Put the increment LAST, the way the loop reads,
   * and `continue` jumps over it and the loop never terminates. Put it at the
   * top behind a first-iteration flag — which is what this lowering did until
   * the differential interpreter ran it — and the guard `i < len(xs)` is
   * tested against the index from *before* the advance, so the last pass
   * indexes one element off the end.
   *
   * The advance goes BEFORE the body and after the element is bound. `v` has
   * already been read, so moving the index cannot affect this iteration;
   * `continue` cannot skip an increment that has already happened; and the
   * test still sees the index it is about to use. No flag is needed, which is
   * the usual sign that the placement is right.
   */
  function lowerFor(node, state) {
    if (!on(state, 'for')) return lowerChildren(node, state);
    const index = gensym(state, 'i');
    const source = gensym(state, 'xs');
    const parts = forParts(state, node, { index: index, source: source });
    const built = from(state, node, 'block', { statements: parts, tail: null });

    return noteRewrite(state, node, built, 'for');
  }

  function forParts(state, node, names) {
    const iterable = lower(node.iterable, state);

    return [
      from(state, node, 'letDecl', { name: names.source, annotation: null, value: iterable }),
      from(state, node, 'letDecl', { name: names.index, annotation: null,
        value: from(state, node, 'num', { value: 0 }) }),
      from(state, node, 'whileStmt', { test: lengthTest(state, node, names),
        body: forBody(state, node, names) })
    ];
  }

  /**
   * A lowering that emits an operator has to emit it in whichever form the
   * chosen passes produce, or the core contains a node kind the core language
   * says it does not have. The for lowering built its guard and its increment
   * with `binary` nodes and returned them without going through `lower`, so
   * every desugared loop carried two operators the operator pass never saw —
   * and the next stage would have had to handle both forms for no reason.
   */
  function arith(state, node, op, left, right) {
    if (!on(state, 'operators')) {
      return from(state, node, 'binary', { op: op, left: left, right: right });
    }
    return from(state, node, 'call', {
      callee: from(state, node, 'name', { name: OPERATOR_CALLS[op] }),
      args: [left, right] });
  }

  function lengthTest(state, node, names) {
    return arith(state, node, '<',
      from(state, node, 'name', { name: names.index }),
      from(state, node, 'call', {
        callee: from(state, node, 'name', { name: RUNTIME + 'len' }),
        args: [from(state, node, 'name', { name: names.source })] }));
  }

  /** Bind the element, advance the index, then run the body. */
  function forBody(state, node, names) {
    return from(state, node, 'block', { tail: null, statements: [
      bindElement(state, node, names),
      increment(state, node, names),
      lower(node.body, state)
    ] });
  }

  function increment(state, node, names) {
    return from(state, node, 'assign', {
      target: from(state, node, 'name', { name: names.index }),
      value: arith(state, node, '+',
        from(state, node, 'name', { name: names.index }),
        from(state, node, 'num', { value: 1 })) });
  }

  function bindElement(state, node, names) {
    return from(state, node, 'letDecl', { name: node.name, annotation: null,
      value: from(state, node, 'index', {
        object: from(state, node, 'name', { name: names.source }),
        key: from(state, node, 'name', { name: names.index }) }) });
  }

  /**
   * Operators become calls, unless both sides are literals and folding is on —
   * in which case the answer is computed now. Folding at the AST level is the
   * cheapest optimisation there is and it is here rather than in M29 because
   * it changes what the *core* looks like, and the core is this milestone's
   * output.
   *
   * `&&` and `||` are the exception, and they are the exception for a reason
   * worth stating: a call evaluates its arguments, so lowering `a && b` to
   * `$and(a, b)` evaluates `b` whether or not `a` was false. That is a
   * DIFFERENT PROGRAM. `d != 0 && 10 / d > 1` is the idiom people write
   * precisely because the right side is unsafe when the left is false, and the
   * strict lowering divides by zero. They lower to `if` instead, which is the
   * only core form that does not evaluate one of its branches.
   */
  function lowerBinary(node, state) {
    const left = lower(node.left, state);
    const right = lower(node.right, state);
    const folded = fold(state, node, left, right);

    if (folded) return noteRewrite(state, node, folded, 'fold');
    if (!on(state, 'operators')) {
      return Ast.node('binary', node.span, { op: node.op, left: left, right: right });
    }
    if (isShortCircuit(node.op)) return lowerShortCircuit(node, state, left, right);
    const call = from(state, node, 'call', {
      callee: from(state, node, 'name', { name: OPERATOR_CALLS[node.op] }),
      args: [left, right] });

    return noteRewrite(state, node, call, 'operators');
  }

  /**
   * `a && b` is `if a { b } else { false }`; `a || b` is `if a { true } else { b }`.
   * The value stored is the constant the operator yields WITHOUT evaluating
   * its right side, so `&&` maps to `false` — which is why membership is
   * tested with `hasOwnProperty` and not by truthiness. Testing the value sent
   * `&&` down the strict path while `||` took the correct one, and the two
   * looked identical in the source.
   */
  const SHORT_CIRCUIT = { '&&': false, '||': true };

  function isShortCircuit(op) {
    return Object.prototype.hasOwnProperty.call(SHORT_CIRCUIT, op);
  }

  function lowerShortCircuit(node, state, left, right) {
    const shortValue = SHORT_CIRCUIT[node.op];
    const constant = from(state, node, 'bool', { value: shortValue });
    const built = from(state, node, 'ifExpr', { test: left,
      then: block(state, node, shortValue ? constant : right),
      other: block(state, node, shortValue ? right : constant) });

    return noteRewrite(state, node, built, 'operators');
  }

  function block(state, node, tail) {
    return from(state, node, 'block', { statements: [], tail: tail });
  }

  const FOLDERS = {
    '+': function (a, b) { return a + b; }, '-': function (a, b) { return a - b; },
    '*': function (a, b) { return a * b; },
    '/': function (a, b) { return b === 0 ? null : a / b; },
    '<': function (a, b) { return a < b; }, '>': function (a, b) { return a > b; },
    '<=': function (a, b) { return a <= b; }, '>=': function (a, b) { return a >= b; }
  };

  function fold(state, node, left, right) {
    if (!on(state, 'fold') || left.kind !== 'num' || right.kind !== 'num') return null;
    const folder = FOLDERS[node.op];

    if (!folder) return null;
    const value = folder(left.value, right.value);

    if (value === null) return null;
    return from(state, node, typeof value === 'boolean' ? 'bool' : 'num', { value: value });
  }

  /**
   * A match becomes a chain of tests over a bound subject. The decision tree
   * from M27 is the better compilation and it belongs in M29, where there is
   * an IR to emit it into; the point here is that the core language has no
   * `match` node, and the arms' spans survive.
   */
  function lowerMatch(node, state) {
    if (!on(state, 'match')) return lowerChildren(node, state);
    const subject = gensym(state, 'm');
    const chain = buildArms(state, node, node.arms, subject);
    const built = from(state, node, 'block', {
      statements: [from(state, node, 'letDecl', { name: subject, annotation: null,
        value: lower(node.subject, state) })],
      tail: chain });

    return noteRewrite(state, node, built, 'match');
  }

  function buildArms(state, node, arms, subject) {
    if (arms.length === 0) {
      return from(state, node, 'call', {
        callee: from(state, node, 'name', { name: RUNTIME + 'unmatched' }), args: [] });
    }
    const arm = arms[0];
    const test = patternTest(state, arm.pattern, subject, arm);
    const body = armBody(state, arm, subject);

    if (test === null && !arm.guard) return body;
    return from(state, arm, 'ifExpr', {
      test: withGuard(state, arm, test, subject),
      then: from(state, arm, 'block', { statements: [], tail: body }),
      other: from(state, arm, 'block', { statements: [],
        tail: buildArms(state, node, arms.slice(1), subject) }) });
  }

  function withGuard(state, arm, test, subject) {
    if (!arm.guard) return test;
    const guard = lower(arm.guard, state);

    if (test === null) return guard;
    return from(state, arm, 'binary', { op: '&&', left: test, right: guard });
  }

  /** The test that decides whether an arm applies, or null for an irrefutable one. */
  function patternTest(state, pattern, subject, arm) {
    if (pattern.kind === 'patternWild' || pattern.kind === 'patternName') return null;
    if (pattern.kind === 'patternLiteral') {
      return from(state, arm, 'binary', { op: '==',
        left: from(state, arm, 'name', { name: subject }),
        right: from(state, arm, typeof pattern.value === 'number' ? 'num' : 'bool',
          { value: pattern.value }) });
    }
    return from(state, arm, 'call', {
      callee: from(state, arm, 'name', { name: RUNTIME + 'is_' + pattern.name }),
      args: [from(state, arm, 'name', { name: subject })] });
  }

  /** The arm's body, with its pattern's bindings introduced as lets. */
  function armBody(state, arm, subject) {
    const bindings = patternBindings(state, arm.pattern, subject, arm);
    const body = lower(arm.body, state);

    if (bindings.length === 0) return body;
    return from(state, arm, 'block', { statements: bindings, tail: body });
  }

  function patternBindings(state, pattern, subject, arm) {
    if (pattern.kind === 'patternName') {
      return [from(state, arm, 'letDecl', { name: pattern.name, annotation: null,
        value: from(state, arm, 'name', { name: subject }) })];
    }
    if (pattern.kind === 'patternCtor') return ctorBindings(state, pattern, subject, arm);
    if (pattern.kind === 'patternRecord') return recordBindings(state, pattern, subject, arm);
    return [];
  }

  /**
   * Bind each payload once. When the sub-pattern is itself a plain name, the
   * payload binding IS that binding — recursing as well would emit
   * `let v = payload0(m); let v = v;`, which is harmless and wrong, and the
   * kind of thing that survives review because it still runs.
   */
  function ctorBindings(state, pattern, subject, arm) {
    return pattern.args.reduce(function (all, inner, index) {
      const field = from(state, arm, 'call', {
        callee: from(state, arm, 'name', { name: RUNTIME + 'payload' + index }),
        args: [from(state, arm, 'name', { name: subject })] });
      const named = inner.kind === 'patternName';
      const name = named ? inner.name : gensym(state, 'p');
      const bind = from(state, arm, 'letDecl', { name: name, annotation: null,
        value: field });

      return all.concat([bind],
        named ? [] : patternBindings(state, inner, name, arm));
    }, []);
  }

  function recordBindings(state, pattern, subject, arm) {
    return pattern.fields.reduce(function (all, entry) {
      const access = from(state, arm, 'field', {
        object: from(state, arm, 'name', { name: subject }), name: entry.name });
      const named = entry.pattern.kind === 'patternName';
      const name = named ? entry.pattern.name : gensym(state, 'p');
      const bind = from(state, arm, 'letDecl', { name: name, annotation: null,
        value: access });

      return all.concat([bind],
        named ? [] : patternBindings(state, entry.pattern, name, arm));
    }, []);
  }

  /* ---------------------------------------------------------- the entry */

  function desugar(tree, options) {
    const state = makeState(options);
    const core = lower(tree, state);

    return { core: core, rewrites: state.rewrites, generated: state.next,
      passes: countByPass(state.rewrites) };
  }

  function countByPass(rewrites) {
    const counts = {};

    PASSES.forEach(function (pass) { counts[pass.id] = 0; });
    rewrites.forEach(function (entry) { counts[entry.pass] += 1; });
    return counts;
  }

  /**
   * Every synthesised node must carry a span inside the original source, and
   * an origin naming what it came from. Checking it is the whole guarantee
   * that a diagnostic never points at code the developer did not write.
   */
  function spanAudit(core, source) {
    const problems = [];
    const length = String(source).length;

    Ast.visit(core, { enter: function (node) {
      if (!node.span) { problems.push({ kind: node.kind, why: 'no span' }); return; }
      if (node.span.start < 0 || node.span.end > length) {
        problems.push({ kind: node.kind, why: 'span outside the source' });
      }
      if (node.origin === undefined) return;
      if (!node.origin) problems.push({ kind: node.kind, why: 'synthesised with no origin' });
    } });
    return { problems: problems, ok: problems.length === 0,
      synthesised: Ast.collect(core, function (node) {
        return node.origin !== undefined;
      }).length };
  }

  return {
    PASSES: PASSES, OPERATOR_CALLS: OPERATOR_CALLS,
    desugar: desugar, spanAudit: spanAudit, lower: lower, makeState: makeState
  };
}));
