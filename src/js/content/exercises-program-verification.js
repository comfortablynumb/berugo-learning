/**
 * Graded exercises for model checking and deductive verification (M32.7-M32.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'model-checking': [{
      id: 'shortest-counter-example',
      title: 'Explore the reachable states, and report the shortest trace',
      prompt: 'A model is { vars, init, actions, invariant } where an action is { name, ' +
        'guard(state), effect(state) } and the invariant is a predicate on a state. Write ' +
        'explore(model, budget) returning { violated, at, states, trace }: search the reachable '
        + 'states BREADTH-FIRST, keeping a visited set keyed on the values of model.vars, and '
        + 'stop at the first state that breaks the invariant. `at` is the length of the trace, '
        + '`states` is how many were visited, and `trace` is a list of { action, state } '
        + 'starting from init. The starter uses a stack instead of a queue, so it explores '
        + 'depth-first: it still finds a violation, and the trace it reports is not the '
        + 'shortest one.',
      entry: 'lab',
      starter: [
        'function keyOf(model, state) {',
        '  return model.vars.map(function (name) { return state[name] ? "1" : "0"; }).join("");',
        '}',
        '',
        'function successors(model, state) {',
        '  const out = [];',
        '',
        '  model.actions.forEach(function (action) {',
        '    if (!action.guard(state)) return;',
        '    out.push({ action: action.name, state: action.effect(state) });',
        '  });',
        '  return out;',
        '}',
        '',
        'function explore(model, budget) {',
        '  const seen = {};',
        '  const limit = budget || 20000;',
        '  const queue = [{ state: model.init, trace: [{ action: "init", state: model.init }] }];',
        '  let states = 0;',
        '',
        '  while (queue.length && states < limit) {',
        '    // A stack, not a queue: this is depth-first, and the first',
        '    // violation it reaches is whatever the search order stumbled into.',
        '    const here = queue.pop();',
        '    const key = keyOf(model, here.state);',
        '',
        '    if (seen[key]) continue;',
        '    seen[key] = true;',
        '    states += 1;',
        '    if (!model.invariant(here.state)) {',
        '      return { violated: true, at: here.trace.length - 1, states: states,',
        '        trace: here.trace };',
        '    }',
        '    successors(model, here.state).forEach(function (step) {',
        '      queue.push({ state: step.state, trace: here.trace.concat([step]) });',
        '    });',
        '  }',
        '  return { violated: false, at: null, states: states, trace: null };',
        '}',
        '',
        'function lab() {',
        '  return { explore: explore, keyOf: keyOf, successors: successors };',
        '}'
      ].join('\n'),
      solution: [
        'function keyOf(model, state) {',
        '  return model.vars.map(function (name) { return state[name] ? "1" : "0"; }).join("");',
        '}',
        '',
        'function successors(model, state) {',
        '  const out = [];',
        '',
        '  model.actions.forEach(function (action) {',
        '    if (!action.guard(state)) return;',
        '    out.push({ action: action.name, state: action.effect(state) });',
        '  });',
        '  return out;',
        '}',
        '',
        '/* Breadth-first, because the length of a counter-example is most of how',
        '   usable it is: a depth-first search hands back a forty-step trace for a',
        '   bug that takes six, and the engineer reading it has to work out which',
        '   thirty-four steps were irrelevant. */',
        'function explore(model, budget) {',
        '  const seen = {};',
        '  const limit = budget || 20000;',
        '  const queue = [{ state: model.init, trace: [{ action: "init", state: model.init }] }];',
        '  let states = 0;',
        '',
        '  while (queue.length && states < limit) {',
        '    const here = queue.shift();',
        '    const key = keyOf(model, here.state);',
        '',
        '    if (seen[key]) continue;',
        '    seen[key] = true;',
        '    states += 1;',
        '    if (!model.invariant(here.state)) {',
        '      return { violated: true, at: here.trace.length - 1, states: states,',
        '        trace: here.trace };',
        '    }',
        '    successors(model, here.state).forEach(function (step) {',
        '      queue.push({ state: step.state, trace: here.trace.concat([step]) });',
        '    });',
        '  }',
        '  return { violated: false, at: null, states: states, trace: null };',
        '}',
        '',
        'function lab() {',
        '  return { explore: explore, keyOf: keyOf, successors: successors };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the counter-example is the shortest one',
          assert: function (lab, api) {
            const parts = lab();
            const step = function (name, guard, changes) {
              return { name: name, guard: guard,
                effect: function (s) { return Object.assign({}, s, changes); } };
            };
            /* Two routes to the bad state: one step, or a detour of three. */
            const model = {
              vars: ['a', 'b', 'c', 'bad'],
              init: { a: false, b: false, c: false, bad: false },
              /* The short way is listed FIRST so that a stack-based search
                 pops it last and wanders down the long route — which is the
                 whole point: depth-first finds a violation and not the
                 shortest one. */
              actions: [
                step('the short way', function (s) { return !s.c; }, { c: true, bad: true }),
                step('the long way starts', function (s) { return !s.a; }, { a: true }),
                step('the long way continues', function (s) { return s.a && !s.b; }, { b: true }),
                step('the long way arrives', function (s) { return s.b; }, { bad: true })
              ],
              invariant: function (s) { return !s.bad; }
            };
            const out = parts.explore(model, 5000);

            api.assert.equal(out.violated, true, 'the bad state is reachable');
            api.assert.equal(out.at, 1, 'and the shortest way there is one step');
          }
        },
        {
          name: 'a safe model is explored exhaustively and reported clean',
          assert: function (lab, api) {
            const parts = lab();
            const model = {
              vars: ['x', 'y'],
              init: { x: false, y: false },
              actions: [
                { name: 'set x', guard: function (s) { return !s.x; },
                  effect: function (s) { return Object.assign({}, s, { x: true }); } },
                { name: 'set y', guard: function (s) { return s.x && !s.y; },
                  effect: function (s) { return Object.assign({}, s, { y: true }); } }
              ],
              invariant: function (s) { return !(s.y && !s.x); }
            };
            const out = parts.explore(model, 5000);

            api.assert.equal(out.violated, false, 'y is never set without x');
            api.assert.equal(out.states, 3, 'and there are exactly three reachable states');
          }
        },
        {
          name: 'the trace really leads to the violation',
          assert: function (lab, api) {
            const parts = lab();
            const model = {
              vars: ['p', 'q'],
              init: { p: false, q: false },
              actions: [
                { name: 'p', guard: function (s) { return !s.p; },
                  effect: function (s) { return Object.assign({}, s, { p: true }); } },
                { name: 'q', guard: function (s) { return s.p && !s.q; },
                  effect: function (s) { return Object.assign({}, s, { q: true }); } }
              ],
              invariant: function (s) { return !(s.p && s.q); }
            };
            const out = parts.explore(model, 5000);

            api.assert.equal(out.violated, true, 'p and q can both be set');
            let state = out.trace[0].state;

            for (let at = 1; at < out.trace.length; at += 1) {
              const action = model.actions.filter(function (row) {
                return row.name === out.trace[at].action;
              })[0];

              api.assert.ok(action, 'every step names a real action');
              api.assert.ok(action.guard(state), 'and its guard holds where it is taken');
              state = action.effect(state);
            }
            api.assert.equal(model.invariant(state), false,
              'and replaying the trace really reaches a violating state');
          }
        }
      ]
    }],

    'deductive-verification': [{
      id: 'weakest-preconditions',
      title: 'Turn an annotated block into verification conditions',
      prompt: 'An expression is { terms: { name: coefficient }, constant }. A condition is ' +
        '{ left, op, right } with op one of "le", "lt", "ge", "gt", "eq". A programme is ' +
        '{ requires, body } where a statement is { op: "assign", name, expr } or ' +
        '{ op: "assert", cond }. Write substitute(expr, name, replacement) and ' +
        'generate(program) returning one { assumptions, goal } per assertion, where an ' +
        'assignment rewrites the goals AND the assumptions that mention the variable. The '
        + 'starter leaves assignments out entirely, so the assertion is checked against a '
        + 'variable nothing constrains — which reports the correct binary-search midpoint as '
        + 'broken and the broken one as fine.',
      entry: 'lab',
      starter: [
        'function substitute(expr, name, replacement) {',
        '  const terms = {};',
        '  let constant = expr.constant || 0;',
        '',
        '  Object.keys(expr.terms || {}).forEach(function (key) {',
        '    if (key !== name) { terms[key] = (terms[key] || 0) + expr.terms[key]; return; }',
        '    const factor = expr.terms[key];',
        '',
        '    Object.keys(replacement.terms || {}).forEach(function (inner) {',
        '      terms[inner] = (terms[inner] || 0) + factor * replacement.terms[inner];',
        '    });',
        '    constant += factor * (replacement.constant || 0);',
        '  });',
        '  return { terms: terms, constant: constant };',
        '}',
        '',
        'function substituteIn(cond, name, replacement) {',
        '  return { left: substitute(cond.left, name, replacement), op: cond.op,',
        '    right: substitute(cond.right, name, replacement) };',
        '}',
        '',
        'function generate(program) {',
        '  const known = (program.requires || []).slice();',
        '  const vcs = [];',
        '',
        '  (program.body || []).forEach(function (statement) {',
        '    if (statement.op === "assert") {',
        '      vcs.push({ assumptions: known.slice(), goal: statement.cond });',
        '      return;',
        '    }',
        '    // Assignments are ignored, so nothing ever connects the assigned',
        '    // variable to the expression it was given.',
        '  });',
        '  return vcs;',
        '}',
        '',
        'function lab() {',
        '  return { substitute: substitute, substituteIn: substituteIn, generate: generate };',
        '}'
      ].join('\n'),
      solution: [
        'function substitute(expr, name, replacement) {',
        '  const terms = {};',
        '  let constant = expr.constant || 0;',
        '',
        '  Object.keys(expr.terms || {}).forEach(function (key) {',
        '    if (key !== name) { terms[key] = (terms[key] || 0) + expr.terms[key]; return; }',
        '    const factor = expr.terms[key];',
        '',
        '    Object.keys(replacement.terms || {}).forEach(function (inner) {',
        '      terms[inner] = (terms[inner] || 0) + factor * replacement.terms[inner];',
        '    });',
        '    constant += factor * (replacement.constant || 0);',
        '  });',
        '  return { terms: terms, constant: constant };',
        '}',
        '',
        'function substituteIn(cond, name, replacement) {',
        '  return { left: substitute(cond.left, name, replacement), op: cond.op,',
        '    right: substitute(cond.right, name, replacement) };',
        '}',
        '',
        '/* An assignment is recorded as an equality between the variable and the',
        '   expression, after every assumption mentioning that variable has been',
        '   rewritten in terms of a fresh name. That is what connects `sum` to',
        '   `lo + hi`, and without it the assertion is a claim about a variable',
        '   nothing constrains. */',
        'function generate(program) {',
        '  let known = (program.requires || []).slice();',
        '  const vcs = [];',
        '',
        '  (program.body || []).forEach(function (statement) {',
        '    if (statement.op === "assert") {',
        '      vcs.push({ assumptions: known.slice(), goal: statement.cond });',
        '      return;',
        '    }',
        '    if (statement.op !== "assign") return;',
        '    const fresh = statement.name + "\'";',
        '',
        '    known = known.map(function (row) {',
        '      return substituteIn(row, statement.name, { terms: freshTerm(fresh), constant: 0 });',
        '    }).concat([{ left: { terms: freshTerm(statement.name), constant: 0 }, op: "eq",',
        '      right: substitute(statement.expr, statement.name,',
        '        { terms: freshTerm(fresh), constant: 0 }) }]);',
        '  });',
        '  return vcs;',
        '}',
        '',
        'function freshTerm(name) {',
        '  const terms = {};',
        '',
        '  terms[name] = 1;',
        '  return terms;',
        '}',
        '',
        'function lab() {',
        '  return { substitute: substitute, substituteIn: substituteIn, generate: generate };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'substitution rewrites a goal the way weakest preconditions require',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.substitute({ terms: { x: 1 }, constant: 0 }, 'x',
              { terms: { y: 1 }, constant: 1 });

            api.assert.equal(out.constant, 1, 'the constant comes through');
            api.assert.equal(out.terms.y, 1, 'and so does the variable');
            api.assert.equal(out.terms.x, undefined, 'with x gone');
          }
        },
        {
          name: 'the broken midpoint has a condition an integer state refutes',
          assert: function (lab, api) {
            const parts = lab();
            const v = function (name) {
              const terms = {};

              terms[name] = 1;
              return { terms: terms, constant: 0 };
            };
            const n = function (value) { return { terms: {}, constant: value }; };
            const sum = { terms: { lo: 1, hi: 1 }, constant: 0 };
            const program = {
              requires: [{ left: v('lo'), op: 'ge', right: n(0) },
                { left: v('hi'), op: 'ge', right: v('lo') },
                { left: v('hi'), op: 'le', right: n(1000) }],
              body: [{ op: 'assign', name: 'sum', expr: sum },
                { op: 'assert', cond: { left: v('sum'), op: 'le', right: n(1000) } }]
            };
            const vcs = parts.generate(program);
            const value = function (expr, model) {
              let total = expr.constant || 0;

              Object.keys(expr.terms || {}).forEach(function (name) {
                total += expr.terms[name] * (model[name] === undefined ? 0 : model[name]);
              });
              return total;
            };
            const holds = function (cond, model) {
              const left = value(cond.left, model);
              const right = value(cond.right, model);

              if (cond.op === 'le') return left <= right;
              if (cond.op === 'lt') return left < right;
              if (cond.op === 'ge') return left >= right;
              if (cond.op === 'gt') return left > right;
              return left === right;
            };

            api.assert.equal(vcs.length, 1, 'one assertion, one condition');
            const model = { lo: 500, hi: 700, sum: 1200 };

            api.assert.ok(vcs[0].assumptions.every(function (row) { return holds(row, model); }),
              'every assumption holds at lo = 500, hi = 700, sum = 1200');
            api.assert.equal(holds(vcs[0].goal, model), false,
              'and the goal does not — the condition is refuted');
          }
        },
        {
          name: 'the rearranged midpoint has no such state',
          assert: function (lab, api) {
            const parts = lab();
            const v = function (name) {
              const terms = {};

              terms[name] = 1;
              return { terms: terms, constant: 0 };
            };
            const n = function (value) { return { terms: {}, constant: value }; };
            const program = {
              requires: [{ left: v('lo'), op: 'ge', right: n(0) },
                { left: v('hi'), op: 'ge', right: v('lo') },
                { left: v('hi'), op: 'le', right: n(1000) }],
              body: [{ op: 'assign', name: 'sum',
                expr: { terms: { lo: 0, hi: 1 }, constant: 0 } },
              { op: 'assert', cond: { left: v('sum'), op: 'le', right: n(1000) } }]
            };
            const vcs = parts.generate(program);
            const value = function (expr, model) {
              let total = expr.constant || 0;

              Object.keys(expr.terms || {}).forEach(function (name) {
                total += expr.terms[name] * (model[name] === undefined ? 0 : model[name]);
              });
              return total;
            };
            const holds = function (cond, model) {
              const left = value(cond.left, model);
              const right = value(cond.right, model);

              if (cond.op === 'le') return left <= right;
              if (cond.op === 'lt') return left < right;
              if (cond.op === 'ge') return left >= right;
              if (cond.op === 'gt') return left > right;
              return left === right;
            };

            api.assert.equal(vcs.length, 1, 'one condition again');
            /* `sum` is enumerated rather than computed, because a generator
               that forgot the assignment leaves it unconstrained - and the
               only way to catch that is to try a value the programme could
               never produce. */
            let checked = 0;

            for (let lo = 0; lo <= 1000; lo += 250) {
              for (let hi = lo; hi <= 1000; hi += 250) {
                for (let sum = 0; sum <= 2000; sum += 250) {
                  const model = { lo: lo, hi: hi, sum: sum };

                  if (!vcs[0].assumptions.every(function (row) { return holds(row, model); })) {
                    continue;
                  }
                  checked += 1;
                  api.assert.equal(holds(vcs[0].goal, model), true,
                    'no state satisfying the assumptions refutes the rearranged version ' +
                    '(lo = ' + lo + ', hi = ' + hi + ', sum = ' + sum + ')');
                }
              }
            }
            api.assert.ok(checked > 0,
              'the assumptions must admit some state, or this proves nothing');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
