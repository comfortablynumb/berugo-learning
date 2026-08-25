/**
 * Graded exercises for the simply typed lambda calculus and Hindley-Milner (M27.4-M27.5).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 * Each exercise exposes its functions through a single `lab()` entry, because
 * the sandbox hands a test exactly one value.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'the-simply-typed-lambda-calculus': [{
      id: 'stlc-checker',
      title: 'Type the simply typed lambda calculus, and name the rule that fails',
      prompt: 'Types are { k: "base", name } and { k: "arrow", from, to }. Terms are ' +
        '{ t: "num" }, { t: "bool" }, { t: "var", name }, { t: "lam", param, type, body }, ' +
        '{ t: "app", left, right } and { t: "if", test, then, other }. Write check(term, ctx) ' +
        'where ctx maps names to types, returning { ok, type, rule } — and on failure ' +
        '{ ok: false, rule, why } naming the rule that could not be applied: T-Var for an ' +
        'unbound name, T-App when the left side is not a function or the argument type does not ' +
        'MATCH exactly, T-If when the guard is not Boolean or the branches disagree. Types are ' +
        'compared structurally; there is no subtyping. Then write firstFailure(term, ctx) ' +
        'returning the rule name of the DEEPEST first failure, or "" when the term types. The ' +
        'starter compares types by their kind only, so it accepts a Number where a function was ' +
        'required.',
      entry: 'lab',
      starter: [
        'function base(name) { return { k: "base", name: name }; }',
        'function arrow(from, to) { return { k: "arrow", from: from, to: to }; }',
        '',
        'function showType(type) {',
        '  if (type.k === "base") return type.name;',
        '  const left = type.from.k === "arrow" ? "(" + showType(type.from) + ")"',
        '    : showType(type.from);',
        '',
        '  return left + " -> " + showType(type.to);',
        '}',
        '',
        'function sameType(a, b) {',
        '  // Kind only: this says Number and Boolean are the same type.',
        '  return a.k === b.k;',
        '}',
        '',
        'function bad(rule, why) { return { ok: false, rule: rule, why: why }; }',
        '',
        'function check(term, ctx) {',
        '  const env = ctx || {};',
        '',
        '  if (term.t === "num") return { ok: true, type: base("Number"), rule: "T-Num" };',
        '  if (term.t === "bool") return { ok: true, type: base("Boolean"), rule: "T-Bool" };',
        '  if (term.t === "var") {',
        '    if (!env[term.name]) return bad("T-Var", term.name + " is not bound");',
        '    return { ok: true, type: env[term.name], rule: "T-Var" };',
        '  }',
        '  if (term.t === "lam") {',
        '    const inner = Object.assign({}, env);',
        '',
        '    inner[term.param] = term.type;',
        '    const body = check(term.body, inner);',
        '',
        '    if (!body.ok) return body;',
        '    return { ok: true, type: arrow(term.type, body.type), rule: "T-Abs" };',
        '  }',
        '  if (term.t === "app") {',
        '    const left = check(term.left, env);',
        '',
        '    if (!left.ok) return left;',
        '    const right = check(term.right, env);',
        '',
        '    if (!right.ok) return right;',
        '    if (left.type.k !== "arrow") {',
        '      return bad("T-App", showType(left.type) + " is not a function type");',
        '    }',
        '    if (!sameType(left.type.from, right.type)) {',
        '      return bad("T-App", "expected " + showType(left.type.from) +',
        '        " but the argument is " + showType(right.type));',
        '    }',
        '    return { ok: true, type: left.type.to, rule: "T-App" };',
        '  }',
        '  const test = check(term.test, env);',
        '',
        '  if (!test.ok) return test;',
        '  const then = check(term.then, env);',
        '',
        '  if (!then.ok) return then;',
        '  const other = check(term.other, env);',
        '',
        '  if (!other.ok) return other;',
        '  if (!sameType(test.type, base("Boolean"))) {',
        '    return bad("T-If", "the guard is " + showType(test.type) + ", not Boolean");',
        '  }',
        '  if (!sameType(then.type, other.type)) {',
        '    return bad("T-If", "the branches are " + showType(then.type) + " and " +',
        '      showType(other.type));',
        '  }',
        '  return { ok: true, type: then.type, rule: "T-If" };',
        '}',
        '',
        'function firstFailure(term, ctx) {',
        '  const out = check(term, ctx);',
        '',
        '  return out.ok ? "" : out.rule;',
        '}',
        '',
        'function lab() {',
        '  return { check: check, firstFailure: firstFailure, showType: showType,',
        '    base: base, arrow: arrow };',
        '}'
      ].join('\n'),
      solution: [
        'function base(name) { return { k: "base", name: name }; }',
        'function arrow(from, to) { return { k: "arrow", from: from, to: to }; }',
        '',
        'function showType(type) {',
        '  if (type.k === "base") return type.name;',
        '  const left = type.from.k === "arrow" ? "(" + showType(type.from) + ")"',
        '    : showType(type.from);',
        '',
        '  return left + " -> " + showType(type.to);',
        '}',
        '',
        'function sameType(a, b) {',
        '  if (a.k !== b.k) return false;',
        '  if (a.k === "base") return a.name === b.name;',
        '  return sameType(a.from, b.from) && sameType(a.to, b.to);',
        '}',
        '',
        'function bad(rule, why) { return { ok: false, rule: rule, why: why }; }',
        '',
        'function check(term, ctx) {',
        '  const env = ctx || {};',
        '',
        '  if (term.t === "num") return { ok: true, type: base("Number"), rule: "T-Num" };',
        '  if (term.t === "bool") return { ok: true, type: base("Boolean"), rule: "T-Bool" };',
        '  if (term.t === "var") {',
        '    if (!env[term.name]) return bad("T-Var", term.name + " is not bound");',
        '    return { ok: true, type: env[term.name], rule: "T-Var" };',
        '  }',
        '  if (term.t === "lam") {',
        '    const inner = Object.assign({}, env);',
        '',
        '    inner[term.param] = term.type;',
        '    const body = check(term.body, inner);',
        '',
        '    if (!body.ok) return body;',
        '    return { ok: true, type: arrow(term.type, body.type), rule: "T-Abs" };',
        '  }',
        '  if (term.t === "app") {',
        '    const left = check(term.left, env);',
        '',
        '    if (!left.ok) return left;',
        '    const right = check(term.right, env);',
        '',
        '    if (!right.ok) return right;',
        '    if (left.type.k !== "arrow") {',
        '      return bad("T-App", showType(left.type) + " is not a function type");',
        '    }',
        '    if (!sameType(left.type.from, right.type)) {',
        '      return bad("T-App", "expected " + showType(left.type.from) +',
        '        " but the argument is " + showType(right.type));',
        '    }',
        '    return { ok: true, type: left.type.to, rule: "T-App" };',
        '  }',
        '  const test = check(term.test, env);',
        '',
        '  if (!test.ok) return test;',
        '  const then = check(term.then, env);',
        '',
        '  if (!then.ok) return then;',
        '  const other = check(term.other, env);',
        '',
        '  if (!other.ok) return other;',
        '  if (!sameType(test.type, base("Boolean"))) {',
        '    return bad("T-If", "the guard is " + showType(test.type) + ", not Boolean");',
        '  }',
        '  if (!sameType(then.type, other.type)) {',
        '    return bad("T-If", "the branches are " + showType(then.type) + " and " +',
        '      showType(other.type));',
        '  }',
        '  return { ok: true, type: then.type, rule: "T-If" };',
        '}',
        '',
        'function firstFailure(term, ctx) {',
        '  const out = check(term, ctx);',
        '',
        '  return out.ok ? "" : out.rule;',
        '}',
        '',
        'function lab() {',
        '  return { check: check, firstFailure: firstFailure, showType: showType,',
        '    base: base, arrow: arrow };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'well-typed terms get the type the rules give them',
          assert: function (lab, api) {
            const parts = lab();
            const num = { t: 'num' };
            const N = parts.base('Number');
            const twice = { t: 'lam', param: 'f', type: parts.arrow(N, N),
              body: { t: 'lam', param: 'x', type: N,
                body: { t: 'app', left: { t: 'var', name: 'f' },
                  right: { t: 'app', left: { t: 'var', name: 'f' },
                    right: { t: 'var', name: 'x' } } } } };
            const out = parts.check(twice, {});

            api.assert.ok(out.ok, 'the twice combinator is well typed');
            api.assert.equal(parts.showType(out.type), '(Number -> Number) -> Number -> Number',
              'and its type is exactly this');
            api.assert.ok(parts.check({ t: 'app',
              left: { t: 'lam', param: 'x', type: N, body: { t: 'var', name: 'x' } },
              right: num }, {}).ok, 'applying the identity to a number types');
          }
        },
        {
          name: 'the argument type must match exactly — there is no subtyping here',
          assert: function (lab, api) {
            const parts = lab();
            const N = parts.base('Number');
            const identity = { t: 'lam', param: 'x', type: N, body: { t: 'var', name: 'x' } };
            const out = parts.check({ t: 'app', left: identity, right: { t: 'bool' } }, {});

            api.assert.ok(!out.ok, 'applying a Number -> Number to a Boolean must be rejected');
            api.assert.equal(out.rule, 'T-App',
              'and T-App is the rule that could not be applied — comparing types by kind alone ' +
                'would accept this, because both are base types');
          }
        },
        {
          name: 'a function type is not a base type, and both directions matter',
          assert: function (lab, api) {
            const parts = lab();
            const N = parts.base('Number');
            const fn = parts.arrow(N, N);
            const takesFn = { t: 'lam', param: 'f', type: fn, body: { t: 'var', name: 'f' } };
            const out = parts.check({ t: 'app', left: takesFn, right: { t: 'num' } }, {});

            api.assert.ok(!out.ok,
              'passing a Number where Number -> Number is required must be rejected — a check ' +
                'that only compares kinds accepts it, because arrow and base differ but the ' +
                'comparison never gets that far');
            api.assert.equal(out.rule, 'T-App', 'reported by T-App');
            api.assert.equal(parts.firstFailure({ t: 'app', left: { t: 'num' },
              right: { t: 'num' } }, {}), 'T-App',
              'a Number applied to anything is not a function type');
          }
        },
        {
          name: 'the conditional needs a Boolean guard and matching branches',
          assert: function (lab, api) {
            const parts = lab();
            const iff = function (c, t, e) { return { t: 'if', test: c, then: t, other: e }; };

            api.assert.equal(parts.firstFailure(iff({ t: 'num' }, { t: 'num' },
              { t: 'num' }), {}), 'T-If', 'a number as a guard is rejected by T-If');
            api.assert.equal(parts.firstFailure(iff({ t: 'bool' }, { t: 'num' },
              { t: 'bool' }), {}), 'T-If',
              'branches of different types are rejected by T-If — and a kind-only comparison ' +
                'would let Number and Boolean through');
            api.assert.equal(parts.firstFailure(iff({ t: 'bool' }, { t: 'num' },
              { t: 'num' }), {}), '', 'and a well-formed conditional types');
          }
        },
        {
          name: 'an unbound variable is reported by T-Var',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.firstFailure({ t: 'var', name: 'x' }, {}), 'T-Var',
              'nothing binds x');
            api.assert.equal(parts.firstFailure({ t: 'var', name: 'x' },
              { x: parts.base('Number') }), '', 'and with x in the context it types');
          }
        }
      ]
    }],
    'type-inference-and-hindley-milner': [{
      id: 'unify-and-generalise',
      title: 'Unify with the occurs check, and generalise only at let',
      prompt: 'Types are { k: "var", name } and { k: "con", name, args }. Write ' +
        'unify(left, right) returning { ok, sub } or { ok: false, kind, why } where kind is ' +
        '"clash" or "occurs". Binding a variable to a type that CONTAINS it must fail with ' +
        'kind "occurs" — that equation has no finite solution. Constructors must agree in name ' +
        'and arity, and their arguments unify pairwise with the substitution built so far ' +
        'applied first. Write compose(outer, inner) so that every value of `inner` has `outer` ' +
        'applied to it, and apply(sub, type) as a SINGLE lookup — composition keeps the ' +
        'substitution idempotent, so chasing a binding twice is unnecessary and can loop. Then ' +
        'write generalise(env, type) returning the sorted list of variable names free in `type` ' +
        'and not free in any type in `env`. The starter omits the occurs check.',
      entry: 'lab',
      starter: [
        'function tvar(name) { return { k: "var", name: name }; }',
        'function tcon(name, args) { return { k: "con", name: name, args: args || [] }; }',
        '',
        'function freeVars(type, into) {',
        '  const found = into || [];',
        '',
        '  if (type.k === "var") {',
        '    if (found.indexOf(type.name) === -1) found.push(type.name);',
        '    return found;',
        '  }',
        '  type.args.forEach(function (arg) { freeVars(arg, found); });',
        '  return found;',
        '}',
        '',
        'function apply(sub, type) {',
        '  if (type.k === "var") return sub[type.name] === undefined ? type : sub[type.name];',
        '  return tcon(type.name, type.args.map(function (a) { return apply(sub, a); }));',
        '}',
        '',
        'function compose(outer, inner) {',
        '  const out = {};',
        '',
        '  Object.keys(inner).forEach(function (n) { out[n] = apply(outer, inner[n]); });',
        '  Object.keys(outer).forEach(function (n) {',
        '    if (out[n] === undefined) out[n] = outer[n];',
        '  });',
        '  return out;',
        '}',
        '',
        'function bind(name, type) {',
        '  if (type.k === "var" && type.name === name) return { ok: true, sub: {} };',
        '  // No occurs check: binding a to a -> b builds a type that contains itself.',
        '  const sub = {};',
        '',
        '  sub[name] = type;',
        '  return { ok: true, sub: sub };',
        '}',
        '',
        'function unify(left, right) {',
        '  if (left.k === "var") return bind(left.name, right);',
        '  if (right.k === "var") return bind(right.name, left);',
        '  if (left.name !== right.name || left.args.length !== right.args.length) {',
        '    return { ok: false, kind: "clash",',
        '      why: "cannot match " + left.name + " with " + right.name };',
        '  }',
        '  let sub = {};',
        '',
        '  for (let i = 0; i < left.args.length; i += 1) {',
        '    const step = unify(apply(sub, left.args[i]), apply(sub, right.args[i]));',
        '',
        '    if (!step.ok) return step;',
        '    sub = compose(step.sub, sub);',
        '  }',
        '  return { ok: true, sub: sub };',
        '}',
        '',
        'function generalise(env, type) {',
        '  const bound = [];',
        '',
        '  Object.keys(env).forEach(function (name) { freeVars(env[name], bound); });',
        '  return freeVars(type, []).filter(function (n) {',
        '    return bound.indexOf(n) === -1;',
        '  }).sort();',
        '}',
        '',
        'function lab() {',
        '  return { unify: unify, apply: apply, compose: compose, generalise: generalise,',
        '    tvar: tvar, tcon: tcon };',
        '}'
      ].join('\n'),
      solution: [
        'function tvar(name) { return { k: "var", name: name }; }',
        'function tcon(name, args) { return { k: "con", name: name, args: args || [] }; }',
        '',
        'function freeVars(type, into) {',
        '  const found = into || [];',
        '',
        '  if (type.k === "var") {',
        '    if (found.indexOf(type.name) === -1) found.push(type.name);',
        '    return found;',
        '  }',
        '  type.args.forEach(function (arg) { freeVars(arg, found); });',
        '  return found;',
        '}',
        '',
        'function apply(sub, type) {',
        '  if (type.k === "var") return sub[type.name] === undefined ? type : sub[type.name];',
        '  return tcon(type.name, type.args.map(function (a) { return apply(sub, a); }));',
        '}',
        '',
        'function compose(outer, inner) {',
        '  const out = {};',
        '',
        '  Object.keys(inner).forEach(function (n) { out[n] = apply(outer, inner[n]); });',
        '  Object.keys(outer).forEach(function (n) {',
        '    if (out[n] === undefined) out[n] = outer[n];',
        '  });',
        '  return out;',
        '}',
        '',
        'function bind(name, type) {',
        '  if (type.k === "var" && type.name === name) return { ok: true, sub: {} };',
        '  if (freeVars(type, []).indexOf(name) !== -1) {',
        '    return { ok: false, kind: "occurs",',
        '      why: name + " appears inside the type, so the equation has no finite solution" };',
        '  }',
        '  const sub = {};',
        '',
        '  sub[name] = type;',
        '  return { ok: true, sub: sub };',
        '}',
        '',
        'function unify(left, right) {',
        '  if (left.k === "var") return bind(left.name, right);',
        '  if (right.k === "var") return bind(right.name, left);',
        '  if (left.name !== right.name || left.args.length !== right.args.length) {',
        '    return { ok: false, kind: "clash",',
        '      why: "cannot match " + left.name + " with " + right.name };',
        '  }',
        '  let sub = {};',
        '',
        '  for (let i = 0; i < left.args.length; i += 1) {',
        '    const step = unify(apply(sub, left.args[i]), apply(sub, right.args[i]));',
        '',
        '    if (!step.ok) return step;',
        '    sub = compose(step.sub, sub);',
        '  }',
        '  return { ok: true, sub: sub };',
        '}',
        '',
        'function generalise(env, type) {',
        '  const bound = [];',
        '',
        '  Object.keys(env).forEach(function (name) { freeVars(env[name], bound); });',
        '  return freeVars(type, []).filter(function (n) {',
        '    return bound.indexOf(n) === -1;',
        '  }).sort();',
        '}',
        '',
        'function lab() {',
        '  return { unify: unify, apply: apply, compose: compose, generalise: generalise,',
        '    tvar: tvar, tcon: tcon };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the occurs check refuses an equation with no finite solution',
          assert: function (lab, api) {
            const parts = lab();
            const a = parts.tvar('a');
            const arrow = parts.tcon('->', [parts.tvar('a'), parts.tvar('b')]);
            const out = parts.unify(a, arrow);

            api.assert.ok(!out.ok,
              'unifying a with a -> b must fail: no finite type satisfies it, and accepting it ' +
                'builds a cyclic structure that makes the checker hang');
            api.assert.equal(out.kind, 'occurs',
              'and the failure is the occurs check, not a clash — they need different fixes');
          }
        },
        {
          name: 'a variable still unifies with a type that does not contain it',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.unify(parts.tvar('a'),
              parts.tcon('->', [parts.tcon('Number', []), parts.tvar('b')]));

            api.assert.ok(out.ok,
              'a -> b does not mention a on the right of the equation for a variable named a... ' +
                'but a -> b for the variable a DOES. Here the variable is a and the type is ' +
                'Number -> b, which is fine — an over-eager occurs check would reject it');
            api.assert.equal(parts.apply(out.sub, parts.tvar('a')).name, '->',
              'and a is bound to the arrow type');
          }
        },
        {
          name: 'clashes are reported as clashes',
          assert: function (lab, api) {
            const parts = lab();
            const N = parts.tcon('Number', []);
            const B = parts.tcon('Boolean', []);

            api.assert.equal(parts.unify(parts.tcon('List', [parts.tvar('a')]),
              parts.tcon('Pair', [parts.tvar('a'), parts.tvar('b')])).kind, 'clash',
              'different constructors clash');

            const sameVar = parts.unify(parts.tcon('->', [parts.tvar('a'), parts.tvar('a')]),
              parts.tcon('->', [N, B]));

            api.assert.ok(!sameVar.ok,
              'a -> a against Number -> Boolean must fail: a cannot be both');
            api.assert.equal(sameVar.kind, 'clash', 'and it is a clash, not an occurs failure');
          }
        },
        {
          name: 'bindings chain through the substitution',
          assert: function (lab, api) {
            const parts = lab();
            const N = parts.tcon('Number', []);
            const left = parts.tcon('->',
              [parts.tcon('->', [parts.tvar('a'), parts.tvar('b')]), parts.tvar('a')]);
            const right = parts.tcon('->',
              [parts.tcon('->', [N, parts.tvar('c')]), parts.tvar('d')]);
            const out = parts.unify(left, right);

            api.assert.ok(out.ok, '(a -> b) -> a against (Number -> c) -> d unifies');
            api.assert.equal(parts.apply(out.sub, parts.tvar('a')).name, 'Number',
              'a is Number');
            api.assert.equal(parts.apply(out.sub, parts.tvar('d')).name, 'Number',
              'and d picks that up through composition — a substitution that did not apply the ' +
                'outer one to the inner values would leave d bound to a');
          }
        },
        {
          name: 'generalisation quantifies only what the environment does not mention',
          assert: function (lab, api) {
            const parts = lab();
            const type = parts.tcon('->', [parts.tvar('a'), parts.tvar('b')]);

            api.assert.deepEqual(parts.generalise({}, type), ['a', 'b'],
              'with an empty environment both variables are free to quantify');
            api.assert.deepEqual(parts.generalise({ x: parts.tvar('a') }, type), ['b'],
              'a is mentioned by the environment, so only b may be generalised — quantifying a ' +
                'would let a use site pick a type the environment has already fixed');
            api.assert.deepEqual(parts.generalise({ x: type }, type), [],
              'when the environment mentions both, nothing is generalised');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
