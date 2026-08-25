/**
 * A reference interpreter for Berugo, over the surface language AND the core.
 *
 * This exists to answer one question that no amount of reading can: does a
 * desugaring preserve behaviour? A lowering is only correct if the program it
 * produces computes what the program it came from computed, and the only way
 * to know is to run both and compare. Every desugaring in `desugar.js` is
 * checked that way, and the `for` loop's `continue` case — the one that is
 * easy to lower into an infinite loop — is checked by running it.
 *
 * It is also the oracle the fuzzer needs. A random program is only interesting
 * if there is something to compare against, and "the surface program and its
 * core agree" is a property a generator can be pointed at ten thousand times.
 *
 * Three deliberate choices:
 *
 * - **A step budget, not a timeout.** A generated program can loop forever, and
 *   a wall clock makes the result depend on the machine. Counting steps makes
 *   "this did not finish" reproducible, and `budget` is a reported outcome
 *   distinct from `runtime` — collapsing the two would make a hang look like a
 *   crash.
 * - **Control flow is a thrown signal.** `return` inside a nested `if`
 *   expression inside a `while` has to escape an arbitrary depth of expression
 *   evaluation, and threading a status through every expression result costs
 *   more than it buys.
 * - **Output is captured, never printed.** `print` appends to a list, so two
 *   runs can be compared on their output as well as their value.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Interp = api;
  }
}(this, function (root) {
  'use strict';

  const Parser = root && root.Berugo && root.Berugo.Parser
    ? root.Berugo.Parser : require('./parser.js');
  const Desugar = root && root.Berugo && root.Berugo.Desugar
    ? root.Berugo.Desugar : require('./desugar.js');

  const DEFAULT_BUDGET = 200000;
  const UNIT = { v: 'unit' };

  /* --------------------------------------------------------------- values */

  function array(items) { return { v: 'array', items: items }; }
  function record(fields) { return { v: 'record', fields: fields }; }
  function ctor(name, args) { return { v: 'ctor', name: name, args: args }; }

  /**
   * Values print structurally, because two runs are compared on their printed
   * form. Comparing object identity would say a desugaring changed the answer
   * every time it rebuilt a record that happens to be equal.
   */
  function show(value) {
    if (value === UNIT || value === undefined || value === null) return 'unit';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return JSON.stringify(value);
    return showCompound(value);
  }

  function showCompound(value) {
    if (value.v === 'array') return '[' + value.items.map(show).join(', ') + ']';
    if (value.v === 'record') return showRecord(value);
    if (value.v === 'ctor') {
      return value.args.length ? value.name + '(' + value.args.map(show).join(', ') + ')'
        : value.name;
    }
    if (value.v === 'module') return '<module ' + value.name + '>';
    return '<fn ' + (value.name || 'anonymous') + '>';
  }

  function showRecord(value) {
    const keys = Object.keys(value.fields).sort();

    if (!keys.length) return '{}';
    return '{ ' + keys.map(function (key) {
      return key + ': ' + show(value.fields[key]);
    }).join(', ') + ' }';
  }

  /* --------------------------------------------------------------- signals */

  function Signal(kind, value) { this.kind = kind; this.value = value; }
  function Fault(reason, message) { this.reason = reason; this.message = message; }

  function fail(message) { throw new Fault('runtime', message); }

  /* ------------------------------------------------------------ the scope */

  function makeScope(parent) { return { names: new Map(), parent: parent }; }

  function declare(env, name, value) { env.names.set(name, value); }

  function lookup(env, name) {
    let here = env;

    while (here) {
      if (here.names.has(name)) return here.names.get(name);
      here = here.parent;
    }
    return fail('nothing named ' + name + ' is in scope at run time');
  }

  function assign(env, name, value) {
    let here = env;

    while (here) {
      if (here.names.has(name)) { here.names.set(name, value); return value; }
      here = here.parent;
    }
    return fail('cannot assign to ' + name + ', which is not bound');
  }

  /* ------------------------------------------------------------- builtins */

  function native(name, arity, call) {
    return { v: 'native', name: name, arity: arity, call: call };
  }

  function lengthOf(value) {
    if (value && value.v === 'array') return value.items.length;
    if (typeof value === 'string') return value.length;
    return fail('len wants an array or a string');
  }

  /**
   * The core calls `add(a, b)` where the surface writes `a + b`, so the
   * arithmetic builtins have to exist for the desugared program to run at all.
   * They are the same operations, which is the point: lowering an operator to
   * a call must not change what the operator means.
   */
  const ARITHMETIC = {
    add: function (a, b) { return numeric(a) + numeric(b); },
    sub: function (a, b) { return numeric(a) - numeric(b); },
    mul: function (a, b) { return numeric(a) * numeric(b); },
    div: function (a, b) { return divide(numeric(a), numeric(b)); },
    rem: function (a, b) { return remainder(numeric(a), numeric(b)); },
    lt: function (a, b) { return numeric(a) < numeric(b); },
    le: function (a, b) { return numeric(a) <= numeric(b); },
    gt: function (a, b) { return numeric(a) > numeric(b); },
    ge: function (a, b) { return numeric(a) >= numeric(b); },
    eq: function (a, b) { return show(a) === show(b); },
    ne: function (a, b) { return show(a) !== show(b); },
    and: function (a, b) { return Boolean(a) && Boolean(b); },
    or: function (a, b) { return Boolean(a) || Boolean(b); }
  };

  function numeric(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return fail('arithmetic on a string');
    return fail('arithmetic on ' + show(value));
  }

  function divide(a, b) {
    if (b === 0) return fail('division by zero');
    return a / b;
  }

  function remainder(a, b) {
    if (b === 0) return fail('remainder by zero');
    return a % b;
  }

  const MODULE_VALUES = {
    math: { square: [1, function (a) { return numeric(a) * numeric(a); }],
      abs: [1, function (a) { return Math.abs(numeric(a)); }],
      max: [2, function (a, b) { return Math.max(numeric(a), numeric(b)); }] },
    text: { length: [1, function (a) { return String(a).length; }],
      upper: [1, function (a) { return String(a).toUpperCase(); }] },
    list: { len: [1, lengthOf], map: [2, null] }
  };

  function moduleValue(name) {
    const spec = MODULE_VALUES[name];
    const fields = {};

    if (!spec) return fail('there is no module named ' + name);
    Object.keys(spec).forEach(function (key) {
      fields[key] = spec[key][1]
        ? native(name + '.' + key, spec[key][0], spec[key][1])
        : native(name + '.' + key, spec[key][0], null);
    });
    return { v: 'module', name: name, fields: fields };
  }

  /**
   * The core's own primitives. Their names begin with `$`, which no surface
   * identifier can, so a user function called `add` and the core's `$add` are
   * different names and the lowering cannot capture one with the other.
   */
  const RUNTIME = '$';

  function declareRuntime(env) {
    Object.keys(ARITHMETIC).forEach(function (name) {
      declare(env, RUNTIME + name, native(RUNTIME + name, 2, ARITHMETIC[name]));
    });
    Object.keys(CONSTRUCTORS).forEach(function (name) {
      declare(env, RUNTIME + 'is_' + name, native(RUNTIME + 'is_' + name, 1,
        function (value) { return Boolean(value) && value.v === 'ctor' && value.name === name; }));
    });
    [0, 1, 2].forEach(function (index) {
      declare(env, RUNTIME + 'payload' + index, native(RUNTIME + 'payload' + index, 1,
        function (value) { return payloadOf(value, index); }));
    });
    declare(env, RUNTIME + 'len', native(RUNTIME + 'len', 1, lengthOf));
    declare(env, RUNTIME + 'unmatched', native(RUNTIME + 'unmatched', 0, function () {
      return fail('no arm of this match applied');
    }));
  }

  const CONSTRUCTORS = { some: 1, none: 0 };

  function payloadOf(value, index) {
    if (!value || value.v !== 'ctor') return fail(show(value) + ' has no payload');
    if (index >= value.args.length) {
      return fail(value.name + ' has no payload at position ' + index);
    }
    return value.args[index];
  }

  function baseScope(state) {
    const env = makeScope(null);

    declare(env, 'print', native('print', 1, function (value) {
      state.output.push(show(value));
      return UNIT;
    }));
    declare(env, 'len', native('len', 1, lengthOf));
    declare(env, 'some', native('some', 1, function (value) { return ctor('some', [value]); }));
    declare(env, 'none', ctor('none', []));
    declareRuntime(env);
    return env;
  }

  /* ------------------------------------------------------------- the walk */

  function step(state) {
    state.steps += 1;
    if (state.steps > state.budget) throw new Fault('budget', 'step budget exhausted');
  }

  const EVAL = {
    num: function (node) { return node.value; },
    str: function (node) { return node.value; },
    bool: function (node) { return node.value; },
    unit: function () { return UNIT; },
    error: function (node) { return fail('an error node cannot be evaluated'); },
    name: function (node, env) { return lookup(env, node.name); },
    unary: evalUnary,
    binary: evalBinary,
    call: evalCall,
    field: evalField,
    index: evalIndex,
    array: function (node, env, state) {
      return array(node.items.map(function (item) { return evaluate(item, env, state); }));
    },
    record: evalRecord,
    lambda: function (node, env) {
      return { v: 'fn', params: node.params, body: node.body, env: env, name: node.name };
    },
    ifExpr: evalIf,
    block: evalBlock,
    matchExpr: evalMatch
  };

  function evaluate(node, env, state) {
    const rule = EVAL[node.kind];

    step(state);
    if (!rule) return fail('no evaluation rule for ' + node.kind);
    return rule(node, env, state);
  }

  function evalUnary(node, env, state) {
    const operand = evaluate(node.operand, env, state);

    if (node.op === '-') return -numeric(operand);
    if (node.op === '!') return !truth(operand);
    return fail('unknown unary operator ' + node.op);
  }

  function truth(value) {
    if (typeof value === 'boolean') return value;
    return fail('a condition must be a Bool, not ' + show(value));
  }

  /**
   * `&&` and `||` short-circuit here and do NOT short-circuit once lowered to
   * `and(a, b)`, because a call evaluates both arguments. That difference is
   * real and the desugaring test reports it rather than hiding it: v1 has no
   * side effects in expressions, so no conformance program can observe it, and
   * the note in `desugar.js` records the debt for M29.
   */
  function evalBinary(node, env, state) {
    const left = evaluate(node.left, env, state);

    if (node.op === '&&') return truth(left) ? truth(evaluate(node.right, env, state)) : false;
    if (node.op === '||') return truth(left) ? true : truth(evaluate(node.right, env, state));
    return applyOperator(node.op, left, evaluate(node.right, env, state));
  }

  function applyOperator(op, left, right) {
    const NAMES = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'rem',
      '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge', '==': 'eq', '!=': 'ne' };
    const fn = ARITHMETIC[NAMES[op]];

    if (!fn) return fail('unknown operator ' + op);
    if (op === '+' && typeof left === 'string') return left + String(right);
    return fn(left, right);
  }

  function evalCall(node, env, state) {
    const callee = evaluate(node.callee, env, state);
    const args = node.args.map(function (arg) { return evaluate(arg, env, state); });

    return applyValue(callee, args, state);
  }

  function applyValue(callee, args, state) {
    if (!callee || (callee.v !== 'fn' && callee.v !== 'native')) {
      return fail(show(callee) + ' is not a function');
    }
    if (callee.v === 'native') return applyNative(callee, args, state);
    return applyClosure(callee, args, state);
  }

  function applyNative(callee, args, state) {
    if (callee.name === 'list.map') return mapOver(args, state);
    if (!callee.call) return fail(callee.name + ' has no implementation');
    return callee.call.apply(null, args);
  }

  function mapOver(args, state) {
    const source = args[0];
    const fn = args[1];

    if (!source || source.v !== 'array') return fail('list.map wants an array');
    return array(source.items.map(function (item) {
      return applyValue(fn, [item], state);
    }));
  }

  function applyClosure(callee, args, state) {
    const inner = makeScope(callee.env);

    callee.params.forEach(function (param, index) {
      declare(inner, param.name, index < args.length ? args[index] : UNIT);
    });
    try {
      return evaluate(callee.body, inner, state);
    } catch (signal) {
      if (signal instanceof Signal && signal.kind === 'return') return signal.value;
      throw signal;
    }
  }

  function evalField(node, env, state) {
    const object = evaluate(node.object, env, state);

    if (object && object.v === 'module') {
      if (!object.fields[node.name]) return fail(object.name + ' exports no ' + node.name);
      return object.fields[node.name];
    }
    if (!object || object.v !== 'record') return fail(show(object) + ' has no fields');
    if (!Object.prototype.hasOwnProperty.call(object.fields, node.name)) {
      return fail(show(object) + ' has no field named ' + node.name);
    }
    return object.fields[node.name];
  }

  function evalIndex(node, env, state) {
    const object = evaluate(node.object, env, state);
    const key = evaluate(node.key, env, state);

    if (!object || object.v !== 'array') return fail(show(object) + ' is not indexable');
    if (typeof key !== 'number' || key < 0 || key >= object.items.length) {
      return fail('index ' + show(key) + ' is outside an array of ' + object.items.length);
    }
    return object.items[key];
  }

  function evalRecord(node, env, state) {
    const fields = {};

    node.fields.forEach(function (entry) {
      fields[entry.name] = evaluate(entry.value, env, state);
    });
    return record(fields);
  }

  function evalIf(node, env, state) {
    if (truth(evaluate(node.test, env, state))) return evaluate(node.then, env, state);
    return node.other ? evaluate(node.other, env, state) : UNIT;
  }

  /** A block is a scope: the `for` lowering re-declares its element each pass. */
  function evalBlock(node, env, state) {
    const inner = makeScope(env);

    node.statements.forEach(function (statement) { execute(statement, inner, state); });
    return node.tail ? evaluate(node.tail, inner, state) : UNIT;
  }

  function evalMatch(node, env, state) {
    const subject = evaluate(node.subject, env, state);

    for (let i = 0; i < node.arms.length; i += 1) {
      const inner = makeScope(env);

      if (matches(node.arms[i].pattern, subject, inner)
        && guardHolds(node.arms[i], inner, state)) {
        return evaluate(node.arms[i].body, inner, state);
      }
    }
    return fail('no arm of this match applied to ' + show(subject));
  }

  function guardHolds(arm, env, state) {
    return !arm.guard || truth(evaluate(arm.guard, env, state));
  }

  function matches(pattern, value, env) {
    if (pattern.kind === 'patternWild') return true;
    if (pattern.kind === 'patternName') { declare(env, pattern.name, value); return true; }
    if (pattern.kind === 'patternLiteral') return show(value) === show(pattern.value);
    if (pattern.kind === 'patternCtor') return matchesCtor(pattern, value, env);
    return matchesRecord(pattern, value, env);
  }

  function matchesCtor(pattern, value, env) {
    if (!value || value.v !== 'ctor' || value.name !== pattern.name) return false;
    return pattern.args.every(function (arg, index) {
      return matches(arg, value.args[index], env);
    });
  }

  function matchesRecord(pattern, value, env) {
    if (!value || value.v !== 'record') return false;
    return pattern.fields.every(function (field) {
      if (!Object.prototype.hasOwnProperty.call(value.fields, field.name)) return false;
      return matches(field.pattern, value.fields[field.name], env);
    });
  }

  /* ------------------------------------------------------------ statements */

  const EXEC = {
    letDecl: function (node, env, state) {
      declare(env, node.name, evaluate(node.value, env, state));
    },
    fnDecl: function (node, env) {
      declare(env, node.name,
        { v: 'fn', params: node.params, body: node.body, env: env, name: node.name });
    },
    importDecl: function (node, env) { declare(env, node.name, moduleValue(node.name)); },
    exprStmt: function (node, env, state) { evaluate(node.expr, env, state); },
    assign: execAssign,
    whileStmt: execWhile,
    forStmt: execFor,
    returnStmt: function (node, env, state) {
      throw new Signal('return', node.value ? evaluate(node.value, env, state) : UNIT);
    },
    breakStmt: function () { throw new Signal('break', UNIT); },
    continueStmt: function () { throw new Signal('continue', UNIT); },
    block: function (node, env, state) { evalBlock(node, env, state); }
  };

  function execute(node, env, state) {
    const rule = EXEC[node.kind];

    step(state);
    if (rule) return rule(node, env, state);
    return evaluate(node, env, state);
  }

  function execAssign(node, env, state) {
    const value = evaluate(node.value, env, state);

    if (node.target.kind === 'name') return assign(env, node.target.name, value);
    if (node.target.kind === 'index') return assignIndex(node.target, value, env, state);
    return assignField(node.target, value, env, state);
  }

  function assignIndex(target, value, env, state) {
    const object = evaluate(target.object, env, state);
    const key = evaluate(target.key, env, state);

    if (!object || object.v !== 'array') return fail('cannot index-assign into a non-array');
    if (typeof key !== 'number' || key < 0 || key >= object.items.length) {
      return fail('index ' + show(key) + ' is outside an array of ' + object.items.length);
    }
    object.items[key] = value;
    return value;
  }

  function assignField(target, value, env, state) {
    const object = evaluate(target.object, env, state);

    if (!object || object.v !== 'record') return fail('cannot assign a field of a non-record');
    object.fields[target.name] = value;
    return value;
  }

  /** `break` leaves the loop; `continue` leaves the body and re-tests. */
  function execWhile(node, env, state) {
    while (truth(evaluate(node.test, env, state))) {
      step(state);
      if (runLoopBody(node.body, env, state) === 'break') return UNIT;
    }
    return UNIT;
  }

  function runLoopBody(body, env, state) {
    try {
      evaluate(body, env, state);
    } catch (signal) {
      if (!(signal instanceof Signal)) throw signal;
      if (signal.kind === 'break') return 'break';
      if (signal.kind !== 'continue') throw signal;
    }
    return 'next';
  }

  function execFor(node, env, state) {
    const source = evaluate(node.iterable, env, state);

    if (!source || source.v !== 'array') return fail('for wants an array');
    for (let i = 0; i < source.items.length; i += 1) {
      const inner = makeScope(env);

      step(state);
      declare(inner, node.name, source.items[i]);
      if (runLoopBody(node.body, inner, state) === 'break') return UNIT;
    }
    return UNIT;
  }

  /* ----------------------------------------------------------- the entries */

  /**
   * Run a tree. Never throws: a fault becomes an outcome, and the three
   * outcomes — `ok`, `runtime` and `budget` — are kept apart because a program
   * that did not finish is a different fact from one that crashed.
   */
  function runTree(tree, options) {
    const settings = options || {};
    const state = { steps: 0, output: [], budget: settings.budget || DEFAULT_BUDGET };
    const env = baseScope(state);
    const builtins = new Set(Array.from(env.names.keys()));

    try {
      return finish(tree, env, state, builtins);
    } catch (problem) {
      return caught(problem, state, env, builtins);
    }
  }

  /**
   * The bindings a program leaves behind, and the reason they are reported.
   *
   * Every conformance program is a list of `let`s and nothing else, so its
   * *value* is `unit` — and a differential test comparing only values would
   * pass whatever the core computed. Comparing the global bindings is what
   * makes `let s = add(1, 2)` observable as `s = 3`. Names beginning with `$`
   * are the core's own and have no surface counterpart, so they are excluded
   * rather than allowed to make every comparison fail.
   */
  function globals(env, builtins) {
    const rows = [];

    env.names.forEach(function (value, name) {
      if (builtins.has(name) || name.charAt(0) === '$') return;
      rows.push(name + ' = ' + show(value));
    });
    return rows.sort();
  }

  function finish(tree, env, state, builtins) {
    let last = UNIT;

    tree.items.forEach(function (item) { last = statementValue(item, env, state); });
    return { ok: true, outcome: 'ok', value: show(last), output: state.output,
      bindings: globals(env, builtins), steps: state.steps, error: '' };
  }

  function statementValue(item, env, state) {
    if (EXEC[item.kind] && item.kind !== 'block') { execute(item, env, state); return UNIT; }
    return evaluate(item, env, state);
  }

  /**
   * A JavaScript `RangeError` from a runaway recursion is a *budget* outcome,
   * not a crash: the program did not finish, and calling that "runtime" would
   * report a non-terminating program as a broken one. Everything else that
   * escapes is genuinely a fault in the program.
   */
  function caught(problem, state, env, builtins) {
    const reason = classify(problem);
    const message = problem instanceof Fault ? problem.message : String(problem.message || problem);

    return { ok: false, outcome: reason, value: '', output: state.output,
      bindings: globals(env, builtins), steps: state.steps, error: message };
  }

  function classify(problem) {
    if (problem instanceof Fault) return problem.reason;
    if (problem instanceof RangeError) return 'budget';
    return 'runtime';
  }

  function run(source, options) {
    const parsed = Parser.parse(source);

    if (parsed.errors.length) {
      return { ok: false, outcome: 'parse', value: '', output: [], bindings: [], steps: 0,
        error: parsed.errors[0].message };
    }
    return runTree(parsed.tree, options);
  }

  /**
   * The differential test the whole module exists for: run the surface program
   * and its core, and compare the value, the output and the outcome. A
   * desugaring that changes any of the three is wrong, and `agree` is the
   * field the section reports.
   */
  function compareWithCore(source, options) {
    const parsed = Parser.parse(source);

    if (parsed.errors.length) {
      return { ok: false, agree: false, why: 'the program does not parse',
        surface: null, core: null };
    }
    return comparison(parsed, runTree(parsed.tree, options), options);
  }

  function comparison(parsed, surface, options) {
    const lowered = Desugar.desugar(parsed.tree, options);
    const core = runTree(lowered.core, options);

    return { ok: true, surface: surface, core: core,
      agree: agreementOf(surface, core) === '',
      why: describeDisagreement(surface, core),
      observed: surface.bindings.length + surface.output.length,
      rewrites: lowered.rewrites.length, passes: lowered.passes,
      surfaceSteps: surface.steps, coreSteps: core.steps };
  }

  /** The empty string means they agree; anything else names the difference. */
  function agreementOf(surface, core) {
    if (surface.outcome !== core.outcome) {
      return 'the surface program ' + surface.outcome + ' and its core ' + core.outcome;
    }
    if (surface.value !== core.value) {
      return 'the surface program gave ' + surface.value + ' and its core gave ' + core.value;
    }
    if (surface.output.join(' ') !== core.output.join(' ')) {
      return 'the two runs printed different things';
    }
    if (surface.bindings.join(' ') !== core.bindings.join(' ')) {
      return 'the two runs left different bindings: ' + surface.bindings.join(', ')
        + ' against ' + core.bindings.join(', ');
    }
    return '';
  }

  function describeDisagreement(surface, core) {
    const difference = agreementOf(surface, core);

    if (difference) return difference;
    return 'they agree on the value, the output, the outcome and all '
      + surface.bindings.length + ' bindings';
  }

  return {
    UNIT: UNIT, DEFAULT_BUDGET: DEFAULT_BUDGET, ARITHMETIC: ARITHMETIC,
    MODULE_VALUES: MODULE_VALUES,
    show: show, array: array, record: record, ctor: ctor,
    run: run, runTree: runTree, compareWithCore: compareWithCore
  };
}));
