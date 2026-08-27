/**
 * Core language to IR: a tree with structured control flow becomes blocks and
 * jumps.
 *
 * The whole content of this file is that `if` and `while` stop being nodes.
 * An `if` becomes three blocks and a two-way branch; a `while` becomes a
 * header, a body and a join, with a back edge. After this, "which code runs
 * before this point" is a question about paths in a graph — which is a
 * question that can be answered, and could not be asked of the tree.
 *
 * Two things are kept from the front end and both matter later:
 *
 * - **The origin span.** Every instruction records the core node that produced
 *   it, so the lowering viewer can attribute each one and a diagnostic from
 *   the middle end can still point at source. M28 spent a milestone making
 *   spans survive desugaring; dropping them at the IR boundary would waste it.
 * - **Every named local becomes a SLOT, not a register.** Reading it is a
 *   load, writing it a store. That looks wasteful and is the only correct
 *   choice: `let t = 0; while … { t = t + 1; }` gives `t` a value that depends
 *   on which path ran, and a compile-time map from name to register cannot say
 *   that — it names the register from the last assignment the lowering walked,
 *   which on a loop that never runs was never defined. SSA construction in
 *   29.4 promotes the slots back to registers with phi functions, and that
 *   promotion is what a phi function IS.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.IrLower = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Ast = berugo && berugo.Ast ? berugo.Ast : require('./ast.js');
  const Parser = berugo && berugo.Parser ? berugo.Parser : require('./parser.js');
  const Desugar = berugo && berugo.Desugar ? berugo.Desugar : require('./desugar.js');

  /* --------------------------------------------------------------- the state */

  function makeState(program) {
    return { program: program, functions: [], nextFunction: 0 };
  }

  function makeScope(parent, fn, block) {
    return { parent: parent, fn: fn, block: block, names: new Map(),
      loop: parent ? parent.loop : null };
  }

  function lookup(env, name) {
    let here = env;

    while (here) {
      if (here.names.has(name)) return here.names.get(name);
      here = here.parent;
    }
    return null;
  }

  /**
   * A scope maps a source name to a SLOT. Reading the name emits a load and
   * writing it emits a store, so a variable whose value depends on which path
   * ran is expressed by the IR rather than by a compile-time map the IR cannot
   * see. Promoting the slots back to registers is 29.4's job, and doing it
   * here instead is what made `let t = 0; while … { t = t + 1; }` read a
   * register that was never defined when the loop body did not run.
   */
  function bindName(env, name, slot) { env.names.set(name, slot); }

  function declareLocal(ctx, name) {
    const slot = Ir.freshSlot(ctx.fn, name, depthOf(ctx.env));

    bindName(ctx.env, name, slot);
    return slot;
  }

  function depthOf(env) {
    let depth = 0;
    let here = env;

    while (here.parent) { depth += 1; here = here.parent; }
    return depth;
  }

  /* ---------------------------------------------------------- expressions */

  const EXPR = {
    num: constant, str: constant, bool: constant,
    unit: function (node, ctx) { return literal(ctx, null, 'Unit', node); },
    name: lowerName,
    unary: lowerUnary,
    binary: lowerBinary,
    call: lowerCall,
    field: lowerField,
    index: lowerIndex,
    array: lowerArray,
    record: lowerRecord,
    lambda: lowerLambda,
    ifExpr: lowerIf,
    block: lowerBlockExpr
  };

  function lowerExpr(node, ctx) {
    const handler = EXPR[node.kind];

    if (!handler) return literal(ctx, null, 'Unit', node);
    return handler(node, ctx);
  }

  function literal(ctx, value, type, node) {
    const target = Ir.freshRegister(ctx.fn, type);

    Ir.emit(ctx.env.block, 'const',
      { target: target, value: value, span: node ? node.span : null, origin: node.kind });
    return target;
  }

  function constant(node, ctx) {
    const type = node.kind === 'num' ? 'Number' : (node.kind === 'bool' ? 'Bool' : 'String');

    return literal(ctx, node.value, type, node);
  }

  function lowerName(node, ctx) {
    const slot = lookup(ctx.env, node.name);

    if (slot) {
      const target = Ir.freshRegister(ctx.fn, 'unknown');

      Ir.emit(ctx.env.block, 'loadLocal', { target: target, slot: slot,
        span: node.span, origin: node.kind });
      return target;
    }
    /* An unbound name at this point is a builtin or a module: the resolver
       already rejected genuinely unknown names, so this is a global rather
       than a mistake, and it becomes a constant naming itself. */
    return literal(ctx, '!' + node.name, 'unknown', node);
  }

  function lowerUnary(node, ctx) {
    const operand = lowerExpr(node.operand, ctx);
    const target = Ir.freshRegister(ctx.fn, node.op === '!' ? 'Bool' : 'Number');

    Ir.emit(ctx.env.block, 'unary', { target: target, operator: node.op, operand: operand,
      span: node.span, origin: node.kind });
    return target;
  }

  function lowerBinary(node, ctx) {
    const left = lowerExpr(node.left, ctx);
    const right = lowerExpr(node.right, ctx);

    return emitBinary(ctx, node.op, left, right, node);
  }

  const OP_NAMES = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'rem',
    '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge', '==': 'eq', '!=': 'ne',
    '&&': 'and', '||': 'or' };

  const COMPARISONS = ['lt', 'le', 'gt', 'ge', 'eq', 'ne', 'and', 'or'];

  function emitBinary(ctx, op, left, right, node) {
    const name = OP_NAMES[op] || op;
    const target = Ir.freshRegister(ctx.fn,
      COMPARISONS.indexOf(name) === -1 ? 'Number' : 'Bool');

    Ir.emit(ctx.env.block, 'binary', { target: target, operator: name, left: left,
      right: right, span: node ? node.span : null, origin: node ? node.kind : 'binary' });
    return target;
  }

  /**
   * The core's `$add(a, b)` is a primitive, not a call, and recognising that
   * here is what lets constant folding and value numbering see arithmetic at
   * all. A call to a `$`-prefixed runtime name is the operator it stands for;
   * everything else is a real call.
   */
  function lowerCall(node, ctx) {
    const primitive = node.callee.kind === 'name' ? Ir.FROM_RUNTIME[node.callee.name] : null;

    if (primitive && node.args.length === 2) {
      return emitBinary(ctx, primitive, lowerExpr(node.args[0], ctx),
        lowerExpr(node.args[1], ctx), node);
    }
    const callee = lowerExpr(node.callee, ctx);
    const args = node.args.map(function (arg) { return lowerExpr(arg, ctx); });
    const target = Ir.freshRegister(ctx.fn, 'unknown');

    Ir.emit(ctx.env.block, 'call', { target: target, callee: callee, args: args,
      span: node.span, origin: node.kind });
    return target;
  }

  function lowerField(node, ctx) {
    const object = lowerExpr(node.object, ctx);
    const target = Ir.freshRegister(ctx.fn, 'unknown');

    Ir.emit(ctx.env.block, 'loadField', { target: target, object: object, field: node.name,
      span: node.span, origin: node.kind });
    return target;
  }

  function lowerIndex(node, ctx) {
    const object = lowerExpr(node.object, ctx);
    const index = lowerExpr(node.key, ctx);
    const target = Ir.freshRegister(ctx.fn, 'unknown');

    Ir.emit(ctx.env.block, 'loadIndex', { target: target, object: object, index: index,
      span: node.span, origin: node.kind });
    return target;
  }

  function lowerArray(node, ctx) {
    const args = node.items.map(function (item) { return lowerExpr(item, ctx); });
    const target = Ir.freshRegister(ctx.fn, 'Array');

    Ir.emit(ctx.env.block, 'makeArray', { target: target, args: args,
      span: node.span, origin: node.kind });
    return target;
  }

  function lowerRecord(node, ctx) {
    const args = node.fields.map(function (entry) { return lowerExpr(entry.value, ctx); });
    const target = Ir.freshRegister(ctx.fn, 'Record');

    Ir.emit(ctx.env.block, 'makeRecord', { target: target, args: args,
      fields: node.fields.map(function (entry) { return entry.name; }),
      span: node.span, origin: node.kind });
    return target;
  }

  /* ------------------------------------------------------------- functions */

  /**
   * A lambda becomes a separate IR function plus a closure allocation. The
   * captures are computed here rather than taken from the resolver's table,
   * because after desugaring the tree is not the one the resolver walked —
   * and a free name of the lambda body that is bound in an enclosing IR scope
   * is exactly what a capture is.
   */
  function lowerLambda(node, ctx) {
    const captures = freeNames(node, ctx.env);
    const inner = buildFunction(ctx.state, lambdaName(ctx.state), node.params, node.body,
      captures);
    const target = Ir.freshRegister(ctx.fn, 'Fn');

    Ir.emit(ctx.env.block, 'makeClosure', { target: target, func: inner.name,
      sourceName: '', captureNames: captures.slice(),
      args: captures.map(function (name) { return readLocal(ctx, name, node); }),
      span: node.span, origin: node.kind });
    return target;
  }

  /** A capture is read at closure-creation time, which is a load like any other. */
  function readLocal(ctx, name, node) {
    const slot = lookup(ctx.env, name);
    const target = Ir.freshRegister(ctx.fn, 'unknown');

    Ir.emit(ctx.env.block, 'loadLocal', { target: target, slot: slot,
      span: node.span, origin: 'capture' });
    return target;
  }

  function lambdaName(state) {
    state.nextFunction += 1;
    return 'lambda' + state.nextFunction;
  }

  /** Names the body reads that the enclosing IR scope binds. */
  function freeNames(node, env) {
    const bound = new Set(node.params.map(function (param) { return param.name; }));
    const found = [];

    Ast.visit(node.body, { enter: function (child) {
      if (child.kind === 'letDecl' || child.kind === 'fnDecl') bound.add(child.name);
      if (child.kind === 'param') bound.add(child.name);
      if (child.kind !== 'name' || bound.has(child.name)) return;
      if (!lookup(env, child.name) || found.indexOf(child.name) !== -1) return;
      found.push(child.name);
    } });
    return found;
  }

  function buildFunction(state, name, params, body, captures) {
    const fn = Ir.makeFunction(name, []);
    const entry = Ir.makeBlock(fn, 'entry');
    const env = makeScope(null, fn, entry);

    (captures || []).forEach(function (captured) {
      bindName(env, captured, declareParameter(fn, entry, captured));
    });
    params.forEach(function (param) {
      bindName(env, param.name, declareParameter(fn, entry, param.name));
    });
    const ctx = { state: state, fn: fn, env: env };
    const value = lowerBody(body, ctx);

    Ir.terminate(ctx.env.block, 'ret', { value: value, span: body.span, origin: 'return' });
    state.functions.push(fn);
    return fn;
  }

  /**
   * A parameter arrives in a register and is immediately stored into a slot,
   * so the body reads it the same way it reads any local — and a parameter
   * that is assigned needs no special case. Copy propagation removes the
   * store-then-load pair once SSA construction has promoted the slot.
   */
  function declareParameter(fn, entry, name) {
    const register = Ir.freshRegister(fn, 'unknown');
    const slot = Ir.freshSlot(fn, name, 1);

    fn.params.push(register);
    fn.paramNames = (fn.paramNames || []).concat([name]);
    Ir.emit(entry, 'storeLocal', { slot: slot, value: register, origin: 'param' });
    return slot;
  }

  /**
   * A function body is a block whose tail, if any, is the returned value.
   *
   * The current block is copied back to the caller AFTER the tail is lowered,
   * not before. A tail that is itself an `if` moves the current block to that
   * if's join, and copying first left the caller emitting into the block the
   * branch had already terminated — so a nested `if` in tail position produced
   * two join blocks with no terminator and a value assigned on no path. Every
   * `match` with more than two arms hit it.
   */
  function lowerBody(body, ctx) {
    if (body.kind !== 'block') return lowerExpr(body, ctx);
    const inner = makeScope(ctx.env, ctx.fn, ctx.env.block);
    const nested = { state: ctx.state, fn: ctx.fn, env: inner };

    body.statements.forEach(function (statement) { lowerStatement(statement, nested); });
    const value = body.tail ? lowerExpr(body.tail, nested) : null;

    ctx.env.block = inner.block;
    return value;
  }

  /* ------------------------------------------------------------ statements */

  const STATEMENT = {
    letDecl: function (node, ctx) {
      const value = lowerExpr(node.value, ctx);

      Ir.emit(ctx.env.block, 'storeLocal', { slot: declareLocal(ctx, node.name),
        value: value, span: node.span, origin: node.kind });
    },
    fnDecl: lowerFnDecl,
    /* An import IS a binding, so it gets a slot like any other. Leaving it out
       and resolving `math.square` through the global constant works and makes
       the IR report two fewer bindings than the program has, which the
       differential comparison correctly calls a difference. */
    importDecl: function (node, ctx) {
      const value = literal(ctx, '!' + node.name, 'Module', node);

      Ir.emit(ctx.env.block, 'storeLocal', { slot: declareLocal(ctx, node.name),
        value: value, span: node.span, origin: node.kind });
    },
    exprStmt: function (node, ctx) { lowerExpr(node.expr, ctx); },
    assign: lowerAssign,
    whileStmt: lowerWhile,
    returnStmt: lowerReturn,
    breakStmt: function (node, ctx) { jumpTo(ctx, ctx.env.loop && ctx.env.loop.after, node); },
    continueStmt: function (node, ctx) {
      jumpTo(ctx, ctx.env.loop && ctx.env.loop.header, node);
    },
    block: function (node, ctx) { lowerBody(node, ctx); }
  };

  function lowerStatement(node, ctx) {
    const handler = STATEMENT[node.kind];

    if (handler) return handler(node, ctx);
    return lowerExpr(node, ctx);
  }

  /**
   * A named function is lowered before its body is walked, so a recursive
   * call resolves — the same hoisting rule the resolver applies, restated at
   * the IR level because the tree it walked is not this one.
   */
  function lowerFnDecl(node, ctx) {
    const captures = freeNames(node, ctx.env).filter(function (name) {
      return name !== node.name;
    });
    const inner = buildFunction(ctx.state, node.name, node.params, node.body, captures);
    const target = Ir.freshRegister(ctx.fn, 'Fn');
    const slot = declareLocal(ctx, node.name);

    Ir.emit(ctx.env.block, 'makeClosure', { target: target, func: inner.name,
      sourceName: node.name, captureNames: captures.slice(),
      args: captures.map(function (name) { return readLocal(ctx, name, node); }),
      span: node.span, origin: node.kind });
    Ir.emit(ctx.env.block, 'storeLocal', { slot: slot, value: target,
      span: node.span, origin: node.kind });
  }

  function lowerAssign(node, ctx) {
    const value = lowerExpr(node.value, ctx);

    if (node.target.kind === 'name') {
      const slot = lookup(ctx.env, node.target.name) || declareLocal(ctx, node.target.name);

      Ir.emit(ctx.env.block, 'storeLocal', { slot: slot, value: value,
        span: node.span, origin: node.kind });
      return;
    }
    if (node.target.kind === 'field') {
      Ir.emit(ctx.env.block, 'storeField', { object: lowerExpr(node.target.object, ctx),
        field: node.target.name, value: value, span: node.span, origin: node.kind });
      return;
    }
    Ir.emit(ctx.env.block, 'storeIndex', { object: lowerExpr(node.target.object, ctx),
      index: lowerExpr(node.target.key, ctx), value: value,
      span: node.span, origin: node.kind });
  }

  /**
   * No continuation block is created. The block is terminated and stays the
   * current one; `Ir.emit` drops anything emitted into a terminated block, so
   * the statements after a `return` produce no instructions at all. Creating
   * an `after-return` block instead left one unreachable and unterminated in
   * every function that returns before its last statement.
   */
  function lowerReturn(node, ctx) {
    const value = node.value ? lowerExpr(node.value, ctx) : null;

    Ir.terminate(ctx.env.block, 'ret', { value: value, span: node.span, origin: node.kind });
  }

  function jumpTo(ctx, target, node) {
    if (!target) return;
    Ir.terminate(ctx.env.block, 'jump', { target: target,
      span: node.span, origin: node.kind });
  }

  /* ------------------------------------------------ structured control flow */

  /**
   * `if` becomes three blocks. The value is carried in a register assigned in
   * both arms — which is a variable with two definitions, and therefore
   * exactly what SSA will replace with a phi in 29.4. Doing it this way first
   * is what makes the phi's purpose visible rather than assumed.
   */
  function lowerIf(node, ctx) {
    const cond = lowerExpr(node.test, ctx);
    const thenBlock = Ir.makeBlock(ctx.fn, 'then');
    const elseBlock = Ir.makeBlock(ctx.fn, 'else');
    const joinBlock = Ir.makeBlock(ctx.fn, 'join');
    const result = Ir.freshSlot(ctx.fn, 'if', depthOf(ctx.env) + 1);

    Ir.terminate(ctx.env.block, 'branch', { cond: cond, then: thenBlock.id,
      other: elseBlock.id, span: node.span, origin: node.kind });
    lowerArm(node.then, thenBlock, joinBlock, { ctx: ctx, result: result, node: node });
    lowerArm(node.other, elseBlock, joinBlock, { ctx: ctx, result: result, node: node });
    ctx.env.block = joinBlock;
    const target = Ir.freshRegister(ctx.fn, 'unknown');

    Ir.emit(joinBlock, 'loadLocal', { target: target, slot: result,
      span: node.span, origin: node.kind });
    return target;
  }

  function lowerArm(body, start, join, spec) {
    const ctx = spec.ctx;
    const inner = makeScope(ctx.env, ctx.fn, start);
    const nested = { state: ctx.state, fn: ctx.fn, env: inner };
    const value = body ? lowerBody(body, nested) : null;

    Ir.emit(inner.block, 'storeLocal', { slot: spec.result,
      value: value === null ? unitRegister(nested, spec.node) : value,
      span: spec.node.span, origin: 'ifExpr' });
    Ir.terminate(inner.block, 'jump', { target: join.id, span: spec.node.span,
      origin: 'ifExpr' });
  }

  function unitRegister(ctx, node) {
    return literal(ctx, null, 'Unit', node);
  }

  /**
   * `while` becomes a header that tests, a body that jumps back, and a block
   * after. The back edge is what makes the graph cyclic, and every loop
   * analysis in this milestone starts by finding it.
   */
  function lowerWhile(node, ctx) {
    const header = Ir.makeBlock(ctx.fn, 'loop-header');
    const body = Ir.makeBlock(ctx.fn, 'loop-body');
    const after = Ir.makeBlock(ctx.fn, 'loop-exit');

    Ir.terminate(ctx.env.block, 'jump', { target: header.id, span: node.span,
      origin: node.kind });
    ctx.env.block = header;
    const cond = lowerExpr(node.test, ctx);

    Ir.terminate(ctx.env.block, 'branch', { cond: cond, then: body.id, other: after.id,
      span: node.span, origin: node.kind });
    lowerLoopBody(node, body, header, ctx);
    ctx.env.block = after;
  }

  function lowerLoopBody(node, body, header, ctx) {
    const inner = makeScope(ctx.env, ctx.fn, body);
    const nested = { state: ctx.state, fn: ctx.fn, env: inner };

    inner.loop = { header: header.id, after: 'loop-exit-placeholder' };
    inner.loop.after = ctx.fn.blocks[ctx.fn.blocks.length - 1].id;
    inner.loop.after = afterBlockId(ctx.fn, header.id);
    lowerBody(node.body, nested);
    Ir.terminate(inner.block, 'jump', { target: header.id, span: node.span,
      origin: node.kind });
  }

  /** The exit block created alongside a header, found by construction order. */
  function afterBlockId(fn, headerId) {
    const at = fn.blocks.findIndex(function (block) { return block.id === headerId; });

    return fn.blocks[at + 2] ? fn.blocks[at + 2].id : null;
  }

  function lowerBlockExpr(node, ctx) {
    return lowerBody(node, ctx);
  }

  /* ------------------------------------------------------------- the entry */

  /**
   * The whole program becomes one `main` function plus one IR function per
   * lambda and named function, so every later pass has a uniform thing to walk.
   */
  function lower(core, options) {
    const state = makeState(core);
    const main = Ir.makeFunction('main', []);
    const entry = Ir.makeBlock(main, 'entry');
    const env = makeScope(null, main, entry);
    const ctx = { state: state, fn: main, env: env };

    core.items.forEach(function (item) { lowerStatement(item, ctx); });
    Ir.terminate(ctx.env.block, 'ret', { value: null, span: core.span, origin: 'program' });
    state.functions.push(main);
    return finish(state, env, options || {});
  }

  /**
   * A lowering naturally produces unreachable blocks: an `if` whose arms both
   * return leaves a join nothing jumps to. Dropping them here is the same
   * unreachable-block elimination 29.2 describes, done once so the verifier
   * gates on the rest — and `keepUnreachable` leaves them in, which is how the
   * CFG section shows what the pass is worth.
   */
  function finish(state, env, options) {
    if (!options.keepUnreachable) {
      state.functions.forEach(function (fn) { pruneUnreachable(fn); });
    }
    return { functions: state.functions, main: 'main', globals: globalNames(env),
      options: options };
  }

  function pruneUnreachable(fn) {
    const live = Ir.reachable(fn);
    const dropped = fn.blocks.filter(function (block) { return !live.has(block.id); });

    fn.blocks = fn.blocks.filter(function (block) { return live.has(block.id); });
    fn.droppedBlocks = dropped.map(function (block) { return block.id; });
    return dropped.length;
  }

  function globalNames(env) {
    const names = {};

    env.names.forEach(function (register, name) { names[name] = register; });
    return names;
  }

  /** Source text straight through to IR, which is what every demo wants. */
  function compile(source, options) {
    const parsed = Parser.parse(source);
    const lowered = Desugar.desugar(parsed.tree, options && options.passes);
    const program = lower(lowered.core, options);

    return { source: source, tree: parsed.tree, core: lowered.core, program: program,
      errors: parsed.errors, verified: Ir.verifyProgram(program) };
  }

  return { lower: lower, compile: compile, freeNames: freeNames, OP_NAMES: OP_NAMES,
    pruneUnreachable: pruneUnreachable };
}));
