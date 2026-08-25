/**
 * Graded exercises for System F and subtyping (M27.6-M27.7).
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
    'polymorphism-and-system-f': [{
      id: 'system-f-checker',
      title: 'Check System F, and count what a polymorphic type can contain',
      prompt: 'Types are { k: "tvar", name }, { k: "arrow", from, to } and ' +
        '{ k: "forall", param, body }. Terms add { t: "tlam", param, body } and ' +
        '{ t: "tapp", term, type } to the usual three. Write check(term, ctx) returning ' +
        '{ ok, type } or { ok: false, why }: T-TAbs types a Λ by checking the body and wrapping ' +
        'the result in a ∀; T-TApp requires the term to have a ∀ type and SUBSTITUTES the ' +
        'supplied type for the bound variable in its body. Type equality must be up to renaming ' +
        'of bound type variables, so ∀a. a -> a equals ∀b. b -> b. Then write ' +
        'inhabitants(type) returning the count of closed normal forms built only from ' +
        'abstractions and variables — for ∀α. α → α that is 1. The starter substitutes into a ' +
        'nested ∀ that rebinds the same name, so it captures.',
      entry: 'lab',
      starter: [
        'function tvar(name) { return { k: "tvar", name: name }; }',
        'function arrow(from, to) { return { k: "arrow", from: from, to: to }; }',
        'function forall(param, body) { return { k: "forall", param: param, body: body }; }',
        '',
        'function showType(type) {',
        '  if (type.k === "tvar") return type.name;',
        '  if (type.k === "arrow") {',
        '    const left = type.from.k === "tvar" ? showType(type.from)',
        '      : "(" + showType(type.from) + ")";',
        '',
        '    return left + " -> " + showType(type.to);',
        '  }',
        '  return "forall " + type.param + ". " + showType(type.body);',
        '}',
        '',
        'function substType(type, name, value) {',
        '  if (type.k === "tvar") return type.name === name ? value : type;',
        '  if (type.k === "arrow") {',
        '    return arrow(substType(type.from, name, value), substType(type.to, name, value));',
        '  }',
        '  // No shadowing check: a nested forall binding the same name is substituted into.',
        '  return forall(type.param, substType(type.body, name, value));',
        '}',
        '',
        'function normalise(type, map, counter) {',
        '  const seen = map || {};',
        '  const count = counter || { n: 0 };',
        '',
        '  if (type.k === "tvar") return tvar(seen[type.name] || type.name);',
        '  if (type.k === "arrow") {',
        '    return arrow(normalise(type.from, seen, count), normalise(type.to, seen, count));',
        '  }',
        '  const next = Object.assign({}, seen);',
        '  const fresh = "#" + count.n;',
        '',
        '  count.n += 1;',
        '  next[type.param] = fresh;',
        '  return forall(fresh, normalise(type.body, next, count));',
        '}',
        '',
        'function sameType(a, b) {',
        '  return showType(normalise(a, {}, { n: 0 })) === showType(normalise(b, {}, { n: 0 }));',
        '}',
        '',
        'function check(term, ctx) {',
        '  const env = ctx || {};',
        '',
        '  if (term.t === "var") {',
        '    if (!env[term.name]) return { ok: false, why: term.name + " is unbound" };',
        '    return { ok: true, type: env[term.name] };',
        '  }',
        '  if (term.t === "lam") {',
        '    const inner = Object.assign({}, env);',
        '',
        '    inner[term.param] = term.type;',
        '    const body = check(term.body, inner);',
        '',
        '    return body.ok ? { ok: true, type: arrow(term.type, body.type) } : body;',
        '  }',
        '  if (term.t === "tlam") {',
        '    const body = check(term.body, env);',
        '',
        '    return body.ok ? { ok: true, type: forall(term.param, body.type) } : body;',
        '  }',
        '  if (term.t === "tapp") {',
        '    const inner = check(term.term, env);',
        '',
        '    if (!inner.ok) return inner;',
        '    if (inner.type.k !== "forall") {',
        '      return { ok: false, why: showType(inner.type) + " is not a forall type" };',
        '    }',
        '    return { ok: true, type: substType(inner.type.body, inner.type.param, term.type) };',
        '  }',
        '  const left = check(term.left, env);',
        '',
        '  if (!left.ok) return left;',
        '  const right = check(term.right, env);',
        '',
        '  if (!right.ok) return right;',
        '  if (left.type.k !== "arrow") {',
        '    return { ok: false, why: showType(left.type) + " is not a function type" };',
        '  }',
        '  if (!sameType(left.type.from, right.type)) {',
        '    return { ok: false, why: "expected " + showType(left.type.from) +',
        '      " but the argument is " + showType(right.type) };',
        '  }',
        '  return { ok: true, type: left.type.to };',
        '}',
        '',
        'function search(type, scope, fuel) {',
        '  if (fuel < 0) return 0;',
        '  if (type.k === "forall") return search(type.body, scope, fuel - 1);',
        '  if (type.k === "arrow") {',
        '    return search(type.to, scope.concat([showType(type.from)]), fuel - 1);',
        '  }',
        '  return scope.filter(function (t) { return t === showType(type); }).length;',
        '}',
        '',
        'function inhabitants(type) { return search(type, [], 6); }',
        '',
        'function lab() {',
        '  return { check: check, inhabitants: inhabitants, showType: showType,',
        '    sameType: sameType, tvar: tvar, arrow: arrow, forall: forall };',
        '}'
      ].join('\n'),
      solution: [
        'function tvar(name) { return { k: "tvar", name: name }; }',
        'function arrow(from, to) { return { k: "arrow", from: from, to: to }; }',
        'function forall(param, body) { return { k: "forall", param: param, body: body }; }',
        '',
        'function showType(type) {',
        '  if (type.k === "tvar") return type.name;',
        '  if (type.k === "arrow") {',
        '    const left = type.from.k === "tvar" ? showType(type.from)',
        '      : "(" + showType(type.from) + ")";',
        '',
        '    return left + " -> " + showType(type.to);',
        '  }',
        '  return "forall " + type.param + ". " + showType(type.body);',
        '}',
        '',
        'function substType(type, name, value) {',
        '  if (type.k === "tvar") return type.name === name ? value : type;',
        '  if (type.k === "arrow") {',
        '    return arrow(substType(type.from, name, value), substType(type.to, name, value));',
        '  }',
        '  if (type.param === name) return type;',
        '  return forall(type.param, substType(type.body, name, value));',
        '}',
        '',
        'function normalise(type, map, counter) {',
        '  const seen = map || {};',
        '  const count = counter || { n: 0 };',
        '',
        '  if (type.k === "tvar") return tvar(seen[type.name] || type.name);',
        '  if (type.k === "arrow") {',
        '    return arrow(normalise(type.from, seen, count), normalise(type.to, seen, count));',
        '  }',
        '  const next = Object.assign({}, seen);',
        '  const fresh = "#" + count.n;',
        '',
        '  count.n += 1;',
        '  next[type.param] = fresh;',
        '  return forall(fresh, normalise(type.body, next, count));',
        '}',
        '',
        'function sameType(a, b) {',
        '  return showType(normalise(a, {}, { n: 0 })) === showType(normalise(b, {}, { n: 0 }));',
        '}',
        '',
        'function check(term, ctx) {',
        '  const env = ctx || {};',
        '',
        '  if (term.t === "var") {',
        '    if (!env[term.name]) return { ok: false, why: term.name + " is unbound" };',
        '    return { ok: true, type: env[term.name] };',
        '  }',
        '  if (term.t === "lam") {',
        '    const inner = Object.assign({}, env);',
        '',
        '    inner[term.param] = term.type;',
        '    const body = check(term.body, inner);',
        '',
        '    return body.ok ? { ok: true, type: arrow(term.type, body.type) } : body;',
        '  }',
        '  if (term.t === "tlam") {',
        '    const body = check(term.body, env);',
        '',
        '    return body.ok ? { ok: true, type: forall(term.param, body.type) } : body;',
        '  }',
        '  if (term.t === "tapp") {',
        '    const inner = check(term.term, env);',
        '',
        '    if (!inner.ok) return inner;',
        '    if (inner.type.k !== "forall") {',
        '      return { ok: false, why: showType(inner.type) + " is not a forall type" };',
        '    }',
        '    return { ok: true, type: substType(inner.type.body, inner.type.param, term.type) };',
        '  }',
        '  const left = check(term.left, env);',
        '',
        '  if (!left.ok) return left;',
        '  const right = check(term.right, env);',
        '',
        '  if (!right.ok) return right;',
        '  if (left.type.k !== "arrow") {',
        '    return { ok: false, why: showType(left.type) + " is not a function type" };',
        '  }',
        '  if (!sameType(left.type.from, right.type)) {',
        '    return { ok: false, why: "expected " + showType(left.type.from) +',
        '      " but the argument is " + showType(right.type) };',
        '  }',
        '  return { ok: true, type: left.type.to };',
        '}',
        '',
        'function search(type, scope, fuel) {',
        '  if (fuel < 0) return 0;',
        '  if (type.k === "forall") return search(type.body, scope, fuel - 1);',
        '  if (type.k === "arrow") {',
        '    return search(type.to, scope.concat([showType(type.from)]), fuel - 1);',
        '  }',
        '  return scope.filter(function (t) { return t === showType(type); }).length;',
        '}',
        '',
        'function inhabitants(type) { return search(type, [], 6); }',
        '',
        'function lab() {',
        '  return { check: check, inhabitants: inhabitants, showType: showType,',
        '    sameType: sameType, tvar: tvar, arrow: arrow, forall: forall };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the polymorphic identity types, and specialises',
          assert: function (lab, api) {
            const parts = lab();
            const id = { t: 'tlam', param: 'a',
              body: { t: 'lam', param: 'x', type: parts.tvar('a'),
                body: { t: 'var', name: 'x' } } };
            const out = parts.check(id, {});

            api.assert.ok(out.ok, 'the polymorphic identity is well typed');
            api.assert.equal(parts.showType(out.type), 'forall a. a -> a', 'with this type');

            const specialised = parts.check({ t: 'tapp', term: id,
              type: parts.tvar('Nat') }, {});

            api.assert.equal(parts.showType(specialised.type), 'Nat -> Nat',
              'and a type application substitutes Nat for a');
          }
        },
        {
          name: 'type substitution stops at a shadowing binder',
          assert: function (lab, api) {
            const parts = lab();
            const inner = parts.forall('a', parts.arrow(parts.tvar('a'), parts.tvar('a')));
            const outer = { t: 'tlam', param: 'a',
              body: { t: 'lam', param: 'f', type: inner,
                body: { t: 'var', name: 'f' } } };
            const checked = parts.check(outer, {});

            api.assert.ok(checked.ok, 'the term itself types');
            const applied = parts.check({ t: 'tapp', term: outer,
              type: parts.tvar('Nat') }, {});

            api.assert.equal(parts.showType(applied.type),
              '(forall a. a -> a) -> forall a. a -> a',
              'the inner forall rebinds a, so substituting Nat for the OUTER a must not reach ' +
                'inside it — a substitution without the shadowing check produces ' +
                '(forall a. Nat -> Nat) and captures');
          }
        },
        {
          name: 'type equality is up to renaming of bound variables',
          assert: function (lab, api) {
            const parts = lab();
            const one = parts.forall('a', parts.arrow(parts.tvar('a'), parts.tvar('a')));
            const two = parts.forall('b', parts.arrow(parts.tvar('b'), parts.tvar('b')));

            api.assert.ok(parts.sameType(one, two),
              'forall a. a -> a and forall b. b -> b are the same type');
            api.assert.ok(!parts.sameType(one,
              parts.forall('a', parts.arrow(parts.tvar('a'), parts.tvar('c')))),
              'and forall a. a -> c is not, because c is free');
          }
        },
        {
          name: 'a type application to something with no forall is rejected',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check({ t: 'tapp',
              term: { t: 'var', name: 'zero' }, type: parts.tvar('Nat') },
            { zero: parts.tvar('Nat') });

            api.assert.ok(!out.ok, 'zero takes no type argument');
            api.assert.ok(out.why.indexOf('forall') !== -1,
              'and the reason says so rather than reporting a generic failure');
          }
        },
        {
          name: 'the inhabitant counts are what parametricity predicts',
          assert: function (lab, api) {
            const parts = lab();
            const a = parts.tvar('a');
            const b = parts.tvar('b');

            api.assert.equal(parts.inhabitants(parts.forall('a', parts.arrow(a, a))), 1,
              'exactly one closed term of forall a. a -> a: the identity');
            api.assert.equal(parts.inhabitants(parts.forall('a', parts.arrow(a,
              parts.arrow(a, a)))), 2,
              'two of forall a. a -> a -> a: return the first, or the second');
            api.assert.equal(parts.inhabitants(parts.forall('a', a)), 0,
              'none of forall a. a — this is the empty type');
            api.assert.equal(parts.inhabitants(parts.forall('a',
              parts.forall('b', parts.arrow(a, b)))), 0,
              'and none of forall a b. a -> b: there is no way to make a b');
          }
        }
      ]
    }],
    'subtyping-and-variance': [{
      id: 'variance-and-witnesses',
      title: 'Get the function rule right, and find the value that breaks the unsound one',
      prompt: 'Types are { k: "prim", name }, { k: "arrow", from, to } and ' +
        '{ k: "gen", name, args }. A primitive hierarchy maps each name to its declared ' +
        'parents. Write isSubtype(left, right) with the FUNCTION rule correct: ' +
        'S1 -> S2 is a subtype of T1 -> T2 when T1 is a subtype of S1 — the argument goes the ' +
        'other way — and S2 is a subtype of T2. For a generic, consult the variance of each ' +
        'parameter: covariant checks left against right, contravariant checks right against ' +
        'left, invariant requires both directions. Then write findWitness(container, narrow, ' +
        'wide) returning the name of a value the WIDE element type accepts and the NARROW one ' +
        'does not, when the container\'s rule admits the pair — or "" otherwise. The starter ' +
        'makes the argument position covariant, which is the unsound rule.',
      entry: 'lab',
      starter: [
        'const PARENTS = { Integer: ["Number"], Double: ["Number"], Number: ["Value"],',
        '  String: ["Value"], Boolean: ["Value"], Value: [] };',
        '',
        'const VARIANCE = { List: ["covariant"], Sink: ["contravariant"],',
        '  Ref: ["invariant"], CovariantArray: ["covariant"], Array: ["invariant"] };',
        '',
        'function prim(name) { return { k: "prim", name: name }; }',
        'function arrow(from, to) { return { k: "arrow", from: from, to: to }; }',
        'function gen(name, args) { return { k: "gen", name: name, args: args }; }',
        '',
        'function below(from, to) {',
        '  if (from === to) return true;',
        '  return (PARENTS[from] || []).some(function (p) { return below(p, to); });',
        '}',
        '',
        'function isSubtype(left, right) {',
        '  if (left.k === "prim" && right.k === "prim") return below(left.name, right.name);',
        '  if (left.k === "arrow" && right.k === "arrow") {',
        '    // Covariant argument: this is the unsound rule.',
        '    return isSubtype(left.from, right.from) && isSubtype(left.to, right.to);',
        '  }',
        '  if (left.k === "gen" && right.k === "gen") {',
        '    if (left.name !== right.name || left.args.length !== right.args.length) return false;',
        '    const variances = VARIANCE[left.name] || [];',
        '',
        '    return left.args.every(function (arg, i) {',
        '      if (variances[i] === "covariant") return isSubtype(arg, right.args[i]);',
        '      if (variances[i] === "contravariant") return isSubtype(right.args[i], arg);',
        '      return isSubtype(arg, right.args[i]) && isSubtype(right.args[i], arg);',
        '    });',
        '  }',
        '  return false;',
        '}',
        '',
        'function findWitness(container, narrow, wide) {',
        '  if (!isSubtype(gen(container, [prim(narrow)]), gen(container, [prim(wide)]))) return "";',
        '  const candidates = ["Integer", "Double", "Number", "String"];',
        '  const bad = candidates.filter(function (name) {',
        '    return below(name, wide) && !below(name, narrow);',
        '  });',
        '',
        '  return bad.length === 0 ? "" : bad[0];',
        '}',
        '',
        'function lab() {',
        '  return { isSubtype: isSubtype, findWitness: findWitness,',
        '    prim: prim, arrow: arrow, gen: gen };',
        '}'
      ].join('\n'),
      solution: [
        'const PARENTS = { Integer: ["Number"], Double: ["Number"], Number: ["Value"],',
        '  String: ["Value"], Boolean: ["Value"], Value: [] };',
        '',
        'const VARIANCE = { List: ["covariant"], Sink: ["contravariant"],',
        '  Ref: ["invariant"], CovariantArray: ["covariant"], Array: ["invariant"] };',
        '',
        'function prim(name) { return { k: "prim", name: name }; }',
        'function arrow(from, to) { return { k: "arrow", from: from, to: to }; }',
        'function gen(name, args) { return { k: "gen", name: name, args: args }; }',
        '',
        'function below(from, to) {',
        '  if (from === to) return true;',
        '  return (PARENTS[from] || []).some(function (p) { return below(p, to); });',
        '}',
        '',
        'function isSubtype(left, right) {',
        '  if (left.k === "prim" && right.k === "prim") return below(left.name, right.name);',
        '  if (left.k === "arrow" && right.k === "arrow") {',
        '    return isSubtype(right.from, left.from) && isSubtype(left.to, right.to);',
        '  }',
        '  if (left.k === "gen" && right.k === "gen") {',
        '    if (left.name !== right.name || left.args.length !== right.args.length) return false;',
        '    const variances = VARIANCE[left.name] || [];',
        '',
        '    return left.args.every(function (arg, i) {',
        '      if (variances[i] === "covariant") return isSubtype(arg, right.args[i]);',
        '      if (variances[i] === "contravariant") return isSubtype(right.args[i], arg);',
        '      return isSubtype(arg, right.args[i]) && isSubtype(right.args[i], arg);',
        '    });',
        '  }',
        '  return false;',
        '}',
        '',
        'function findWitness(container, narrow, wide) {',
        '  if (!isSubtype(gen(container, [prim(narrow)]), gen(container, [prim(wide)]))) return "";',
        '  const candidates = ["Integer", "Double", "Number", "String"];',
        '  const bad = candidates.filter(function (name) {',
        '    return below(name, wide) && !below(name, narrow);',
        '  });',
        '',
        '  return bad.length === 0 ? "" : bad[0];',
        '}',
        '',
        'function lab() {',
        '  return { isSubtype: isSubtype, findWitness: findWitness,',
        '    prim: prim, arrow: arrow, gen: gen };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the argument position is contravariant',
          assert: function (lab, api) {
            const parts = lab();
            const I = parts.prim('Integer');
            const N = parts.prim('Number');

            api.assert.ok(parts.isSubtype(parts.arrow(N, I), parts.arrow(I, N)),
              'Number -> Integer is usable where Integer -> Number is expected: it accepts ' +
                'more and returns less');
            api.assert.ok(!parts.isSubtype(parts.arrow(I, I), parts.arrow(N, N)),
              'Integer -> Integer is NOT usable where Number -> Number is expected — it would ' +
                'refuse a Double. A covariant argument rule accepts this, and that is the bug.');
          }
        },
        {
          name: 'the result position is covariant',
          assert: function (lab, api) {
            const parts = lab();
            const I = parts.prim('Integer');
            const N = parts.prim('Number');

            api.assert.ok(parts.isSubtype(parts.arrow(N, I), parts.arrow(N, N)),
              'returning something more specific is always fine');
            api.assert.ok(!parts.isSubtype(parts.arrow(N, N), parts.arrow(N, I)),
              'returning something less specific is not');
          }
        },
        {
          name: 'the four variances behave differently on the same element types',
          assert: function (lab, api) {
            const parts = lab();
            const I = parts.prim('Integer');
            const N = parts.prim('Number');

            api.assert.ok(parts.isSubtype(parts.gen('List', [I]), parts.gen('List', [N])),
              'a covariant List widens');
            api.assert.ok(!parts.isSubtype(parts.gen('List', [N]), parts.gen('List', [I])),
              'and does not narrow');
            api.assert.ok(parts.isSubtype(parts.gen('Sink', [N]), parts.gen('Sink', [I])),
              'a contravariant Sink narrows');
            api.assert.ok(!parts.isSubtype(parts.gen('Ref', [I]), parts.gen('Ref', [N])),
              'and an invariant Ref does neither, because it can be read AND written');
          }
        },
        {
          name: 'the unsound pair comes with the value that breaks it',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.findWitness('CovariantArray', 'Integer', 'Number'), 'Double',
              'the covariant rule admits CovariantArray<Integer> <= CovariantArray<Number>, ' +
                'and a Double is accepted by the Number view but cannot go in an array of ' +
                'Integer — that store is ArrayStoreException');
            api.assert.equal(parts.findWitness('Array', 'Integer', 'Number'), '',
              'the invariant declaration refuses the pair, so there is no witness to find — ' +
                'which is the check that the fix really is a fix');
          }
        },
        {
          name: 'a covariant container with no bad value is not reported as unsound',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.findWitness('CovariantArray', 'Number', 'Number'), '',
              'the same type on both sides admits nothing that breaks it');
            api.assert.equal(parts.findWitness('CovariantArray', 'Number', 'Value'), 'String',
              'widening to Value admits a String, which cannot go in an array of Number');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
