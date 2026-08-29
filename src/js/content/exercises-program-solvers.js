/**
 * Graded exercises for SAT and SMT solving (M32.5-M32.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'sat-solving': [{
      id: 'two-watched-literals',
      title: 'Propagate with two watched literals, and visit fewer clauses',
      prompt: 'A formula is a list of clauses, each a list of DIMACS integers. An assignment '
        + 'is { "3": true, "5": false }, keyed by variable. Write propagate(clauses, '
        + 'assignment) returning { implied, conflict, visits }: implied lists the literals '
        + 'forced to a fixed point, conflict is the index of a clause with every literal false '
        + '(or null), and visits counts how many times a clause body was examined. Watch two '
        + 'literals per clause: when a watched literal becomes false, look for another '
        + 'non-false literal to watch, and only if there is none is the clause unit or '
        + 'conflicting. The starter watches only the FIRST literal of each clause, so a clause '
        + 'whose second literal is falsified is never revisited and its implication is lost.',
      entry: 'lab',
      starter: [
        'function valueOf(assignment, literal) {',
        '  const held = assignment[Math.abs(literal)];',
        '',
        '  if (held === undefined) return null;',
        '  return literal > 0 ? held : !held;',
        '}',
        '',
        'function watchesFor(clauses) {',
        '  const lists = {};',
        '',
        '  clauses.forEach(function (clause, at) {',
        '    // Only the first literal is watched, so falsifying any other one',
        '    // never brings the clause back for a second look.',
        '    [clause[0]].forEach(function (literal) {',
        '      if (literal === undefined) return;',
        '      lists[-literal] = lists[-literal] || [];',
        '      lists[-literal].push(at);',
        '    });',
        '  });',
        '  return lists;',
        '}',
        '',
        'function inspect(clause, assignment, state) {',
        '  let unassigned = null;',
        '  let count = 0;',
        '',
        '  state.visits += 1;',
        '  for (let at = 0; at < clause.length; at += 1) {',
        '    const value = valueOf(assignment, clause[at]);',
        '',
        '    if (value === true) return { satisfied: true };',
        '    if (value === null) { unassigned = clause[at]; count += 1; }',
        '  }',
        '  if (count === 0) return { conflict: true };',
        '  if (count === 1) return { unit: unassigned };',
        '  return {};',
        '}',
        '',
        'function propagate(clauses, assignment) {',
        '  const state = { visits: 0 };',
        '  const lists = watchesFor(clauses);',
        '  const seen = Object.assign({}, assignment);',
        '  const implied = [];',
        '  const queue = [];',
        '',
        '  Object.keys(seen).forEach(function (name) {',
        '    queue.push(seen[name] ? Number(name) : -Number(name));',
        '  });',
        '  return drain(clauses, lists, { state: state, seen: seen, implied: implied,',
        '    queue: queue });',
        '}',
        '',
        'function drain(clauses, lists, run) {',
        '  while (run.queue.length) {',
        '    const literal = run.queue.shift();',
        '    const waiting = lists[literal] || [];',
        '',
        '    for (let at = 0; at < waiting.length; at += 1) {',
        '      const index = waiting[at];',
        '      const outcome = inspect(clauses[index], run.seen, run.state);',
        '',
        '      if (outcome.conflict) {',
        '        return { implied: run.implied, conflict: index, visits: run.state.visits };',
        '      }',
        '      if (!outcome.unit) continue;',
        '      run.seen[Math.abs(outcome.unit)] = outcome.unit > 0;',
        '      run.implied.push(outcome.unit);',
        '      run.queue.push(-outcome.unit);',
        '    }',
        '  }',
        '  return { implied: run.implied, conflict: null, visits: run.state.visits };',
        '}',
        '',
        'function lab() {',
        '  return { propagate: propagate, valueOf: valueOf, watchesFor: watchesFor };',
        '}'
      ].join('\n'),
      solution: [
        'function valueOf(assignment, literal) {',
        '  const held = assignment[Math.abs(literal)];',
        '',
        '  if (held === undefined) return null;',
        '  return literal > 0 ? held : !held;',
        '}',
        '',
        '/* Two watches per clause. The invariant is that while both watched',
        '   literals are non-false the clause cannot be unit, which is exactly',
        '   what lets propagation ignore it. */',
        'function watchesFor(clauses) {',
        '  const lists = {};',
        '',
        '  clauses.forEach(function (clause, at) {',
        '    clause.slice(0, 2).forEach(function (literal) {',
        '      if (literal === undefined) return;',
        '      lists[-literal] = lists[-literal] || [];',
        '      lists[-literal].push(at);',
        '    });',
        '  });',
        '  return lists;',
        '}',
        '',
        'function inspect(clause, assignment, state) {',
        '  let unassigned = null;',
        '  let count = 0;',
        '',
        '  state.visits += 1;',
        '  for (let at = 0; at < clause.length; at += 1) {',
        '    const value = valueOf(assignment, clause[at]);',
        '',
        '    if (value === true) return { satisfied: true };',
        '    if (value === null) { unassigned = clause[at]; count += 1; }',
        '  }',
        '  if (count === 0) return { conflict: true };',
        '  if (count === 1) return { unit: unassigned };',
        '  return {};',
        '}',
        '',
        'function propagate(clauses, assignment) {',
        '  const state = { visits: 0 };',
        '  const lists = watchesFor(clauses);',
        '  const seen = Object.assign({}, assignment);',
        '  const queue = [];',
        '',
        '  Object.keys(seen).forEach(function (name) {',
        '    queue.push(seen[name] ? Number(name) : -Number(name));',
        '  });',
        '  return drain(clauses, lists, { state: state, seen: seen, implied: [],',
        '    queue: queue });',
        '}',
        '',
        'function drain(clauses, lists, run) {',
        '  while (run.queue.length) {',
        '    const literal = run.queue.shift();',
        '    const waiting = lists[literal] || [];',
        '',
        '    for (let at = 0; at < waiting.length; at += 1) {',
        '      const index = waiting[at];',
        '      const outcome = inspect(clauses[index], run.seen, run.state);',
        '',
        '      if (outcome.conflict) {',
        '        return { implied: run.implied, conflict: index, visits: run.state.visits };',
        '      }',
        '      if (!outcome.unit) continue;',
        '      run.seen[Math.abs(outcome.unit)] = outcome.unit > 0;',
        '      run.implied.push(outcome.unit);',
        '      run.queue.push(-outcome.unit);',
        '    }',
        '  }',
        '  return { implied: run.implied, conflict: null, visits: run.state.visits };',
        '}',
        '',
        'function lab() {',
        '  return { propagate: propagate, valueOf: valueOf, watchesFor: watchesFor };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a unit implication is found when either watched literal is falsified',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.propagate([[1, 2]], { 2: false });

            api.assert.deepEqual(out.implied, [1],
              'the clause became unit when its second literal went false');
            api.assert.equal(out.conflict, null, 'and it is not a conflict');
          }
        },
        {
          name: 'the implications match a naive scan over random formulas',
          assert: function (lab, api) {
            const parts = lab();
            const naive = function (clauses, assignment) {
              const seen = Object.assign({}, assignment);
              const implied = [];
              let changed = true;

              while (changed) {
                changed = false;
                for (let at = 0; at < clauses.length; at += 1) {
                  let unassigned = null;
                  let count = 0;
                  let satisfied = false;

                  clauses[at].forEach(function (literal) {
                    const held = seen[Math.abs(literal)];
                    const value = held === undefined ? null : (literal > 0 ? held : !held);

                    if (value === true) satisfied = true;
                    if (value === null) { unassigned = literal; count += 1; }
                  });
                  if (satisfied) continue;
                  if (count === 0) return { implied: implied, conflict: at };
                  if (count !== 1) continue;
                  seen[Math.abs(unassigned)] = unassigned > 0;
                  implied.push(unassigned);
                  changed = true;
                }
              }
              return { implied: implied, conflict: null };
            };
            /* 1664525 * 2^32 is under 2^53, so every step is exact in a
               double. The textbook 1103515245 multiplier is not, and a
               generator that loses precision can settle on one value - which
               makes the loop below spin forever rather than fail. */
            let state = 7;
            const next = function (bound) {
              state = (state * 1664525 + 1013904223) >>> 0;
              return state % bound;
            };

            for (let trial = 0; trial < 40; trial += 1) {
              const clauses = [];

              for (let at = 0; at < 12; at += 1) {
                const clause = [];

                while (clause.length < 3) {
                  const variable = 1 + next(6);

                  if (clause.some(function (l) { return Math.abs(l) === variable; })) continue;
                  clause.push(next(2) ? variable : -variable);
                }
                clauses.push(clause);
              }
              const assignment = {};

              assignment[1 + next(6)] = Boolean(next(2));
              const mine = parts.propagate(clauses, assignment);
              const reference = naive(clauses, assignment);

              api.assert.deepEqual(mine.implied.slice().sort(),
                reference.implied.slice().sort(),
                'trial ' + trial + ': the implied set must match the naive scan');
              api.assert.equal(mine.conflict === null, reference.conflict === null,
                'trial ' + trial + ': the two must agree on whether there is a conflict');
            }
          }
        },
        {
          name: 'a clause whose watched literals are untouched is never visited',
          assert: function (lab, api) {
            const parts = lab();
            const clauses = [[1, 2, 3, 4], [5, 6, 7, 8]];
            const out = parts.propagate(clauses, { 7: false });

            api.assert.equal(out.visits, 0,
              'literal 7 is watched by neither clause, so nothing needed looking at');
            api.assert.deepEqual(out.implied, [], 'and nothing is implied');
          }
        },
        {
          name: 'a clause with every literal false is reported as a conflict',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.propagate([[1, 2]], { 1: false, 2: false });

            api.assert.equal(out.conflict, 0, 'clause 0 has no satisfiable literal left');
          }
        }
      ]
    }],

    'smt-solving': [{
      id: 'congruence-closure',
      title: 'Decide equality with uninterpreted functions',
      prompt: 'A term is a string for a constant, or { fn, args } for an application. A '
        + 'literal is { left, right, equal }. Write check(literals) returning { ok, model }: '
        + 'merge the classes named by every asserted equality, then close under CONGRUENCE — '
        + 'if two applications of the same function have pairwise equal arguments, their '
        + 'results are equal too — and report ok: false if any asserted disequality has both '
        + 'sides in one class. The model maps each term key to its class id, and must satisfy '
        + 'every asserted equality. The starter merges equalities and never applies '
        + 'congruence, so it accepts a = b together with f(a) not equal to f(b).',
      entry: 'lab',
      starter: [
        'function keyOf(term) {',
        '  if (typeof term === "string") return term;',
        '  return term.fn + "(" + (term.args || []).map(keyOf).join(",") + ")";',
        '}',
        '',
        'function collect(term, into) {',
        '  into[keyOf(term)] = term;',
        '  if (typeof term !== "string") (term.args || []).forEach(function (child) {',
        '    collect(child, into);',
        '  });',
        '  return into;',
        '}',
        '',
        'function find(parent, key) {',
        '  while (parent[key] !== key) key = parent[key];',
        '  return key;',
        '}',
        '',
        'function union(parent, a, b) {',
        '  const rootA = find(parent, a);',
        '  const rootB = find(parent, b);',
        '',
        '  if (rootA === rootB) return false;',
        '  parent[rootA] = rootB;',
        '  return true;',
        '}',
        '',
        'function check(literals) {',
        '  const terms = {};',
        '',
        '  literals.forEach(function (row) {',
        '    collect(row.left, terms);',
        '    collect(row.right, terms);',
        '  });',
        '  const parent = {};',
        '',
        '  Object.keys(terms).forEach(function (key) { parent[key] = key; });',
        '  literals.forEach(function (row) {',
        '    if (row.equal === false) return;',
        '    union(parent, keyOf(row.left), keyOf(row.right));',
        '  });',
        '  // No congruence rule, so f(a) and f(b) stay in different classes',
        '  // however many times a and b have been merged.',
        '  return finish(literals, terms, parent);',
        '}',
        '',
        'function finish(literals, terms, parent) {',
        '  const broken = literals.filter(function (row) {',
        '    return row.equal === false &&',
        '      find(parent, keyOf(row.left)) === find(parent, keyOf(row.right));',
        '  });',
        '  const model = {};',
        '',
        '  Object.keys(terms).forEach(function (key) { model[key] = find(parent, key); });',
        '  return { ok: broken.length === 0, model: model, broken: broken };',
        '}',
        '',
        'function lab() {',
        '  return { check: check, keyOf: keyOf, find: find, union: union };',
        '}'
      ].join('\n'),
      solution: [
        'function keyOf(term) {',
        '  if (typeof term === "string") return term;',
        '  return term.fn + "(" + (term.args || []).map(keyOf).join(",") + ")";',
        '}',
        '',
        'function collect(term, into) {',
        '  into[keyOf(term)] = term;',
        '  if (typeof term !== "string") (term.args || []).forEach(function (child) {',
        '    collect(child, into);',
        '  });',
        '  return into;',
        '}',
        '',
        'function find(parent, key) {',
        '  while (parent[key] !== key) key = parent[key];',
        '  return key;',
        '}',
        '',
        'function union(parent, a, b) {',
        '  const rootA = find(parent, a);',
        '  const rootB = find(parent, b);',
        '',
        '  if (rootA === rootB) return false;',
        '  parent[rootA] = rootB;',
        '  return true;',
        '}',
        '',
        '/* The congruence rule, applied to a fixed point: merging two classes',
        '   can make two applications congruent that were not before, and that',
        '   merge can do it again. One pass is not enough and the failure is',
        '   silent - it answers "consistent" for a contradictory set. */',
        'function close(terms, parent) {',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    const keys = Object.keys(terms);',
        '',
        '    keys.forEach(function (left) {',
        '      keys.forEach(function (right) {',
        '        if (left === right) return;',
        '        if (!congruent(terms, parent, left, right)) return;',
        '        if (union(parent, left, right)) changed = true;',
        '      });',
        '    });',
        '  }',
        '}',
        '',
        'function congruent(terms, parent, left, right) {',
        '  const a = terms[left];',
        '  const b = terms[right];',
        '',
        '  if (typeof a === "string" || typeof b === "string") return false;',
        '  if (a.fn !== b.fn || (a.args || []).length !== (b.args || []).length) return false;',
        '  return (a.args || []).every(function (child, at) {',
        '    return find(parent, keyOf(child)) === find(parent, keyOf(b.args[at]));',
        '  });',
        '}',
        '',
        'function check(literals) {',
        '  const terms = {};',
        '',
        '  literals.forEach(function (row) {',
        '    collect(row.left, terms);',
        '    collect(row.right, terms);',
        '  });',
        '  const parent = {};',
        '',
        '  Object.keys(terms).forEach(function (key) { parent[key] = key; });',
        '  literals.forEach(function (row) {',
        '    if (row.equal === false) return;',
        '    union(parent, keyOf(row.left), keyOf(row.right));',
        '  });',
        '  close(terms, parent);',
        '  return finish(literals, terms, parent);',
        '}',
        '',
        'function finish(literals, terms, parent) {',
        '  const broken = literals.filter(function (row) {',
        '    return row.equal === false &&',
        '      find(parent, keyOf(row.left)) === find(parent, keyOf(row.right));',
        '  });',
        '  const model = {};',
        '',
        '  Object.keys(terms).forEach(function (key) { model[key] = find(parent, key); });',
        '  return { ok: broken.length === 0, model: model, broken: broken };',
        '}',
        '',
        'function lab() {',
        '  return { check: check, keyOf: keyOf, find: find, union: union };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'congruence: a = b makes f(a) and f(b) equal',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([
              { left: 'a', right: 'b', equal: true },
              { left: { fn: 'f', args: ['a'] }, right: { fn: 'f', args: ['b'] }, equal: false }
            ]);

            api.assert.equal(out.ok, false, 'the disequality contradicts congruence');
          }
        },
        {
          name: 'transitivity feeds congruence',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([
              { left: 'a', right: 'b', equal: true },
              { left: 'b', right: 'c', equal: true },
              { left: { fn: 'f', args: ['a'] }, right: { fn: 'f', args: ['c'] }, equal: false }
            ]);

            api.assert.equal(out.ok, false, 'a and c are equal, so f(a) and f(c) must be');
          }
        },
        {
          name: 'congruence is closed to a fixed point, not applied once',
          assert: function (lab, api) {
            const parts = lab();
            const nest = function (depth) {
              let term = 'a';

              for (let at = 0; at < depth; at += 1) term = { fn: 'f', args: [term] };
              return term;
            };
            const other = function (depth) {
              let term = 'b';

              for (let at = 0; at < depth; at += 1) term = { fn: 'f', args: [term] };
              return term;
            };
            const out = parts.check([
              { left: 'a', right: 'b', equal: true },
              { left: nest(3), right: other(3), equal: false }
            ]);

            api.assert.equal(out.ok, false,
              'f(f(f(a))) and f(f(f(b))) are equal, which takes three rounds of closure');
          }
        },
        {
          name: 'a consistent set is accepted, and its model satisfies every equality',
          assert: function (lab, api) {
            const parts = lab();
            const literals = [
              { left: 'a', right: 'b', equal: true },
              { left: { fn: 'f', args: ['a'] }, right: 'c', equal: true },
              { left: 'd', right: 'e', equal: false }
            ];
            const out = parts.check(literals);

            api.assert.equal(out.ok, true, 'nothing here is contradictory');
            literals.forEach(function (row) {
              if (row.equal === false) return;
              api.assert.equal(out.model[parts.keyOf(row.left)],
                out.model[parts.keyOf(row.right)],
                'the model must put both sides of every asserted equality in one class');
            });
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
