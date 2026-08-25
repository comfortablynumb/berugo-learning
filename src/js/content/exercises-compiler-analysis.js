/**
 * Graded exercises for AST tooling, resolution and type checking (M28.4-M28.6).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 * Each exercise exposes its functions through a single `lab()` entry.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'ast-infrastructure': [{
      id: 'minimal-parens',
      title: 'Print with the fewest parentheses the parser needs',
      prompt: 'Trees are { kind: "num", value }, { kind: "name", value } and ' +
        '{ kind: "binary", op, left, right }. `table` maps an operator to { left, right } ' +
        'binding powers. Write print(tree, table) emitting the fewest parentheses that reparse ' +
        'to the same tree: a child needs brackets when its own binding power is LOWER than the ' +
        'power required at the position it sits in — the operator\'s left power for the left ' +
        'child and its right power for the right child. An atom has infinite power. Then write ' +
        'needsParens(child, required, table) returning that decision on its own, and ' +
        'powerOf(tree, table). The starter always brackets a nested binary, which is faithful ' +
        'and not minimal — and a printer that never has to decide is a printer whose agreement ' +
        'with the parser has never been tested.',
      entry: 'lab',
      starter: [
        'function powerOf(tree, table) {',
        '  if (tree.kind !== "binary") return Infinity;',
        '  return table[tree.op].left;',
        '}',
        '',
        'function needsParens(child, required, table) {',
        '  // Bracket every nested binary. Correct, and it tests nothing.',
        '  return child.kind === "binary";',
        '}',
        '',
        'function print(tree, table) {',
        '  if (tree.kind !== "binary") return String(tree.value);',
        '  const powers = table[tree.op];',
        '  const left = printAt(tree.left, powers.left, table);',
        '  const right = printAt(tree.right, powers.right, table);',
        '',
        '  return left + " " + tree.op + " " + right;',
        '}',
        '',
        'function printAt(child, required, table) {',
        '  const text = print(child, table);',
        '',
        '  return needsParens(child, required, table) ? "(" + text + ")" : text;',
        '}',
        '',
        'function lab() {',
        '  return { print: print, needsParens: needsParens, powerOf: powerOf };',
        '}'
      ].join('\n'),
      solution: [
        'function powerOf(tree, table) {',
        '  if (tree.kind !== "binary") return Infinity;',
        '  return table[tree.op].left;',
        '}',
        '',
        'function needsParens(child, required, table) {',
        '  // The one line the whole printer is: brackets exactly when the child binds',
        '  // more loosely than this position allows.',
        '  return powerOf(child, table) < required;',
        '}',
        '',
        'function print(tree, table) {',
        '  if (tree.kind !== "binary") return String(tree.value);',
        '  const powers = table[tree.op];',
        '  const left = printAt(tree.left, powers.left, table);',
        '  const right = printAt(tree.right, powers.right, table);',
        '',
        '  return left + " " + tree.op + " " + right;',
        '}',
        '',
        'function printAt(child, required, table) {',
        '  const text = print(child, table);',
        '',
        '  return needsParens(child, required, table) ? "(" + text + ")" : text;',
        '}',
        '',
        'function lab() {',
        '  return { print: print, needsParens: needsParens, powerOf: powerOf };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'no brackets where precedence already groups it',
          assert: function (lab, api) {
            const parts = lab();
            const table = { '+': { left: 9, right: 10 }, '*': { left: 11, right: 12 } };
            const num = function (v) { return { kind: 'num', value: v }; };
            const bin = function (op, l, r) { return { kind: 'binary', op: op, left: l, right: r }; };

            api.assert.equal(parts.print(bin('+', num(1), bin('*', num(2), num(3))), table),
              '1 + 2 * 3',
              'times already binds tighter, so the brackets are unnecessary — a printer that ' +
                'emits them is faithful without being minimal');
            api.assert.equal(parts.print(bin('*', bin('+', num(1), num(2)), num(3)), table),
              '(1 + 2) * 3', 'and here they are load-bearing');
          }
        },
        {
          name: 'the right side of a left-associative operator keeps its brackets',
          assert: function (lab, api) {
            const parts = lab();
            const table = { '-': { left: 9, right: 10 } };
            const num = function (v) { return { kind: 'num', value: v }; };
            const bin = function (op, l, r) { return { kind: 'binary', op: op, left: l, right: r }; };

            api.assert.equal(parts.print(bin('-', bin('-', num(1), num(2)), num(3)), table),
              '1 - 2 - 3', 'left grouping needs no brackets, because that is the default');
            api.assert.equal(parts.print(bin('-', num(1), bin('-', num(2), num(3))), table),
              '1 - (2 - 3)',
              'right grouping does, because removing them would change the tree — this is the ' +
                'case a printer that ignores the right power gets wrong');
          }
        },
        {
          name: 'needsParens answers the question on its own',
          assert: function (lab, api) {
            const parts = lab();
            const table = { '+': { left: 9, right: 10 }, '*': { left: 11, right: 12 } };
            const num = function (v) { return { kind: 'num', value: v }; };
            const bin = function (op, l, r) { return { kind: 'binary', op: op, left: l, right: r }; };
            const sum = bin('+', num(1), num(2));

            api.assert.equal(parts.needsParens(sum, 11, table), true,
              'a plus in a position requiring 11 must be bracketed');
            api.assert.equal(parts.needsParens(sum, 9, table), false,
              'and in a position requiring 9 it must not');
            api.assert.equal(parts.needsParens(num(1), 15, table), false,
              'an atom never needs brackets, whatever the position requires');
            api.assert.equal(parts.powerOf(num(1), table), Infinity, 'because its power is infinite');
          }
        },
        {
          name: 'a deep expression comes back readable rather than fully parenthesised',
          assert: function (lab, api) {
            const parts = lab();
            const table = {
              '||': { left: 1, right: 2 }, '&&': { left: 3, right: 4 },
              '<': { left: 7, right: 8 }, '+': { left: 9, right: 10 },
              '*': { left: 11, right: 12 }
            };
            const num = function (v) { return { kind: 'num', value: v }; };
            const name = function (v) { return { kind: 'name', value: v }; };
            const bin = function (op, l, r) { return { kind: 'binary', op: op, left: l, right: r }; };
            const tree = bin('||',
              bin('&&', bin('<', bin('+', num(1), bin('*', num(2), num(3))), num(10)), name('a')),
              name('b'));

            api.assert.equal(parts.print(tree, table), '1 + 2 * 3 < 10 && a || b',
              'six operators and not one bracket, because every child already binds tightly ' +
                'enough for the position it is in');
          }
        }
      ]
    }],

    'names-and-scopes': [{
      id: 'resolve-shadowing',
      title: 'Resolve names per occurrence, and find the captures',
      prompt: 'A program is a list of statements: { kind: "let", name, uses: [name] } and ' +
        '{ kind: "fn", name, params: [name], body: [statement] }. Write resolve(program) ' +
        'returning { bindings, references, captures }. A binding is { id, name, scope } with ' +
        'ids allocated in declaration order from 0; a scope is a number, 0 for the top level ' +
        'and a fresh one per function, allocated in the order functions are entered. A ' +
        'reference is { name, binding } where binding is the ID of the innermost binding in ' +
        'scope at that point, or -1 when nothing binds it. A `let` is in scope for the ' +
        'statements AFTER it; parameters are in scope for the whole body; a function name is ' +
        'in scope from its declaration onward, including inside itself. A capture is ' +
        '{ fn, binding } for each reference inside a function to a binding whose scope is not ' +
        'that function\'s. The starter resolves by name against a flat map, so a shadowed name ' +
        'resolves to whichever binding was declared last anywhere.',
      entry: 'lab',
      starter: [
        'function resolve(program) {',
        '  const bindings = [];',
        '  const references = [];',
        '  const captures = [];',
        '  // One flat map for the whole program: shadowing is not representable here.',
        '  const byName = {};',
        '  const state = { nextScope: 1 };',
        '',
        '  walk(program, 0, null, { bindings: bindings, references: references,',
        '    captures: captures, byName: byName, state: state });',
        '  return { bindings: bindings, references: references, captures: captures };',
        '}',
        '',
        'function declare(ctx, name, scope) {',
        '  const binding = { id: ctx.bindings.length, name: name, scope: scope };',
        '',
        '  ctx.bindings.push(binding);',
        '  ctx.byName[name] = binding;',
        '  return binding;',
        '}',
        '',
        'function use(ctx, name, scope, fn) {',
        '  const found = ctx.byName[name];',
        '',
        '  ctx.references.push({ name: name, binding: found ? found.id : -1 });',
        '  if (found && fn !== null && found.scope !== scope) {',
        '    ctx.captures.push({ fn: fn, binding: found.id });',
        '  }',
        '}',
        '',
        'function walk(statements, scope, fn, ctx) {',
        '  statements.forEach(function (statement) {',
        '    if (statement.kind === "let") {',
        '      (statement.uses || []).forEach(function (name) { use(ctx, name, scope, fn); });',
        '      declare(ctx, statement.name, scope);',
        '      return;',
        '    }',
        '    declare(ctx, statement.name, scope);',
        '    const inner = ctx.state.nextScope;',
        '',
        '    ctx.state.nextScope += 1;',
        '    statement.params.forEach(function (name) { declare(ctx, name, inner); });',
        '    walk(statement.body, inner, statement.name, ctx);',
        '  });',
        '}',
        '',
        'function lab() { return { resolve: resolve }; }'
      ].join('\n'),
      solution: [
        'function resolve(program) {',
        '  const ctx = { bindings: [], references: [], captures: [], state: { nextScope: 1 } };',
        '',
        '  walk(program, { scope: 0, fn: null, names: [], parent: null }, ctx);',
        '  return { bindings: ctx.bindings, references: ctx.references, captures: ctx.captures };',
        '}',
        '',
        '/* A scope is a list of bindings plus a link outward. Lookup walks it, so',
        '   an inner binding hides an outer one for the references underneath it and',
        '   only for those — which is the whole of shadowing. */',
        'function declare(ctx, env, name) {',
        '  const binding = { id: ctx.bindings.length, name: name, scope: env.scope };',
        '',
        '  ctx.bindings.push(binding);',
        '  env.names.push(binding);',
        '  return binding;',
        '}',
        '',
        'function lookup(env, name) {',
        '  let here = env;',
        '',
        '  while (here) {',
        '    for (let i = here.names.length - 1; i >= 0; i -= 1) {',
        '      if (here.names[i].name === name) return here.names[i];',
        '    }',
        '    here = here.parent;',
        '  }',
        '  return null;',
        '}',
        '',
        'function use(ctx, env, name) {',
        '  const found = lookup(env, name);',
        '',
        '  ctx.references.push({ name: name, binding: found ? found.id : -1 });',
        '  if (found && env.fn !== null && found.scope !== env.scope) {',
        '    ctx.captures.push({ fn: env.fn, binding: found.id });',
        '  }',
        '}',
        '',
        'function walk(statements, env, ctx) {',
        '  statements.forEach(function (statement) {',
        '    if (statement.kind === "let") {',
        '      (statement.uses || []).forEach(function (name) { use(ctx, env, name); });',
        '      declare(ctx, env, statement.name);',
        '      return;',
        '    }',
        '    walkFn(statement, env, ctx);',
        '  });',
        '}',
        '',
        'function walkFn(statement, env, ctx) {',
        '  declare(ctx, env, statement.name);',
        '  const scope = ctx.state.nextScope;',
        '',
        '  ctx.state.nextScope += 1;',
        '  const inner = { scope: scope, fn: statement.name, names: [], parent: env };',
        '',
        '  statement.params.forEach(function (name) { declare(ctx, inner, name); });',
        '  walk(statement.body, inner, ctx);',
        '}',
        '',
        'function lab() { return { resolve: resolve }; }'
      ].join('\n'),
      tests: [
        {
          name: 'a parameter shadows a top-level binding for the references inside the function',
          assert: function (lab, api) {
            const parts = lab();
            /* let a; fn f(a) { let b uses a; } let c uses a; */
            const out = parts.resolve([
              { kind: 'let', name: 'a', uses: [] },
              { kind: 'fn', name: 'f', params: ['a'],
                body: [{ kind: 'let', name: 'b', uses: ['a'] }] },
              { kind: 'let', name: 'c', uses: ['a'] }
            ]);
            const inner = out.references[0];
            const outer = out.references[1];

            api.assert.equal(out.references.length, 2, 'two references to the spelling a');
            api.assert.notEqual(inner.binding, outer.binding,
              'and they resolve to DIFFERENT bindings — resolving by name against a flat map ' +
                'gives both the same answer, and the program still compiles');
            api.assert.equal(out.bindings[inner.binding].scope, 1,
              'the inner one is the parameter, in the function scope');
            api.assert.equal(out.bindings[outer.binding].scope, 0,
              'the outer one is the top-level let');
          }
        },
        {
          name: 'a reference to a binding outside the function is a capture',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.resolve([
              { kind: 'let', name: 'step', uses: [] },
              { kind: 'fn', name: 'f', params: ['n'],
                body: [{ kind: 'let', name: 'r', uses: ['n', 'step'] }] }
            ]);

            api.assert.equal(out.captures.length, 1, 'exactly one capture');
            api.assert.equal(out.captures[0].fn, 'f', 'made by f');
            api.assert.equal(out.bindings[out.captures[0].binding].name, 'step',
              'and it captures step; n is the parameter, which f owns and therefore does not capture');
          }
        },
        {
          name: 'a let is not in scope inside its own initialiser',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.resolve([{ kind: 'let', name: 'a', uses: ['a'] }]);

            api.assert.equal(out.references.length, 1, 'one reference');
            api.assert.equal(out.references[0].binding, -1,
              'and it resolves to nothing, because a let is in scope for the statements after ' +
                'it — declaring first makes a program that reads an uninitialised binding');
          }
        },
        {
          name: 'a function is in scope inside itself, so recursion resolves',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.resolve([
              { kind: 'fn', name: 'go', params: ['n'],
                body: [{ kind: 'let', name: 'r', uses: ['go', 'n'] }] }
            ]);

            api.assert.equal(out.references[0].binding, 0,
              'go resolves to its own declaration, which is binding 0');
            api.assert.equal(out.captures.length, 1,
              'and it counts as a capture, because go is bound in the enclosing scope');
          }
        },
        {
          name: 'two functions each with a parameter of the same name stay separate',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.resolve([
              { kind: 'fn', name: 'f', params: ['x'],
                body: [{ kind: 'let', name: 'a', uses: ['x'] }] },
              { kind: 'fn', name: 'g', params: ['x'],
                body: [{ kind: 'let', name: 'b', uses: ['x'] }] }
            ]);

            api.assert.equal(out.references.length, 2, 'one reference in each function');
            api.assert.notEqual(out.references[0].binding, out.references[1].binding,
              'resolving to two different parameters');
            api.assert.equal(out.captures.length, 0,
              'and neither is a capture, because each function owns its own x');
          }
        }
      ]
    }],

    'type-checking-in-practice': [{
      id: 'unify-and-blame',
      title: 'Unify two types, and report both ends of the disagreement',
      prompt: 'Types are { k: "con", name }, { k: "var", name } and { k: "fn", from, to }. Write ' +
        'unify(left, right, sub) returning { ok, sub } or { ok: false, kind, why } where kind ' +
        'is "clash" or "occurs". Apply the substitution to both sides before comparing; resolve ' +
        'a variable all the way through the substitution rather than one step, or a chain of ' +
        'constraints leaves the first variable stale; and bind a variable to a type only after ' +
        'an occurs check. Then write check(node, expected, sub) for nodes ' +
        '{ kind, span, type } returning either null or a diagnostic { span, related, expected, ' +
        'actual } naming BOTH spans: `span` is the node and `related` is expected.span. The ' +
        'starter resolves one step and skips the occurs check, so it reports a stale type and ' +
        'accepts a type that contains itself.',
      entry: 'lab',
      starter: [
        'function con(name) { return { k: "con", name: name }; }',
        'function tvar(name) { return { k: "var", name: name }; }',
        'function fn(from, to) { return { k: "fn", from: from, to: to }; }',
        '',
        'function show(type) {',
        '  if (type.k === "con") return type.name;',
        '  if (type.k === "var") return type.name;',
        '  return "(" + show(type.from) + " -> " + show(type.to) + ")";',
        '}',
        '',
        'function apply(sub, type) {',
        '  // One step only. A variable bound to another variable is not resolved',
        '  // further, so a chain of constraints leaves the first one stale.',
        '  if (type.k === "var") return sub[type.name] || type;',
        '  if (type.k === "fn") return fn(apply(sub, type.from), apply(sub, type.to));',
        '  return type;',
        '}',
        '',
        'function bind(name, type, sub) {',
        '  const next = {};',
        '',
        '  // No occurs check, so a type that contains itself is accepted.',
        '  Object.keys(sub).forEach(function (key) { next[key] = sub[key]; });',
        '  next[name] = type;',
        '  return { ok: true, sub: next };',
        '}',
        '',
        'function unify(left, right, sub) {',
        '  const a = apply(sub, left);',
        '  const b = apply(sub, right);',
        '',
        '  if (a.k === "var") return bind(a.name, b, sub);',
        '  if (b.k === "var") return bind(b.name, a, sub);',
        '  if (a.k === "fn" && b.k === "fn") {',
        '    const first = unify(a.from, b.from, sub);',
        '',
        '    if (!first.ok) return first;',
        '    return unify(a.to, b.to, first.sub);',
        '  }',
        '  if (a.k === "con" && b.k === "con" && a.name === b.name) return { ok: true, sub: sub };',
        '  return { ok: false, kind: "clash", why: "cannot match " + show(a) + " with " + show(b) };',
        '}',
        '',
        'function check(node, expected, sub) {',
        '  const out = unify(node.type, expected.type, sub || {});',
        '',
        '  if (out.ok) return null;',
        '  return { span: node.span, related: expected.span,',
        '    expected: show(expected.type), actual: show(node.type) };',
        '}',
        '',
        'function lab() {',
        '  return { unify: unify, check: check, apply: apply, show: show,',
        '    con: con, tvar: tvar, fn: fn };',
        '}'
      ].join('\n'),
      solution: [
        'function con(name) { return { k: "con", name: name }; }',
        'function tvar(name) { return { k: "var", name: name }; }',
        'function fn(from, to) { return { k: "fn", from: from, to: to }; }',
        '',
        'function show(type) {',
        '  if (type.k === "con") return type.name;',
        '  if (type.k === "var") return type.name;',
        '  return "(" + show(type.from) + " -> " + show(type.to) + ")";',
        '}',
        '',
        'function apply(sub, type) {',
        '  if (type.k === "var") return sub[type.name] ? apply(sub, sub[type.name]) : type;',
        '  if (type.k === "fn") return fn(apply(sub, type.from), apply(sub, type.to));',
        '  return type;',
        '}',
        '',
        'function occurs(name, type) {',
        '  if (type.k === "var") return type.name === name;',
        '  if (type.k === "fn") return occurs(name, type.from) || occurs(name, type.to);',
        '  return false;',
        '}',
        '',
        'function bind(name, type, sub) {',
        '  if (type.k === "var" && type.name === name) return { ok: true, sub: sub };',
        '  if (occurs(name, type)) {',
        '    return { ok: false, kind: "occurs", why: name + " occurs in " + show(type) };',
        '  }',
        '  const single = {};',
        '  const next = {};',
        '',
        '  single[name] = type;',
        '  // Compose: every value already in the substitution is updated by the new',
        '  // binding, or a variable bound early stops learning from later information.',
        '  Object.keys(sub).forEach(function (key) { next[key] = apply(single, sub[key]); });',
        '  next[name] = type;',
        '  return { ok: true, sub: next };',
        '}',
        '',
        'function unify(left, right, sub) {',
        '  const a = apply(sub, left);',
        '  const b = apply(sub, right);',
        '',
        '  if (a.k === "var") return bind(a.name, b, sub);',
        '  if (b.k === "var") return bind(b.name, a, sub);',
        '  if (a.k === "fn" && b.k === "fn") {',
        '    const first = unify(a.from, b.from, sub);',
        '',
        '    if (!first.ok) return first;',
        '    return unify(a.to, b.to, first.sub);',
        '  }',
        '  if (a.k === "con" && b.k === "con" && a.name === b.name) return { ok: true, sub: sub };',
        '  return { ok: false, kind: "clash", why: "cannot match " + show(a) + " with " + show(b) };',
        '}',
        '',
        'function check(node, expected, sub) {',
        '  const at = sub || {};',
        '  const out = unify(node.type, expected.type, at);',
        '',
        '  if (out.ok) return null;',
        '  // BOTH spans. Naming only one end gives a message true of a great many',
        '  // programs and useful for none of them.',
        '  return { span: node.span, related: expected.span,',
        '    expected: show(apply(at, expected.type)), actual: show(apply(at, node.type)) };',
        '}',
        '',
        'function lab() {',
        '  return { unify: unify, check: check, apply: apply, show: show,',
        '    con: con, tvar: tvar, fn: fn };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a variable meets a type and is bound to it',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.unify(parts.tvar('a'), parts.con('Number'), {});

            api.assert.ok(out.ok, 'a variable unifies with anything');
            api.assert.equal(parts.show(parts.apply(out.sub, parts.tvar('a'))), 'Number',
              'and the substitution carries the answer');

            const arrow = parts.unify(parts.fn(parts.tvar('a'), parts.tvar('b')),
              parts.fn(parts.con('Number'), parts.con('Bool')), {});

            api.assert.ok(arrow.ok, 'function types unify pairwise');
            api.assert.equal(parts.show(parts.apply(arrow.sub, parts.tvar('b'))), 'Bool',
              'binding both variables');
          }
        },
        {
          name: 'composition keeps an early binding up to date',
          assert: function (lab, api) {
            const parts = lab();
            /* a = b, then b = Number. Without composition, a is still b. */
            const first = parts.unify(parts.tvar('a'), parts.tvar('b'), {});

            api.assert.ok(first.ok, 'two variables unify');
            const second = parts.unify(parts.tvar('b'), parts.con('Number'), first.sub);

            api.assert.ok(second.ok, 'and then b learns it is a Number');
            api.assert.equal(parts.show(parts.apply(second.sub, parts.tvar('a'))), 'Number',
              'so a is a Number too — a substitution that does not compose leaves a pointing ' +
                'at b and the final type is stale');
          }
        },
        {
          name: 'the two ways unification fails are told apart',
          assert: function (lab, api) {
            const parts = lab();
            const clash = parts.unify(parts.con('Number'), parts.con('Bool'), {});

            api.assert.equal(clash.ok, false, 'two different constructors cannot be made equal');
            api.assert.equal(clash.kind, 'clash', 'and that is a clash');

            const self = parts.unify(parts.tvar('a'),
              parts.fn(parts.tvar('a'), parts.con('Number')), {});

            api.assert.equal(self.ok, false, 'a cannot equal a function of itself');
            api.assert.equal(self.kind, 'occurs',
              'and that is the occurs check — without it the checker builds a cyclic type and ' +
                'then hangs or prints forever');
          }
        },
        {
          name: 'a diagnostic names both spans and both types',
          assert: function (lab, api) {
            const parts = lab();
            const node = { kind: 'name', span: { start: 42, end: 46 }, type: parts.con('Bool') };
            const expected = { span: { start: 38, end: 46 }, type: parts.con('Number') };
            const out = parts.check(node, expected, {});

            api.assert.ok(out, 'this does not check');
            api.assert.equal(out.span.start, 42, 'the primary span is the expression at fault');
            api.assert.equal(out.related.start, 38,
              'and the related span is whatever imposed the expectation — without it the ' +
                'message names neither end of the disagreement');
            api.assert.equal(out.expected, 'Number', 'what was required');
            api.assert.equal(out.actual, 'Bool', 'and what was found');
            api.assert.equal(parts.check({ kind: 'num', span: { start: 0, end: 1 },
              type: parts.con('Number') }, expected, {}), null,
              'and a node that does check produces no diagnostic at all');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
