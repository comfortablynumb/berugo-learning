/**
 * Bidirectional type checking for Berugo, over Hindley–Milner inference.
 *
 * Two modes, and knowing which one you are in is most of the design. In INFER
 * mode the checker works out a type from the term; in CHECK mode it is handed
 * an expected type and pushes it inward. An annotation switches infer to check,
 * and that is what annotations are for — not to help the algorithm, which
 * could often manage without them, but to give the error message somewhere to
 * point.
 *
 * Which is the other half of the design. When unification fails, the message
 * is only useful if it carries BOTH spans: where the type came from, and where
 * it was required. "Cannot unify a with b" names neither. Every mismatch here
 * records the expression's span and the span of whatever imposed the
 * expectation, and the section shows them together.
 *
 * The type table is a compiler artefact, not a scratchpad: a type per node,
 * keyed by node, ready for the optimiser and the editor to read.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Typecheck = api;
  }
}(this, function () {
  'use strict';

  /* -------------------------------------------------------------- types */

  function con(name, args) { return { k: 'con', name: name, args: args || [] }; }
  function variable(name) { return { k: 'var', name: name }; }
  function arrow(params, result) { return { k: 'arrow', params: params, result: result }; }
  function record(fields) { return { k: 'record', fields: fields }; }

  const NUMBER = con('Number');
  const BOOL = con('Bool');
  const STRING = con('String');
  const UNIT = con('Unit');

  function show(type) {
    if (type.k === 'var') return type.name;
    if (type.k === 'arrow') {
      return '(' + type.params.map(show).join(', ') + ') -> ' + show(type.result);
    }
    if (type.k === 'record') {
      const names = Object.keys(type.fields).sort();

      return '{ ' + names.map(function (name) {
        return name + ': ' + show(type.fields[name]);
      }).join(', ') + ' }';
    }
    if (type.args.length === 0) return type.name;
    return type.name + ' ' + type.args.map(show).join(' ');
  }

  function freeVars(type, into) {
    const found = into || [];

    if (type.k === 'var') {
      if (found.indexOf(type.name) === -1) found.push(type.name);
      return found;
    }
    if (type.k === 'arrow') {
      type.params.forEach(function (part) { freeVars(part, found); });
      return freeVars(type.result, found);
    }
    if (type.k === 'record') {
      Object.keys(type.fields).forEach(function (name) { freeVars(type.fields[name], found); });
      return found;
    }
    type.args.forEach(function (part) { freeVars(part, found); });
    return found;
  }

  function apply(sub, type) {
    if (type.k === 'var') return sub[type.name] === undefined ? type : sub[type.name];
    if (type.k === 'arrow') {
      return arrow(type.params.map(function (part) { return apply(sub, part); }),
        apply(sub, type.result));
    }
    if (type.k === 'record') return applyRecord(sub, type);
    return con(type.name, type.args.map(function (part) { return apply(sub, part); }));
  }

  function applyRecord(sub, type) {
    const fields = {};

    Object.keys(type.fields).forEach(function (name) {
      fields[name] = apply(sub, type.fields[name]);
    });
    return record(fields);
  }

  function compose(outer, inner) {
    const out = {};

    Object.keys(inner).forEach(function (name) { out[name] = apply(outer, inner[name]); });
    Object.keys(outer).forEach(function (name) {
      if (out[name] === undefined) out[name] = outer[name];
    });
    return out;
  }

  /* --------------------------------------------------------- unification */

  function unify(left, right) {
    if (left.k === 'var') return bind(left.name, right);
    if (right.k === 'var') return bind(right.name, left);
    if (left.k === 'arrow' && right.k === 'arrow') return unifyArrow(left, right);
    if (left.k === 'record' && right.k === 'record') return unifyRecord(left, right);
    if (left.k === 'con' && right.k === 'con') return unifyCon(left, right);
    return { ok: false, why: 'cannot match ' + show(left) + ' with ' + show(right) };
  }

  function bind(name, type) {
    if (type.k === 'var' && type.name === name) return { ok: true, sub: {} };
    if (freeVars(type, []).indexOf(name) !== -1) {
      return { ok: false, occurs: true,
        why: name + ' would have to contain itself, so this type is infinite' };
    }
    const sub = {};

    sub[name] = type;
    return { ok: true, sub: sub };
  }

  function unifyArrow(left, right) {
    if (left.params.length !== right.params.length) {
      return { ok: false, why: 'this takes ' + left.params.length + ' argument'
        + (left.params.length === 1 ? '' : 's') + ' and was given '
        + right.params.length };
    }
    return unifyAll(left.params.concat([left.result]),
      right.params.concat([right.result]));
  }

  function unifyAll(lefts, rights) {
    let sub = {};

    for (let i = 0; i < lefts.length; i += 1) {
      const step = unify(apply(sub, lefts[i]), apply(sub, rights[i]));

      if (!step.ok) return step;
      sub = compose(step.sub, sub);
    }
    return { ok: true, sub: sub };
  }

  function unifyCon(left, right) {
    if (left.name !== right.name || left.args.length !== right.args.length) {
      return { ok: false, why: 'cannot match ' + show(left) + ' with ' + show(right) };
    }
    return unifyAll(left.args, right.args);
  }

  /** Records are structural, and a missing field says which. */
  function unifyRecord(left, right) {
    const names = Object.keys(right.fields);
    const missing = names.filter(function (name) {
      return left.fields[name] === undefined;
    });

    if (missing.length > 0) {
      return { ok: false, field: missing[0],
        why: show(left) + ' has no field named ' + missing[0] };
    }
    return unifyAll(names.map(function (name) { return left.fields[name]; }),
      names.map(function (name) { return right.fields[name]; }));
  }

  /* ------------------------------------------------------------- context */

  function makeState() {
    return { sub: {}, next: 0, errors: [], types: new Map(), constraints: [] };
  }

  function fresh(state) {
    const name = 't' + state.next;

    state.next += 1;
    return variable(name);
  }

  function record_(state, node, type) {
    state.types.set(node, type);
    return type;
  }

  function resolveType(state, type) { return apply(state.sub, type); }

  /**
   * Every failure carries two spans: `span` is the expression, `from` is
   * whatever imposed the expectation. That pair is the difference between a
   * message a reader can act on and one they cannot.
   */
  function mismatch(state, spec) {
    state.errors.push({ code: spec.code || 'E-TYPE-MISMATCH', message: spec.message,
      span: spec.span, related: spec.from || null,
      expected: spec.expected ? show(spec.expected) : '',
      actual: spec.actual ? show(spec.actual) : '' });
  }

  /** Solve one constraint, recording it so the demo can print the order. */
  function require_(state, spec) {
    const left = resolveType(state, spec.actual);
    const right = resolveType(state, spec.expected);
    const out = unify(left, right);

    state.constraints.push({ actual: show(left), expected: show(right),
      span: spec.span, ok: out.ok, why: out.why || '' });
    if (out.ok) {
      state.sub = compose(out.sub, state.sub);
      return true;
    }
    mismatch(state, { code: spec.code, span: spec.span, from: spec.from,
      expected: right, actual: left,
      message: spec.message || out.why });
    return false;
  }

  /* ------------------------------------------------------------ schemes */

  function monomorphic(type) { return { quantified: [], body: type }; }

  function generalise(state, env, type) {
    const bound = [];

    Object.keys(env).forEach(function (name) {
      freeVars(resolveType(state, env[name].body), bound);
    });
    const free = freeVars(resolveType(state, type), []).filter(function (name) {
      return bound.indexOf(name) === -1;
    });

    return { quantified: free, body: resolveType(state, type) };
  }

  function instantiate(state, scheme) {
    const sub = {};

    scheme.quantified.forEach(function (name) { sub[name] = fresh(state); });
    return apply(sub, scheme.body);
  }

  /** The names available with no import, and the one sum type v1 has. */
  function baseEnvironment(state) {
    const a = 'a';

    return {
      print: monomorphic(arrow([variable(a)], UNIT)),
      some: { quantified: [a], body: arrow([variable(a)], con('Option', [variable(a)])) },
      none: { quantified: [a], body: con('Option', [variable(a)]) },
      len: { quantified: [a], body: arrow([con('Array', [variable(a)])], NUMBER) }
    };
  }

  const MODULE_TYPES = {
    math: { square: arrow([NUMBER], NUMBER), abs: arrow([NUMBER], NUMBER),
      max: arrow([NUMBER, NUMBER], NUMBER) },
    text: { length: arrow([STRING], NUMBER), upper: arrow([STRING], STRING) },
    list: { map: arrow([con('Array', [variable('a')]),
      arrow([variable('a')], variable('b'))], con('Array', [variable('b')])),
    len: arrow([con('Array', [variable('a')])], NUMBER) }
  };

  /* --------------------------------------------------------- annotations */

  function fromAnnotation(node, state) {
    if (!node) return null;
    if (node.kind === 'typeName') return namedType(node.name, state);
    if (node.kind === 'typeArray') return con('Array', [fromAnnotation(node.item, state)]);
    if (node.kind === 'typeArrow') {
      return arrow([fromAnnotation(node.from, state)], fromAnnotation(node.to, state));
    }
    const fields = {};

    node.fields.forEach(function (entry) {
      fields[entry.name] = fromAnnotation(entry.type, state);
    });
    return record(fields);
  }

  const NAMED = { Number: NUMBER, Bool: BOOL, String: STRING, Unit: UNIT };

  function namedType(name, state) {
    if (NAMED[name]) return NAMED[name];
    if (name === 'Option') return con('Option', [fresh(state)]);
    return variable(name);
  }

  /* --------------------------------------------------------- the checker */

  const OPERATOR_TYPES = {
    '+': [NUMBER, NUMBER, NUMBER], '-': [NUMBER, NUMBER, NUMBER],
    '*': [NUMBER, NUMBER, NUMBER], '/': [NUMBER, NUMBER, NUMBER],
    '%': [NUMBER, NUMBER, NUMBER],
    '<': [NUMBER, NUMBER, BOOL], '<=': [NUMBER, NUMBER, BOOL],
    '>': [NUMBER, NUMBER, BOOL], '>=': [NUMBER, NUMBER, BOOL],
    '&&': [BOOL, BOOL, BOOL], '||': [BOOL, BOOL, BOOL]
  };

  const INFER = {
    num: function (node, ctx) { return record_(ctx.state, node, NUMBER); },
    str: function (node, ctx) { return record_(ctx.state, node, STRING); },
    bool: function (node, ctx) { return record_(ctx.state, node, BOOL); },
    unit: function (node, ctx) { return record_(ctx.state, node, UNIT); },
    error: function (node, ctx) { return record_(ctx.state, node, fresh(ctx.state)); },
    name: function (node, ctx) { return inferName(node, ctx); },
    unary: function (node, ctx) { return inferUnary(node, ctx); },
    binary: function (node, ctx) { return inferBinary(node, ctx); },
    call: function (node, ctx) { return inferCall(node, ctx); },
    field: function (node, ctx) { return inferField(node, ctx); },
    index: function (node, ctx) { return inferIndex(node, ctx); },
    array: function (node, ctx) { return inferArray(node, ctx); },
    record: function (node, ctx) { return inferRecord(node, ctx); },
    lambda: function (node, ctx) { return inferLambda(node, ctx); },
    ifExpr: function (node, ctx) { return inferIf(node, ctx); },
    matchExpr: function (node, ctx) { return inferMatch(node, ctx); },
    block: function (node, ctx) { return inferBlock(node, ctx); }
  };

  function infer(node, ctx) {
    const handler = INFER[node.kind];

    if (!handler) return record_(ctx.state, node, UNIT);
    return handler(node, ctx);
  }

  /**
   * Check mode: infer, then require the result to match. Pushing the expected
   * type inward would give better messages for lambdas, and this is the point
   * where a production checker would; keeping it uniform here means the
   * `from` span is always the annotation, which is the span a reader wants.
   */
  function check(node, expected, ctx, spec) {
    const actual = infer(node, ctx);
    const solved = require_(ctx.state, { actual: actual, expected: expected, span: node.span,
      from: spec ? spec.from : null, code: spec ? spec.code : undefined,
      message: spec ? spec.message : undefined });

    /* On success the two are the same type after substitution and recording
       the expected one is the more resolved of the two. On FAILURE they are
       not, and recording the expectation makes the type table state something
       false about the node: hover over the Bool in `n + flag` and be told it
       is a Number. The table is a compiler artefact other tools read, so it
       reports what the node has, not what was wanted of it. */
    return record_(ctx.state, node,
      resolveType(ctx.state, solved ? expected : actual));
  }

  function inferName(node, ctx) {
    const scheme = ctx.env[node.name];

    if (!scheme) return record_(ctx.state, node, fresh(ctx.state));
    return record_(ctx.state, node, instantiate(ctx.state, scheme));
  }

  function inferUnary(node, ctx) {
    const wanted = node.op === '!' ? BOOL : NUMBER;

    check(node.operand, wanted, ctx,
      { from: node.span, message: node.op + ' needs a ' + show(wanted) });
    return record_(ctx.state, node, wanted);
  }

  function inferBinary(node, ctx) {
    if (node.op === '==' || node.op === '!=') return inferEquality(node, ctx);
    const shape = OPERATOR_TYPES[node.op];

    check(node.left, shape[0], ctx,
      { from: node.span, message: node.op + ' needs a ' + show(shape[0]) + ' on the left' });
    check(node.right, shape[1], ctx,
      { from: node.span, message: node.op + ' needs a ' + show(shape[1]) + ' on the right' });
    return record_(ctx.state, node, shape[2]);
  }

  function inferEquality(node, ctx) {
    const left = infer(node.left, ctx);
    const right = infer(node.right, ctx);

    require_(ctx.state, { actual: right, expected: left, span: node.right.span,
      from: node.left.span, code: 'E-TYPE-COMPARE',
      message: 'the two sides of ' + node.op + ' must have the same type' });
    return record_(ctx.state, node, BOOL);
  }

  function inferCall(node, ctx) {
    const callee = infer(node.callee, ctx);
    const args = node.args.map(function (arg) { return infer(arg, ctx); });
    const result = fresh(ctx.state);

    require_(ctx.state, { actual: callee, expected: arrow(args, result),
      span: node.span, from: node.callee.span, code: 'E-TYPE-CALL',
      message: callDescription(ctx, callee, args) });
    return record_(ctx.state, node, resolveType(ctx.state, result));
  }

  /**
   * Say which argument disagrees, not merely that something did. Reporting an
   * arity mismatch when the arities match and one type does not is the sort of
   * message that sends a reader to the wrong line.
   */
  function callDescription(ctx, callee, args) {
    const solved = resolveType(ctx.state, callee);

    if (solved.k !== 'arrow') return show(solved) + ' is not something you can call';
    if (solved.params.length !== args.length) {
      return 'this call passes ' + args.length + ' argument'
        + (args.length === 1 ? '' : 's') + ' to something taking '
        + solved.params.length;
    }
    return firstArgumentProblem(ctx, solved, args)
      || 'the argument types do not fit this function';
  }

  function firstArgumentProblem(ctx, solved, args) {
    for (let i = 0; i < args.length; i += 1) {
      const given = resolveType(ctx.state, args[i]);

      if (unify(given, resolveType(ctx.state, solved.params[i])).ok) continue;
      return 'argument ' + (i + 1) + ' is ' + show(given) + ' where '
        + show(resolveType(ctx.state, solved.params[i])) + ' was required';
    }
    return null;
  }

  function inferField(node, ctx) {
    const object = resolveType(ctx.state, infer(node.object, ctx));
    const result = fresh(ctx.state);

    if (object.k === 'record' && object.fields[node.name] === undefined) {
      mismatch(ctx.state, { code: 'E-TYPE-FIELD', span: node.span, from: node.object.span,
        actual: object,
        message: show(object) + ' has no field named ' + node.name });
      return record_(ctx.state, node, result);
    }
    const fields = {};

    fields[node.name] = result;
    require_(ctx.state, { actual: object, expected: record(fields), span: node.span,
      from: node.object.span, code: 'E-TYPE-FIELD',
      message: 'this needs a record with a field named ' + node.name });
    return record_(ctx.state, node, resolveType(ctx.state, result));
  }

  function inferIndex(node, ctx) {
    const item = fresh(ctx.state);

    check(node.object, con('Array', [item]), ctx,
      { from: node.span, code: 'E-TYPE-INDEX', message: 'only an array can be indexed' });
    check(node.key, NUMBER, ctx,
      { from: node.span, code: 'E-TYPE-INDEX', message: 'an index must be a Number' });
    return record_(ctx.state, node, resolveType(ctx.state, item));
  }

  function inferArray(node, ctx) {
    const item = node.items.length === 0 ? fresh(ctx.state) : infer(node.items[0], ctx);

    node.items.slice(1).forEach(function (entry) {
      check(entry, item, ctx, { from: node.items[0].span, code: 'E-TYPE-ARRAY',
        message: 'every element of an array must have the same type' });
    });
    return record_(ctx.state, node, con('Array', [resolveType(ctx.state, item)]));
  }

  function inferRecord(node, ctx) {
    const fields = {};

    node.fields.forEach(function (entry) {
      fields[entry.name] = infer(entry.value, ctx);
      record_(ctx.state, entry, fields[entry.name]);
    });
    return record_(ctx.state, node, record(fields));
  }

  function inferLambda(node, ctx) {
    const inner = Object.assign({}, ctx.env);
    const params = node.params.map(function (param) {
      const declared = fromAnnotation(param.annotation, ctx.state) || fresh(ctx.state);

      inner[param.name] = monomorphic(declared);
      return declared;
    });
    const body = infer(node.body, Object.assign({}, ctx, { env: inner }));

    return record_(ctx.state, node,
      arrow(params.map(function (part) { return resolveType(ctx.state, part); }),
        resolveType(ctx.state, body)));
  }

  function inferIf(node, ctx) {
    check(node.test, BOOL, ctx, { from: node.span, code: 'E-TYPE-CONDITION',
      message: 'the condition of an if must be a Bool' });
    const then = infer(node.then, ctx);
    const other = infer(node.other, ctx);

    require_(ctx.state, { actual: other, expected: then, span: node.other.span,
      from: node.then.span, code: 'E-TYPE-BRANCHES',
      message: 'both branches of an if must have the same type' });
    return record_(ctx.state, node, resolveType(ctx.state, then));
  }

  function inferBlock(node, ctx) {
    const inner = Object.assign({}, ctx, { env: Object.assign({}, ctx.env) });

    node.statements.forEach(function (statement) { checkStatement(statement, inner); });
    const type = node.tail ? infer(node.tail, inner) : UNIT;

    return record_(ctx.state, node, resolveType(ctx.state, type));
  }

  /* ------------------------------------------------------------- match */

  function inferMatch(node, ctx) {
    const subject = infer(node.subject, ctx);
    let result = null;

    node.arms.forEach(function (arm) {
      const inner = Object.assign({}, ctx, { env: Object.assign({}, ctx.env) });

      bindPattern(arm.pattern, subject, inner);
      if (arm.guard) {
        check(arm.guard, BOOL, inner, { from: arm.span, code: 'E-TYPE-GUARD',
          message: 'a match guard must be a Bool' });
      }
      result = checkArmBody(arm, result, inner, node);
    });
    checkExhaustive(node, resolveType(ctx.state, subject), ctx);
    return record_(ctx.state, node, resolveType(ctx.state, result || UNIT));
  }

  function checkArmBody(arm, result, inner, node) {
    const body = infer(arm.body, inner);

    if (result === null) return body;
    require_(inner.state, { actual: body, expected: result, span: arm.body.span,
      from: node.arms[0].body.span, code: 'E-TYPE-ARMS',
      message: 'every arm of a match must have the same type' });
    return result;
  }

  const PATTERN_TYPES = {
    some: function (state) {
      const item = fresh(state);

      return { subject: con('Option', [item]), args: [item] };
    },
    none: function (state) {
      return { subject: con('Option', [fresh(state)]), args: [] };
    }
  };

  function bindPattern(pattern, expected, ctx) {
    if (!pattern) return;
    if (pattern.kind === 'patternWild') return;
    if (pattern.kind === 'patternName') {
      ctx.env[pattern.name] = monomorphic(expected);
      return;
    }
    if (pattern.kind === 'patternLiteral') { bindLiteral(pattern, expected, ctx); return; }
    if (pattern.kind === 'patternCtor') { bindCtor(pattern, expected, ctx); return; }
    if (pattern.kind === 'patternRecord') bindRecordPattern(pattern, expected, ctx);
  }

  function bindLiteral(pattern, expected, ctx) {
    const type = typeof pattern.value === 'number' ? NUMBER
      : (typeof pattern.value === 'boolean' ? BOOL : STRING);

    require_(ctx.state, { actual: type, expected: expected, span: pattern.span,
      code: 'E-TYPE-PATTERN', message: 'this pattern cannot match a ' + show(expected) });
  }

  function bindCtor(pattern, expected, ctx) {
    const shape = PATTERN_TYPES[pattern.name];

    if (!shape) {
      mismatch(ctx.state, { code: 'E-TYPE-PATTERN', span: pattern.span,
        message: 'there is no constructor named ' + pattern.name });
      return;
    }
    const built = shape(ctx.state);

    require_(ctx.state, { actual: built.subject, expected: expected, span: pattern.span,
      code: 'E-TYPE-PATTERN',
      message: 'this pattern matches ' + show(built.subject) + ', not ' + show(expected) });
    pattern.args.forEach(function (arg, index) {
      bindPattern(arg, resolveType(ctx.state, built.args[index] || fresh(ctx.state)), ctx);
    });
  }

  function bindRecordPattern(pattern, expected, ctx) {
    const fields = {};

    pattern.fields.forEach(function (entry) {
      fields[entry.name] = fresh(ctx.state);
    });
    require_(ctx.state, { actual: expected, expected: record(fields), span: pattern.span,
      code: 'E-TYPE-PATTERN', message: 'this record pattern does not fit the subject' });
    pattern.fields.forEach(function (entry) {
      bindPattern(entry.pattern, resolveType(ctx.state, fields[entry.name]), ctx);
    });
  }

  /**
   * Exhaustiveness, in the one-column case of M27's usefulness relation: a
   * match over a closed sum is complete when every constructor is covered or
   * some pattern is irrefutable. A guard makes an arm refutable, so an arm
   * with one does not count as covering its constructor — a rule that is easy
   * to get wrong and produces a silent runtime hole when you do.
   */
  const CONSTRUCTORS = { Option: ['some', 'none'], Bool: ['true', 'false'] };

  function checkExhaustive(node, subject, ctx) {
    const closed = CONSTRUCTORS[subject.name];

    if (!closed || subject.k !== 'con') return;
    const unguarded = node.arms.filter(function (arm) { return !arm.guard; });

    if (unguarded.some(function (arm) { return irrefutable(arm.pattern); })) return;
    const covered = unguarded.map(function (arm) { return coveredName(arm.pattern); })
      .filter(Boolean);
    const missing = closed.filter(function (name) { return covered.indexOf(name) === -1; });

    if (missing.length === 0) return;
    mismatch(ctx.state, { code: 'E-TYPE-EXHAUSTIVE', span: node.span,
      message: 'this match does not handle ' + missing.join(' or ')
        + ' — a value like ' + witness(missing[0]) + ' would fall through' });
  }

  function irrefutable(pattern) {
    return pattern.kind === 'patternWild' || pattern.kind === 'patternName';
  }

  function coveredName(pattern) {
    if (pattern.kind === 'patternCtor') return pattern.name;
    if (pattern.kind === 'patternLiteral' && typeof pattern.value === 'boolean') {
      return pattern.value ? 'true' : 'false';
    }
    return null;
  }

  const WITNESS = { some: 'some(…)', none: 'none', true: 'true', false: 'false' };

  function witness(name) { return WITNESS[name] || name; }

  /* -------------------------------------------------------- statements */

  const STATEMENTS = {
    letDecl: function (node, ctx) { checkLet(node, ctx); },
    fnDecl: function (node, ctx) { checkFnDecl(node, ctx); },
    importDecl: function (node, ctx) { checkImport(node, ctx); },
    exprStmt: function (node, ctx) { infer(node.expr, ctx); },
    assign: function (node, ctx) { checkAssign(node, ctx); },
    whileStmt: function (node, ctx) { checkWhile(node, ctx); },
    forStmt: function (node, ctx) { checkFor(node, ctx); },
    returnStmt: function (node, ctx) { if (node.value) infer(node.value, ctx); },
    breakStmt: function () { return null; },
    continueStmt: function () { return null; },
    error: function () { return null; }
  };

  /**
   * A statement that produces no value has type Unit, and recording that is
   * not bookkeeping: `lastType` reads the table to report the program's type,
   * and a statement with no entry would make it report the type of whatever
   * came before — so a program ending in a loop would claim to be a Number.
   */
  const VALUELESS = ['whileStmt', 'forStmt', 'assign', 'breakStmt', 'continueStmt',
    'returnStmt', 'exprStmt'];

  function checkStatement(node, ctx) {
    const handler = STATEMENTS[node.kind];

    if (!handler) { infer(node, ctx); return; }
    handler(node, ctx);
    if (VALUELESS.indexOf(node.kind) !== -1) record_(ctx.state, node, UNIT);
  }

  function checkLet(node, ctx) {
    const declared = fromAnnotation(node.annotation, ctx.state);

    if (declared) {
      check(node.value, declared, ctx, { from: node.annotation.span,
        code: 'E-TYPE-ANNOTATION',
        message: 'this value does not match its annotation' });
      ctx.env[node.name] = monomorphic(declared);
      record_(ctx.state, node, declared);
      return;
    }
    const inferred = infer(node.value, ctx);

    ctx.env[node.name] = generalise(ctx.state, ctx.env, inferred);
    record_(ctx.state, node, resolveType(ctx.state, inferred));
  }

  /**
   * A function is added to the environment before its body is checked, so it
   * can call itself; the recursive occurrence is monomorphic, which is the
   * standard restriction and the reason polymorphic recursion needs an
   * annotation in every language that has this rule.
   */
  function checkFnDecl(node, ctx) {
    const params = node.params.map(function (param) {
      return fromAnnotation(param.annotation, ctx.state) || fresh(ctx.state);
    });
    const result = fresh(ctx.state);
    const inner = Object.assign({}, ctx.env);

    ctx.env[node.name] = monomorphic(arrow(params, result));
    node.params.forEach(function (param, index) {
      inner[param.name] = monomorphic(params[index]);
    });
    inner[node.name] = ctx.env[node.name];
    checkFunctionBody(node, result, Object.assign({}, ctx, { env: inner }));
    delete ctx.env[node.name];
    ctx.env[node.name] = generalise(ctx.state, ctx.env, arrow(params, result));
    record_(ctx.state, node, resolveType(ctx.state, arrow(params, result)));
  }

  /**
   * The environment maps names to SCHEMES, and nothing else may live in it.
   * A sentinel stored here under a reserved key crashed generalisation on the
   * first function containing a let: generalise walks every key and reads
   * .body off the value, and the sentinel had none. No conformance program had
   * a let inside a function, so fifteen green rows said nothing about it.
   */
  function checkFunctionBody(node, result, ctx) {
    const returns = collectReturns(node.body);

    infer(node.body, ctx);
    returns.forEach(function (statement) {
      const value = statement.value ? ctx.state.types.get(statement.value) : UNIT;

      require_(ctx.state, { actual: value || UNIT, expected: result,
        span: statement.span, from: node.span, code: 'E-TYPE-RETURN',
        message: 'every return in a function must have the same type' });
    });
    if (returns.length === 0) {
      require_(ctx.state, { actual: ctx.state.types.get(node.body) || UNIT,
        expected: result, span: node.span, code: 'E-TYPE-RETURN',
        message: 'this function falls off the end' });
    }
  }

  function collectReturns(body) {
    const found = [];
    const walk = function (node) {
      if (!node || !node.kind) return;
      if (node.kind === 'returnStmt') { found.push(node); return; }
      if (node.kind === 'lambda' || node.kind === 'fnDecl') return;
      (node.statements || []).forEach(walk);
      ['then', 'other', 'body', 'tail'].forEach(function (slot) { walk(node[slot]); });
    };

    walk(body);
    return found;
  }

  function checkImport(node, ctx) {
    const exported = MODULE_TYPES[node.name];

    if (!exported) return;
    const fields = {};

    Object.keys(exported).forEach(function (name) { fields[name] = exported[name]; });
    ctx.env[node.name] = monomorphic(record(fields));
    record_(ctx.state, node, ctx.env[node.name].body);
  }

  function checkAssign(node, ctx) {
    const target = infer(node.target, ctx);

    check(node.value, target, ctx, { from: node.target.span, code: 'E-TYPE-ASSIGN',
      message: 'this assignment changes the type of the variable' });
  }

  function checkWhile(node, ctx) {
    check(node.test, BOOL, ctx, { from: node.span, code: 'E-TYPE-CONDITION',
      message: 'the condition of a while must be a Bool' });
    infer(node.body, ctx);
  }

  function checkFor(node, ctx) {
    const item = fresh(ctx.state);

    check(node.iterable, con('Array', [item]), ctx, { from: node.span,
      code: 'E-TYPE-ITERABLE', message: 'a for loop needs an array to walk' });
    const inner = Object.assign({}, ctx, { env: Object.assign({}, ctx.env) });

    inner.env[node.name] = monomorphic(resolveType(ctx.state, item));
    infer(node.body, inner);
  }

  /* ---------------------------------------------------------- the entry */

  function typecheck(tree) {
    const state = makeState();
    const env = baseEnvironment(state);
    const ctx = { state: state, env: env };

    tree.items.forEach(function (item) { checkStatement(item, ctx); });
    return finish(state, tree, ctx);
  }

  function finish(state, tree, ctx) {
    const types = new Map();

    state.types.forEach(function (type, node) { types.set(node, apply(state.sub, type)); });
    return { types: types, errors: state.errors, constraints: state.constraints,
      variables: state.next, env: ctx.env,
      typeOf: function (node) {
        const found = types.get(node);

        return found ? show(found) : '';
      },
      last: lastType(tree, types) };
  }

  function lastType(tree, types) {
    for (let i = tree.items.length - 1; i >= 0; i -= 1) {
      const found = types.get(tree.items[i]);

      if (found) return show(found);
    }
    return 'Unit';
  }

  return {
    con: con, variable: variable, arrow: arrow, record: record,
    NUMBER: NUMBER, BOOL: BOOL, STRING: STRING, UNIT: UNIT,
    show: show, unify: unify, apply: apply, compose: compose, freeVars: freeVars,
    typecheck: typecheck, MODULE_TYPES: MODULE_TYPES, CONSTRUCTORS: CONSTRUCTORS
  };
}));
