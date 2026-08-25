/**
 * Graded exercises for the lambda calculus, combinators and semantics
 * (M27.1-M27.3).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'the-untyped-lambda-calculus': [{
      id: 'capture-avoiding-substitution',
      title: 'Substitute without capturing, and prove it with α-equivalence',
      prompt: 'Terms are { t: "var", name }, { t: "lam", param, body } and ' +
        '{ t: "app", left, right }. Write substitute(term, name, value) returning the term with ' +
        'every FREE occurrence of `name` replaced by `value`. Two cases decide it. A binder ' +
        'whose parameter IS `name` shadows it, so the body is left alone. A binder whose ' +
        'parameter appears free in `value` would capture it, so rename that binder to a fresh ' +
        'name — append apostrophes until the name is free in neither the body nor the value — ' +
        'before descending. Then write deBruijn(term) returning the term as a string with each ' +
        'variable replaced by the number of binders between it and its own binder, so that ' +
        'α-equivalent terms print identically: use "λ " before a body, and wrap an application ' +
        'as "(left right)". A free variable prints as its name. The starter renames nothing, so ' +
        'it turns a constant function into the identity.',
      entry: 'lab',
      starter: [
        'function freeVariables(term, bound) {',
        '  const seen = bound || [];',
        '',
        '  if (term.t === "var") return seen.indexOf(term.name) === -1 ? [term.name] : [];',
        '  if (term.t === "lam") return freeVariables(term.body, seen.concat([term.param]));',
        '  const all = freeVariables(term.left, seen).concat(freeVariables(term.right, seen));',
        '',
        '  return all.filter(function (x, i) { return all.indexOf(x) === i; });',
        '}',
        '',
        'function substitute(term, name, value) {',
        '  if (term.t === "var") return term.name === name ? value : term;',
        '  if (term.t === "app") {',
        '    return { t: "app", left: substitute(term.left, name, value),',
        '      right: substitute(term.right, name, value) };',
        '  }',
        '  if (term.param === name) return term;',
        '  // No rename: if value mentions this binder\'s name, it is about to be captured.',
        '  return { t: "lam", param: term.param, body: substitute(term.body, name, value) };',
        '}',
        '',
        'function deBruijn(term, stack) {',
        '  const scope = stack || [];',
        '',
        '  if (term.t === "var") {',
        '    const at = scope.lastIndexOf(term.name);',
        '',
        '    return at === -1 ? term.name : String(scope.length - 1 - at);',
        '  }',
        '  if (term.t === "lam") return "λ " + deBruijn(term.body, scope.concat([term.param]));',
        '  return "(" + deBruijn(term.left, scope) + " " + deBruijn(term.right, scope) + ")";',
        '}',
        '',
        'function lab() { return { substitute: substitute, deBruijn: deBruijn }; }'
      ].join('\n'),
      solution: [
        'function freeVariables(term, bound) {',
        '  const seen = bound || [];',
        '',
        '  if (term.t === "var") return seen.indexOf(term.name) === -1 ? [term.name] : [];',
        '  if (term.t === "lam") return freeVariables(term.body, seen.concat([term.param]));',
        '  const all = freeVariables(term.left, seen).concat(freeVariables(term.right, seen));',
        '',
        '  return all.filter(function (x, i) { return all.indexOf(x) === i; });',
        '}',
        '',
        'function freshName(base, avoid) {',
        '  let name = base;',
        '',
        '  while (avoid.indexOf(name) !== -1) name += "\'";',
        '  return name;',
        '}',
        '',
        'function rename(term, from, to) {',
        '  return substitute(term, from, { t: "var", name: to });',
        '}',
        '',
        'function substitute(term, name, value) {',
        '  if (term.t === "var") return term.name === name ? value : term;',
        '  if (term.t === "app") {',
        '    return { t: "app", left: substitute(term.left, name, value),',
        '      right: substitute(term.right, name, value) };',
        '  }',
        '  if (term.param === name) return term;',
        '  const freeInValue = freeVariables(value, []);',
        '',
        '  if (freeInValue.indexOf(term.param) === -1) {',
        '    return { t: "lam", param: term.param, body: substitute(term.body, name, value) };',
        '  }',
        '  const avoid = freeInValue.concat(freeVariables(term.body, []));',
        '  const fresh = freshName(term.param, avoid);',
        '',
        '  return { t: "lam", param: fresh,',
        '    body: substitute(rename(term.body, term.param, fresh), name, value) };',
        '}',
        '',
        'function deBruijn(term, stack) {',
        '  const scope = stack || [];',
        '',
        '  if (term.t === "var") {',
        '    const at = scope.lastIndexOf(term.name);',
        '',
        '    return at === -1 ? term.name : String(scope.length - 1 - at);',
        '  }',
        '  if (term.t === "lam") return "λ " + deBruijn(term.body, scope.concat([term.param]));',
        '  return "(" + deBruijn(term.left, scope) + " " + deBruijn(term.right, scope) + ")";',
        '}',
        '',
        'function lab() { return { substitute: substitute, deBruijn: deBruijn }; }'
      ].join('\n'),
      tests: [
        {
          name: 'the capture fixture produces a constant function, not the identity',
          assert: function (lab, api) {
            const substitute = lab().substitute;
            const body = { t: 'lam', param: 'y', body: { t: 'var', name: 'x' } };
            const result = substitute(body, 'x', { t: 'var', name: 'y' });

            api.assert.notEqual(result.param, 'y',
              'substituting the free variable y into λy. x must rename the binder first — ' +
                'leaving it as y turns a constant function into the identity');
            api.assert.equal(result.body.name, 'y',
              'the body must be the substituted y, referring to the OUTER y');
            api.assert.notEqual(result.body.name, result.param,
              'the y in the body must not be the one this lambda binds');
          }
        },
        {
          name: 'a shadowing binder blocks the substitution entirely',
          assert: function (lab, api) {
            const substitute = lab().substitute;
            const term = { t: 'lam', param: 'x', body: { t: 'var', name: 'x' } };
            const result = substitute(term, 'x', { t: 'var', name: 'q' });

            api.assert.equal(result.param, 'x', 'the binder is untouched');
            api.assert.equal(result.body.name, 'x',
              'the x inside λx is bound by it, so it is a different variable and must not be ' +
                'replaced');
          }
        },
        {
          name: 'a binder that cannot capture is left alone',
          assert: function (lab, api) {
            const substitute = lab().substitute;
            const term = { t: 'lam', param: 'z', body: { t: 'var', name: 'x' } };
            const result = substitute(term, 'x', { t: 'var', name: 'y' });

            api.assert.equal(result.param, 'z',
              'z is not free in the value, so there is nothing to capture and no rename is ' +
                'needed — renaming unconditionally is wasteful and makes output unreadable');
            api.assert.equal(result.body.name, 'y', 'the substitution still happens');
          }
        },
        {
          name: 'de Bruijn form makes α-equivalent terms identical',
          assert: function (lab, api) {
            const deBruijn = lab().deBruijn;
            const lam = function (p, b) { return { t: 'lam', param: p, body: b }; };
            const v = function (n) { return { t: 'var', name: n }; };
            const app = function (l, r) { return { t: 'app', left: l, right: r }; };
            const one = lam('x', lam('y', app(v('x'), v('y'))));
            const two = lam('a', lam('b', app(v('a'), v('b'))));

            api.assert.equal(deBruijn(one), deBruijn(two),
              'λx y. x y and λa b. a b are the same function; their de Bruijn forms must match');
            api.assert.equal(deBruijn(one), 'λ λ (1 0)',
              'each variable becomes the count of binders between it and its own');
            api.assert.notEqual(deBruijn(lam('x', lam('y', v('x')))),
              deBruijn(lam('x', lam('y', v('y')))),
              'λx y. x and λx y. y are different functions and must not collide');
          }
        },
        {
          name: 'the whole point: the two results are not α-equivalent',
          assert: function (lab, api) {
            const parts = lab();
            const substitute = parts.substitute;
            const deBruijn = parts.deBruijn;
            const captured = { t: 'lam', param: 'y', body: { t: 'var', name: 'y' } };
            const correct = substitute({ t: 'lam', param: 'y', body: { t: 'var', name: 'x' } },
              'x', { t: 'var', name: 'y' });

            api.assert.notEqual(deBruijn(correct), deBruijn(captured),
              'the naive answer λy. y is the identity and the right answer is a constant ' +
                'function — compared by de Bruijn form they are different terms, which is why ' +
                'string comparison is not a test');
            api.assert.equal(deBruijn(captured), 'λ 0',
              'the identity, as a sanity check on deBruijn itself');
          }
        }
      ]
    }],
    'combinatory-logic-and-compilation': [{
      id: 'bracket-abstraction',
      title: 'Compile lambda terms to combinators, and check the result computes the same thing',
      prompt: 'Terms are { t: "var", name }, { t: "lam", param, body } and ' +
        '{ t: "app", left, right }. Write compile(term) returning a combinator term — one with ' +
        'no lam nodes anywhere — using bracket abstraction: λx. x becomes I; λx. e where x is ' +
        'not free in e becomes K applied to e; λx. (a b) becomes S applied to the abstraction ' +
        'of a and the abstraction of b; a nested lambda is compiled from the inside out first. ' +
        'Apply Schönfinkel\'s two optimisations: S (K a) (K b) becomes K (a b), and S (K a) I ' +
        'becomes a. Then write reduce(term, budget) returning { text, steps }: repeatedly find ' +
        'the leftmost-outermost spine whose head is S, K or I with enough arguments, and fire ' +
        'it — I x is x, K x y is x, S x y z is x z (y z) — printing with show(). The starter ' +
        'omits the optimisations, so it compiles the four-parameter fixture to 107 nodes.',
      entry: 'lab',
      starter: [
        'function v(name) { return { t: "var", name: name }; }',
        'function app(l, r) { return { t: "app", left: l, right: r }; }',
        '',
        'function freeIn(term, name) {',
        '  if (term.t === "var") return term.name === name;',
        '  if (term.t === "lam") return term.param !== name && freeIn(term.body, name);',
        '  return freeIn(term.left, name) || freeIn(term.right, name);',
        '}',
        '',
        'function abstract(name, term) {',
        '  if (term.t === "var" && term.name === name) return v("I");',
        '  if (!freeIn(term, name)) return app(v("K"), term);',
        '  if (term.t === "lam") return abstract(name, abstract(term.param, term.body));',
        '  // No optimisations: every application becomes an S, and nesting multiplies.',
        '  return app(app(v("S"), abstract(name, term.left)), abstract(name, term.right));',
        '}',
        '',
        'function compile(term) {',
        '  if (term.t === "var") return term;',
        '  if (term.t === "app") return app(compile(term.left), compile(term.right));',
        '  return abstract(term.param, compile(term.body));',
        '}',
        '',
        'function show(term) {',
        '  if (term.t === "var") return term.name;',
        '  const left = term.left.t === "lam" ? "(" + show(term.left) + ")" : show(term.left);',
        '  const right = term.right.t === "var" ? show(term.right) : "(" + show(term.right) + ")";',
        '',
        '  return left + " " + right;',
        '}',
        '',
        'function size(term) {',
        '  if (term.t === "var") return 1;',
        '  if (term.t === "lam") return 1 + size(term.body);',
        '  return 1 + size(term.left) + size(term.right);',
        '}',
        '',
        'const ARITY = { S: 3, K: 2, I: 1 };',
        '',
        'function spine(term) {',
        '  return term.t !== "app" ? [term] : spine(term.left).concat([term.right]);',
        '}',
        '',
        'function rebuild(head, args) {',
        '  return args.reduce(function (acc, arg) { return app(acc, arg); }, head);',
        '}',
        '',
        'function step(term) {',
        '  const parts = spine(term);',
        '  const head = parts[0];',
        '  const args = parts.slice(1);',
        '',
        '  if (head.t === "var" && ARITY[head.name] && args.length >= ARITY[head.name]) {',
        '    const rest = args.slice(ARITY[head.name]);',
        '',
        '    if (head.name === "I") return rebuild(args[0], rest);',
        '    if (head.name === "K") return rebuild(args[0], rest);',
        '    return rebuild(app(app(args[0], args[2]), app(args[1], args[2])), rest);',
        '  }',
        '  for (let i = 0; i < args.length; i += 1) {',
        '    const inner = step(args[i]);',
        '',
        '    if (inner === null) continue;',
        '    const copy = args.slice();',
        '',
        '    copy[i] = inner;',
        '    return rebuild(head, copy);',
        '  }',
        '  return null;',
        '}',
        '',
        'function reduce(term, budget) {',
        '  let current = term;',
        '  let steps = 0;',
        '',
        '  while (steps < (budget || 2000)) {',
        '    const next = step(current);',
        '',
        '    if (next === null) break;',
        '    current = next;',
        '    steps += 1;',
        '  }',
        '  return { text: show(current), steps: steps };',
        '}',
        '',
        'function lab() {',
        '  return { compile: compile, reduce: reduce, show: show, size: size };',
        '}'
      ].join('\n'),
      solution: [
        'function v(name) { return { t: "var", name: name }; }',
        'function app(l, r) { return { t: "app", left: l, right: r }; }',
        '',
        'function freeIn(term, name) {',
        '  if (term.t === "var") return term.name === name;',
        '  if (term.t === "lam") return term.param !== name && freeIn(term.body, name);',
        '  return freeIn(term.left, name) || freeIn(term.right, name);',
        '}',
        '',
        'function isK(term) {',
        '  return term.t === "app" && term.left.t === "var" && term.left.name === "K";',
        '}',
        '',
        'function abstract(name, term) {',
        '  if (term.t === "var" && term.name === name) return v("I");',
        '  if (!freeIn(term, name)) return app(v("K"), term);',
        '  if (term.t === "lam") return abstract(name, abstract(term.param, term.body));',
        '  const left = abstract(name, term.left);',
        '  const right = abstract(name, term.right);',
        '',
        '  if (isK(left) && isK(right)) return app(v("K"), app(left.right, right.right));',
        '  if (isK(left) && right.t === "var" && right.name === "I") return left.right;',
        '  return app(app(v("S"), left), right);',
        '}',
        '',
        'function compile(term) {',
        '  if (term.t === "var") return term;',
        '  if (term.t === "app") return app(compile(term.left), compile(term.right));',
        '  return abstract(term.param, compile(term.body));',
        '}',
        '',
        'function show(term) {',
        '  if (term.t === "var") return term.name;',
        '  const left = term.left.t === "lam" ? "(" + show(term.left) + ")" : show(term.left);',
        '  const right = term.right.t === "var" ? show(term.right) : "(" + show(term.right) + ")";',
        '',
        '  return left + " " + right;',
        '}',
        '',
        'function size(term) {',
        '  if (term.t === "var") return 1;',
        '  if (term.t === "lam") return 1 + size(term.body);',
        '  return 1 + size(term.left) + size(term.right);',
        '}',
        '',
        'const ARITY = { S: 3, K: 2, I: 1 };',
        '',
        'function spine(term) {',
        '  return term.t !== "app" ? [term] : spine(term.left).concat([term.right]);',
        '}',
        '',
        'function rebuild(head, args) {',
        '  return args.reduce(function (acc, arg) { return app(acc, arg); }, head);',
        '}',
        '',
        'function step(term) {',
        '  const parts = spine(term);',
        '  const head = parts[0];',
        '  const args = parts.slice(1);',
        '',
        '  if (head.t === "var" && ARITY[head.name] && args.length >= ARITY[head.name]) {',
        '    const rest = args.slice(ARITY[head.name]);',
        '',
        '    if (head.name === "I") return rebuild(args[0], rest);',
        '    if (head.name === "K") return rebuild(args[0], rest);',
        '    return rebuild(app(app(args[0], args[2]), app(args[1], args[2])), rest);',
        '  }',
        '  for (let i = 0; i < args.length; i += 1) {',
        '    const inner = step(args[i]);',
        '',
        '    if (inner === null) continue;',
        '    const copy = args.slice();',
        '',
        '    copy[i] = inner;',
        '    return rebuild(head, copy);',
        '  }',
        '  return null;',
        '}',
        '',
        'function reduce(term, budget) {',
        '  let current = term;',
        '  let steps = 0;',
        '',
        '  while (steps < (budget || 2000)) {',
        '    const next = step(current);',
        '',
        '    if (next === null) break;',
        '    current = next;',
        '    steps += 1;',
        '  }',
        '  return { text: show(current), steps: steps };',
        '}',
        '',
        'function lab() {',
        '  return { compile: compile, reduce: reduce, show: show, size: size };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the three easy compilations are exactly S, K and I',
          assert: function (lab, api) {
            const parts = lab();
            const compile = parts.compile;
            const lam = function (p, b) { return { t: 'lam', param: p, body: b }; };
            const v = function (n) { return { t: 'var', name: n }; };
            const app = function (l, r) { return { t: 'app', left: l, right: r }; };

            api.assert.equal(parts.show(compile(lam('x', v('x')))), 'I',
              'λx. x is the identity combinator');
            api.assert.equal(parts.show(compile(lam('x', lam('y', v('x'))))), 'K',
              'λx y. x discards its second argument, which is exactly K — the plain algorithm ' +
                'gives S (K K) I here, seven nodes instead of one');
            api.assert.equal(
              parts.show(compile(lam('x', lam('y', lam('z',
                app(app(v('x'), v('z')), app(v('y'), v('z')))))))), 'S',
              'this term IS S, and compiling it should say so');
          }
        },
        {
          name: 'the compiled term computes the same function',
          assert: function (lab, api) {
            const parts = lab();
            const compile = parts.compile;
            const lam = function (p, b) { return { t: 'lam', param: p, body: b }; };
            const v = function (n) { return { t: 'var', name: n }; };
            const app = function (l, r) { return { t: 'app', left: l, right: r }; };
            const twice = lam('f', lam('x', app(v('f'), app(v('f'), v('x')))));
            const applied = app(app(compile(twice), v('g')), v('z'));

            api.assert.equal(parts.reduce(applied, 2000).text, 'g (g z)',
              'the compiled twice combinator applied to g and z must reduce to g (g z), the ' +
                'same normal form the lambda term gives');

            const compose = lam('f', lam('g', lam('x', app(v('f'), app(v('g'), v('x'))))));
            const three = app(app(app(compile(compose), v('p')), v('q')), v('r'));

            api.assert.equal(parts.reduce(three, 2000).text, 'p (q r)',
              'composition applied to p, q and r must give p (q r)');
          }
        },
        {
          name: 'the optimisations actually fire',
          assert: function (lab, api) {
            const parts = lab();
            const compile = parts.compile;
            const lam = function (p, b) { return { t: 'lam', param: p, body: b }; };
            const v = function (n) { return { t: 'var', name: n }; };
            const app = function (l, r) { return { t: 'app', left: l, right: r }; };
            const four = lam('a', lam('b', lam('c', lam('d',
              app(app(app(v('a'), v('b')), v('c')), v('d'))))));

            api.assert.atMost(parts.size(compile(four)), 3,
              'λa b c d. a b c d collapses to a single combinator once S (K a) I → a fires. ' +
                'Without the optimisations this compiles to 107 nodes.');

            const compose = lam('f', lam('g', lam('x', app(v('f'), app(v('g'), v('x'))))));

            api.assert.atMost(parts.size(compile(compose)), 9,
              'composition should compile to S (K S) K — seven nodes — rather than the 49 the ' +
                'plain algorithm produces');
          }
        },
        {
          name: 'no lambda survives compilation',
          assert: function (lab, api) {
            const compile = lab().compile;
            const lam = function (p, b) { return { t: 'lam', param: p, body: b }; };
            const v = function (n) { return { t: 'var', name: n }; };
            const app = function (l, r) { return { t: 'app', left: l, right: r }; };
            const hasLam = function (term) {
              if (term.t === 'lam') return true;
              if (term.t === 'var') return false;
              return hasLam(term.left) || hasLam(term.right);
            };

            [lam('x', v('x')), lam('x', lam('y', v('y'))),
              lam('f', lam('x', app(v('f'), app(v('f'), v('x')))))].forEach(function (term) {
              api.assert.ok(!hasLam(compile(term)),
                'the whole point is that there are no binders left — a lam node anywhere means ' +
                  'a variable was not eliminated');
            });
          }
        }
      ]
    }],
    'operational-semantics': [{
      id: 'small-step-rules',
      title: 'Implement the step relation, and check it is deterministic',
      prompt: 'Terms are { t: "num", value }, { t: "bool", value }, ' +
        '{ t: "add", left, right }, { t: "lt", left, right } and { t: "if", test, then, other }. ' +
        'Write allSteps(term) returning an ARRAY of every term reachable in one step. The ' +
        'computation rules: `if true then a else b` steps to a, `if false then a else b` steps ' +
        'to b, two numbers under add step to their sum, two numbers under lt step to a bool. ' +
        'The congruence rules use a VALUE-GATED evaluation context: for a binary node you may ' +
        'step in the left operand, and in the right operand ONLY when the left is already a ' +
        'value; for an if you may step in the test only. Then write run(term, budget) returning ' +
        '{ text, steps, outcome } where outcome is "value", "stuck" or "budget", taking the ' +
        'first of allSteps each time and printing with show(). The starter is not value-gated, ' +
        'so both operands are steppable at once and the relation is non-deterministic.',
      entry: 'lab',
      starter: [
        'function isValue(term) { return term.t === "num" || term.t === "bool"; }',
        '',
        'function show(term) {',
        '  if (term.t === "num") return String(term.value);',
        '  if (term.t === "bool") return term.value ? "true" : "false";',
        '  if (term.t === "if") {',
        '    return "if " + show(term.test) + " then " + show(term.then) +',
        '      " else " + show(term.other);',
        '  }',
        '  const op = term.t === "add" ? " + " : " < ";',
        '',
        '  return "(" + show(term.left) + op + show(term.right) + ")";',
        '}',
        '',
        'function fire(term) {',
        '  if (term.t === "if" && term.test.t === "bool") {',
        '    return [term.test.value ? term.then : term.other];',
        '  }',
        '  if (term.t === "add" && term.left.t === "num" && term.right.t === "num") {',
        '    return [{ t: "num", value: term.left.value + term.right.value }];',
        '  }',
        '  if (term.t === "lt" && term.left.t === "num" && term.right.t === "num") {',
        '    return [{ t: "bool", value: term.left.value < term.right.value }];',
        '  }',
        '  return [];',
        '}',
        '',
        'const SLOTS = { add: ["left", "right"], lt: ["left", "right"], if: ["test"] };',
        '',
        'function allSteps(term) {',
        '  const found = fire(term);',
        '  const slots = SLOTS[term.t] || [];',
        '',
        '  // Not value-gated: the right operand is steppable even when the left is not a value.',
        '  slots.forEach(function (slot) {',
        '    allSteps(term[slot]).forEach(function (inner) {',
        '      const copy = Object.assign({}, term);',
        '',
        '      copy[slot] = inner;',
        '      found.push(copy);',
        '    });',
        '  });',
        '  return found;',
        '}',
        '',
        'function run(term, budget) {',
        '  let current = term;',
        '  let steps = 0;',
        '',
        '  while (steps < (budget || 200)) {',
        '    const options = allSteps(current);',
        '',
        '    if (options.length === 0) break;',
        '    current = options[0];',
        '    steps += 1;',
        '  }',
        '  const outcome = isValue(current) ? "value"',
        '    : (steps >= (budget || 200) ? "budget" : "stuck");',
        '',
        '  return { text: show(current), steps: steps, outcome: outcome };',
        '}',
        '',
        'function lab() { return { allSteps: allSteps, run: run, show: show }; }'
      ].join('\n'),
      solution: [
        'function isValue(term) { return term.t === "num" || term.t === "bool"; }',
        '',
        'function show(term) {',
        '  if (term.t === "num") return String(term.value);',
        '  if (term.t === "bool") return term.value ? "true" : "false";',
        '  if (term.t === "if") {',
        '    return "if " + show(term.test) + " then " + show(term.then) +',
        '      " else " + show(term.other);',
        '  }',
        '  const op = term.t === "add" ? " + " : " < ";',
        '',
        '  return "(" + show(term.left) + op + show(term.right) + ")";',
        '}',
        '',
        'function fire(term) {',
        '  if (term.t === "if" && term.test.t === "bool") {',
        '    return [term.test.value ? term.then : term.other];',
        '  }',
        '  if (term.t === "add" && term.left.t === "num" && term.right.t === "num") {',
        '    return [{ t: "num", value: term.left.value + term.right.value }];',
        '  }',
        '  if (term.t === "lt" && term.left.t === "num" && term.right.t === "num") {',
        '    return [{ t: "bool", value: term.left.value < term.right.value }];',
        '  }',
        '  return [];',
        '}',
        '',
        'const SLOTS = { add: ["left", "right"], lt: ["left", "right"], if: ["test"] };',
        '',
        'function openSlots(term) {',
        '  const slots = SLOTS[term.t] || [];',
        '  const open = [];',
        '',
        '  for (let i = 0; i < slots.length; i += 1) {',
        '    open.push(slots[i]);',
        '    if (!isValue(term[slots[i]])) break;',
        '  }',
        '  return open;',
        '}',
        '',
        'function allSteps(term) {',
        '  const found = fire(term);',
        '',
        '  openSlots(term).forEach(function (slot) {',
        '    allSteps(term[slot]).forEach(function (inner) {',
        '      const copy = Object.assign({}, term);',
        '',
        '      copy[slot] = inner;',
        '      found.push(copy);',
        '    });',
        '  });',
        '  return found;',
        '}',
        '',
        'function run(term, budget) {',
        '  let current = term;',
        '  let steps = 0;',
        '',
        '  while (steps < (budget || 200)) {',
        '    const options = allSteps(current);',
        '',
        '    if (options.length === 0) break;',
        '    current = options[0];',
        '    steps += 1;',
        '  }',
        '  const outcome = isValue(current) ? "value"',
        '    : (steps >= (budget || 200) ? "budget" : "stuck");',
        '',
        '  return { text: show(current), steps: steps, outcome: outcome };',
        '}',
        '',
        'function lab() { return { allSteps: allSteps, run: run, show: show }; }'
      ].join('\n'),
      tests: [
        {
          name: 'exactly one rule applies at every reachable term',
          assert: function (lab, api) {
            const allSteps = lab().allSteps;
            const n = function (x) { return { t: 'num', value: x }; };
            const add = function (l, r) { return { t: 'add', left: l, right: r }; };
            const seen = {};
            const frontier = [add(add(n(1), n(2)), add(n(3), n(4)))];
            let worst = 0;

            while (frontier.length > 0) {
              const current = frontier.pop();
              const key = JSON.stringify(current);

              if (seen[key]) continue;
              seen[key] = true;
              const options = allSteps(current);

              worst = Math.max(worst, options.length);
              options.forEach(function (option) { frontier.push(option); });
            }
            api.assert.equal(worst, 1,
              '(1 + 2) + (3 + 4) has two reducible operands. Without the value gate BOTH are ' +
                'steppable and the relation is non-deterministic; with it, only the left one ' +
                'is until it becomes a value. Got a maximum of ' + worst + ' applicable rules.');
          }
        },
        {
          name: 'the value gate does not stop the right operand once the left is a value',
          assert: function (lab, api) {
            const allSteps = lab().allSteps;
            const n = function (x) { return { t: 'num', value: x }; };
            const add = function (l, r) { return { t: 'add', left: l, right: r }; };

            api.assert.equal(allSteps(add(n(3), add(n(3), n(4)))).length, 1,
              'the left is already a value, so the right operand must be steppable — gating ' +
                'it away entirely would leave the term stuck');
            api.assert.equal(allSteps(add(n(3), n(7)))[0].value, 10,
              'and once both are values the computation rule fires');
          }
        },
        {
          name: 'the trace is what the rules say it is',
          assert: function (lab, api) {
            const run = lab().run;
            const n = function (x) { return { t: 'num', value: x }; };
            const add = function (l, r) { return { t: 'add', left: l, right: r }; };
            const out = run(add(add(n(1), n(2)), add(n(3), n(4))), 200);

            api.assert.equal(out.text, '10', '(1 + 2) + (3 + 4) is 10');
            api.assert.equal(out.steps, 3, 'left, then right, then the outer addition');
            api.assert.equal(out.outcome, 'value', 'it reaches a value');
          }
        },
        {
          name: 'stuck terms are reported as stuck, not as values',
          assert: function (lab, api) {
            const parts = lab();
            const allSteps = parts.allSteps;
            const n = function (x) { return { t: 'num', value: x }; };
            const b = function (x) { return { t: 'bool', value: x }; };
            const add = function (l, r) { return { t: 'add', left: l, right: r }; };
            const iff = function (c, t, e) { return { t: 'if', test: c, then: t, other: e }; };

            api.assert.equal(parts.run(add(b(true), n(1)), 200).outcome, 'stuck',
              'true + 1 is not a value and no rule applies — that is the definition of a ' +
                'runtime error');
            api.assert.equal(parts.run(iff(n(1), n(2), n(3)), 200).outcome, 'stuck',
              'a number as a guard is stuck too');
            api.assert.equal(allSteps(add(b(true), n(1))).length, 0,
              'and nothing at all is applicable there');
          }
        },
        {
          name: 'the guard runs before either branch',
          assert: function (lab, api) {
            const parts = lab();
            const allSteps = parts.allSteps;
            const n = function (x) { return { t: 'num', value: x }; };
            const b = function (x) { return { t: 'bool', value: x }; };
            const add = function (l, r) { return { t: 'add', left: l, right: r }; };
            const lt = function (l, r) { return { t: 'lt', left: l, right: r }; };
            const iff = function (c, t, e) { return { t: 'if', test: c, then: t, other: e }; };
            const term = iff(lt(n(2), n(3)), add(n(1), n(1)), add(b(true), n(1)));
            const out = parts.run(term, 200);

            api.assert.equal(out.outcome, 'value',
              'the else branch is stuck, and it never runs — so the whole term reaches a value');
            api.assert.equal(out.text, '2', 'the then branch gives 2');
            api.assert.equal(allSteps(term).length, 1,
              'only the guard is steppable: adding holes for the branches would make this ' +
                'non-deterministic and would get stuck on code that never runs');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
