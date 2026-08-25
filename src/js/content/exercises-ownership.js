/**
 * Graded exercises for Hoare logic and ownership (M27.10-M27.11).
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
    'denotational-and-axiomatic-semantics': [{
      id: 'weakest-precondition',
      title: 'Generate the verification conditions, and check them over a bounded domain',
      prompt: 'Expressions are { e: "lit", v }, { e: "ref", name } and ' +
        '{ e: "bin", op, left, right }. Formulas are { f: "cmp", op, left, right }, ' +
        '{ f: "and" | "or" | "implies", left, right }, { f: "not", inner } and ' +
        '{ f: "const", v }. Commands are { c: "assign", name, expr }, ' +
        '{ c: "seq", first, second }, { c: "if", test, then, other } and ' +
        '{ c: "while", test, invariant, body }. Write wp(command, post, into) returning the ' +
        'weakest precondition and PUSHING the loop obligations onto `into`: preservation is ' +
        'invariant and test implies wp(body, invariant), exit is invariant and not test implies ' +
        'post. The while rule returns the invariant itself. Then write ' +
        'conditions(pre, command, post) returning the entry obligation followed by whatever the ' +
        'loops contributed, and check(formula, low, high) enumerating all integer states in ' +
        'that range and returning { valid, counterexample }. The starter lets the exit ' +
        'condition assume the precondition, which proves invariants that are too weak.',
      entry: 'lab',
      starter: [
        'function lit(v) { return { e: "lit", v: v }; }',
        'function ref(name) { return { e: "ref", name: name }; }',
        'function bin(op, l, r) { return { e: "bin", op: op, left: l, right: r }; }',
        'function cmp(op, l, r) { return { f: "cmp", op: op, left: l, right: r }; }',
        'function and(l, r) { return { f: "and", left: l, right: r }; }',
        'function implies(l, r) { return { f: "implies", left: l, right: r }; }',
        'function not(i) { return { f: "not", inner: i }; }',
        '',
        'const ARITH = {',
        '  "+": function (a, b) { return a + b; },',
        '  "-": function (a, b) { return a - b; },',
        '  "*": function (a, b) { return a * b; }',
        '};',
        '',
        'const COMPARE = {',
        '  "=": function (a, b) { return a === b; },',
        '  "<": function (a, b) { return a < b; },',
        '  "<=": function (a, b) { return a <= b; },',
        '  ">=": function (a, b) { return a >= b; }',
        '};',
        '',
        'function evalExpr(expr, state) {',
        '  if (expr.e === "lit") return expr.v;',
        '  if (expr.e === "ref") return state[expr.name] === undefined ? 0 : state[expr.name];',
        '  return ARITH[expr.op](evalExpr(expr.left, state), evalExpr(expr.right, state));',
        '}',
        '',
        'function holds(formula, state) {',
        '  if (formula.f === "const") return formula.v;',
        '  if (formula.f === "cmp") {',
        '    return COMPARE[formula.op](evalExpr(formula.left, state),',
        '      evalExpr(formula.right, state));',
        '  }',
        '  if (formula.f === "not") return !holds(formula.inner, state);',
        '  const l = holds(formula.left, state);',
        '  const r = holds(formula.right, state);',
        '',
        '  if (formula.f === "and") return l && r;',
        '  if (formula.f === "or") return l || r;',
        '  return !l || r;',
        '}',
        '',
        'function substExpr(expr, name, value) {',
        '  if (expr.e === "lit") return expr;',
        '  if (expr.e === "ref") return expr.name === name ? value : expr;',
        '  return bin(expr.op, substExpr(expr.left, name, value),',
        '    substExpr(expr.right, name, value));',
        '}',
        '',
        'function subst(formula, name, value) {',
        '  if (formula.f === "const") return formula;',
        '  if (formula.f === "cmp") {',
        '    return cmp(formula.op, substExpr(formula.left, name, value),',
        '      substExpr(formula.right, name, value));',
        '  }',
        '  if (formula.f === "not") return not(subst(formula.inner, name, value));',
        '  return { f: formula.f, left: subst(formula.left, name, value),',
        '    right: subst(formula.right, name, value) };',
        '}',
        '',
        'function variables(node, into) {',
        '  const found = into || [];',
        '',
        '  if (node.e === "ref") {',
        '    if (found.indexOf(node.name) === -1) found.push(node.name);',
        '    return found;',
        '  }',
        '  ["left", "right", "inner"].forEach(function (slot) {',
        '    if (node[slot] && typeof node[slot] === "object") variables(node[slot], found);',
        '  });',
        '  return found;',
        '}',
        '',
        'let PRE = { f: "const", v: true };',
        '',
        'function wp(command, post, into) {',
        '  const list = into || [];',
        '',
        '  if (command.c === "assign") return subst(post, command.name, command.expr);',
        '  if (command.c === "seq") return wp(command.first, wp(command.second, post, list), list);',
        '  if (command.c === "if") {',
        '    return and(implies(command.test, wp(command.then, post, list)),',
        '      implies(not(command.test), wp(command.other, post, list)));',
        '  }',
        '  list.push({ name: "preservation",',
        '    formula: implies(and(command.invariant, command.test),',
        '      wp(command.body, command.invariant, list)) });',
        '  // The exit condition is handed the precondition too, which is not the rule.',
        '  list.push({ name: "exit",',
        '    formula: implies(and(PRE, and(command.invariant, not(command.test))), post) });',
        '  return command.invariant;',
        '}',
        '',
        'function conditions(pre, command, post) {',
        '  PRE = pre;',
        '  const loops = [];',
        '  const weakest = wp(command, post, loops);',
        '',
        '  return [{ name: "entry", formula: implies(pre, weakest) }].concat(loops);',
        '}',
        '',
        'function check(formula, low, high) {',
        '  const names = variables(formula, []);',
        '  const state = {};',
        '  let found = null;',
        '',
        '  function walk(index) {',
        '    if (found !== null) return;',
        '    if (index === names.length) {',
        '      if (holds(formula, state) === false) found = Object.assign({}, state);',
        '      return;',
        '    }',
        '    for (let v = low; v <= high; v += 1) {',
        '      state[names[index]] = v;',
        '      walk(index + 1);',
        '      if (found !== null) return;',
        '    }',
        '  }',
        '  walk(0);',
        '  return { valid: found === null, counterexample: found };',
        '}',
        '',
        'function lab() {',
        '  return { wp: wp, conditions: conditions, check: check, holds: holds,',
        '    lit: lit, ref: ref, bin: bin, cmp: cmp, and: and, implies: implies, not: not };',
        '}'
      ].join('\n'),
      solution: [
        'function lit(v) { return { e: "lit", v: v }; }',
        'function ref(name) { return { e: "ref", name: name }; }',
        'function bin(op, l, r) { return { e: "bin", op: op, left: l, right: r }; }',
        'function cmp(op, l, r) { return { f: "cmp", op: op, left: l, right: r }; }',
        'function and(l, r) { return { f: "and", left: l, right: r }; }',
        'function implies(l, r) { return { f: "implies", left: l, right: r }; }',
        'function not(i) { return { f: "not", inner: i }; }',
        '',
        'const ARITH = {',
        '  "+": function (a, b) { return a + b; },',
        '  "-": function (a, b) { return a - b; },',
        '  "*": function (a, b) { return a * b; }',
        '};',
        '',
        'const COMPARE = {',
        '  "=": function (a, b) { return a === b; },',
        '  "<": function (a, b) { return a < b; },',
        '  "<=": function (a, b) { return a <= b; },',
        '  ">=": function (a, b) { return a >= b; }',
        '};',
        '',
        'function evalExpr(expr, state) {',
        '  if (expr.e === "lit") return expr.v;',
        '  if (expr.e === "ref") return state[expr.name] === undefined ? 0 : state[expr.name];',
        '  return ARITH[expr.op](evalExpr(expr.left, state), evalExpr(expr.right, state));',
        '}',
        '',
        'function holds(formula, state) {',
        '  if (formula.f === "const") return formula.v;',
        '  if (formula.f === "cmp") {',
        '    return COMPARE[formula.op](evalExpr(formula.left, state),',
        '      evalExpr(formula.right, state));',
        '  }',
        '  if (formula.f === "not") return !holds(formula.inner, state);',
        '  const l = holds(formula.left, state);',
        '  const r = holds(formula.right, state);',
        '',
        '  if (formula.f === "and") return l && r;',
        '  if (formula.f === "or") return l || r;',
        '  return !l || r;',
        '}',
        '',
        'function substExpr(expr, name, value) {',
        '  if (expr.e === "lit") return expr;',
        '  if (expr.e === "ref") return expr.name === name ? value : expr;',
        '  return bin(expr.op, substExpr(expr.left, name, value),',
        '    substExpr(expr.right, name, value));',
        '}',
        '',
        'function subst(formula, name, value) {',
        '  if (formula.f === "const") return formula;',
        '  if (formula.f === "cmp") {',
        '    return cmp(formula.op, substExpr(formula.left, name, value),',
        '      substExpr(formula.right, name, value));',
        '  }',
        '  if (formula.f === "not") return not(subst(formula.inner, name, value));',
        '  return { f: formula.f, left: subst(formula.left, name, value),',
        '    right: subst(formula.right, name, value) };',
        '}',
        '',
        'function variables(node, into) {',
        '  const found = into || [];',
        '',
        '  if (node.e === "ref") {',
        '    if (found.indexOf(node.name) === -1) found.push(node.name);',
        '    return found;',
        '  }',
        '  ["left", "right", "inner"].forEach(function (slot) {',
        '    if (node[slot] && typeof node[slot] === "object") variables(node[slot], found);',
        '  });',
        '  return found;',
        '}',
        '',
        'function wp(command, post, into) {',
        '  const list = into || [];',
        '',
        '  if (command.c === "assign") return subst(post, command.name, command.expr);',
        '  if (command.c === "seq") return wp(command.first, wp(command.second, post, list), list);',
        '  if (command.c === "if") {',
        '    return and(implies(command.test, wp(command.then, post, list)),',
        '      implies(not(command.test), wp(command.other, post, list)));',
        '  }',
        '  list.push({ name: "preservation",',
        '    formula: implies(and(command.invariant, command.test),',
        '      wp(command.body, command.invariant, list)) });',
        '  list.push({ name: "exit",',
        '    formula: implies(and(command.invariant, not(command.test)), post) });',
        '  return command.invariant;',
        '}',
        '',
        'function conditions(pre, command, post) {',
        '  const loops = [];',
        '  const weakest = wp(command, post, loops);',
        '',
        '  return [{ name: "entry", formula: implies(pre, weakest) }].concat(loops);',
        '}',
        '',
        'function check(formula, low, high) {',
        '  const names = variables(formula, []);',
        '  const state = {};',
        '  let found = null;',
        '',
        '  function walk(index) {',
        '    if (found !== null) return;',
        '    if (index === names.length) {',
        '      if (holds(formula, state) === false) found = Object.assign({}, state);',
        '      return;',
        '    }',
        '    for (let v = low; v <= high; v += 1) {',
        '      state[names[index]] = v;',
        '      walk(index + 1);',
        '      if (found !== null) return;',
        '    }',
        '  }',
        '  walk(0);',
        '  return { valid: found === null, counterexample: found };',
        '}',
        '',
        'function lab() {',
        '  return { wp: wp, conditions: conditions, check: check, holds: holds,',
        '    lit: lit, ref: ref, bin: bin, cmp: cmp, and: and, implies: implies, not: not };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'assignment substitutes backwards',
          assert: function (lab, api) {
            const p = lab();
            const post = p.cmp('=', p.ref('x'), p.lit(5));
            const before = p.wp({ c: 'assign', name: 'x', expr: p.ref('y') }, post, []);

            api.assert.ok(p.holds(before, { y: 5 }),
              'for x = 5 to hold after x := y, y must have been 5');
            api.assert.ok(!p.holds(before, { y: 4 }), 'and not otherwise');
          }
        },
        {
          name: 'the swap without a temporary fails its entry condition',
          assert: function (lab, api) {
            const p = lab();
            const pre = p.and(p.cmp('=', p.ref('x'), p.ref('a')),
              p.cmp('=', p.ref('y'), p.ref('b')));
            const post = p.and(p.cmp('=', p.ref('x'), p.ref('b')),
              p.cmp('=', p.ref('y'), p.ref('a')));
            const broken = { c: 'seq',
              first: { c: 'assign', name: 'x', expr: p.ref('y') },
              second: { c: 'assign', name: 'y', expr: p.ref('x') } };
            const good = { c: 'seq',
              first: { c: 'seq', first: { c: 'assign', name: 't', expr: p.ref('x') },
                second: { c: 'assign', name: 'x', expr: p.ref('y') } },
              second: { c: 'assign', name: 'y', expr: p.ref('t') } };

            api.assert.ok(!p.check(p.conditions(pre, broken, post)[0].formula, -2, 3).valid,
              'x := y; y := x loses the original x, so the triple must not be provable');
            api.assert.ok(p.check(p.conditions(pre, good, post)[0].formula, -2, 3).valid,
              'and the three-assignment version is');
          }
        },
        {
          name: 'a loop contributes exactly two obligations beyond the entry',
          assert: function (lab, api) {
            const p = lab();
            const body = { c: 'seq',
              first: { c: 'assign', name: 's',
                expr: p.bin('+', p.ref('s'), p.ref('i')) },
              second: { c: 'assign', name: 'i',
                expr: p.bin('+', p.ref('i'), p.lit(1)) } };
            const invariant = p.and(
              p.cmp('=', p.bin('*', p.lit(2), p.ref('s')),
                p.bin('*', p.ref('i'), p.bin('-', p.ref('i'), p.lit(1)))),
              p.cmp('<=', p.ref('i'), p.ref('n')));
            const loop = { c: 'while', test: p.cmp('<', p.ref('i'), p.ref('n')),
              invariant: invariant, body: body };
            const out = p.conditions(p.cmp('>=', p.ref('n'), p.lit(0)), loop,
              p.cmp('=', p.bin('*', p.lit(2), p.ref('s')),
                p.bin('*', p.ref('n'), p.bin('-', p.ref('n'), p.lit(1)))));

            api.assert.equal(out.length, 3, 'entry, preservation and exit');
            api.assert.equal(out[1].name, 'preservation', 'in that order');
            api.assert.equal(out[2].name, 'exit', 'with exit last');
          }
        },
        {
          name: 'the exit condition may not assume the precondition',
          assert: function (lab, api) {
            const p = lab();
            const body = { c: 'assign', name: 'i',
              expr: p.bin('+', p.ref('i'), p.lit(1)) };
            const weak = p.cmp('>=', p.ref('i'), p.lit(0));
            const loop = { c: 'while', test: p.cmp('<', p.ref('i'), p.ref('n')),
              invariant: weak, body: body };
            const nonNegative = p.cmp('>=', p.ref('n'), p.lit(0));
            const out = p.conditions(nonNegative, loop, nonNegative);
            const exit = out.filter(function (o) { return o.name === 'exit'; })[0];

            api.assert.ok(!p.check(exit.formula, -2, 4).valid,
              'the invariant i >= 0 says nothing about n, so it cannot establish n >= 0 on ' +
                'exit — i = 0, n = -2 falsifies it. Conjoining the precondition n >= 0 into ' +
                'the exit condition makes it trivially valid, and that is not the while rule: ' +
                'the invariant has to carry forward everything the postcondition needs.');
          }
        },
        {
          name: 'a counterexample is a state, and a valid formula has none',
          assert: function (lab, api) {
            const p = lab();
            const always = p.implies(p.cmp('>=', p.ref('x'), p.lit(1)),
              p.cmp('>=', p.ref('x'), p.lit(0)));
            const never = p.implies(p.cmp('>=', p.ref('x'), p.lit(0)),
              p.cmp('>=', p.ref('x'), p.lit(1)));
            const bad = p.check(never, -2, 5);

            api.assert.ok(p.check(always, -2, 5).valid, 'x >= 1 implies x >= 0 everywhere');
            api.assert.ok(!bad.valid, 'the converse does not');
            api.assert.equal(bad.counterexample.x, 0,
              'and the counterexample is a state you can read: x = 0');
          }
        }
      ]
    }],
    'substructural-types-and-ownership': [{
      id: 'borrow-checker',
      title: 'Check ownership and borrows, and blame the line that caused each conflict',
      prompt: 'A statement is { kind, args, line } where kind is one of make, move, use, ' +
        'mutate, drop, share, borrow or release. Write check(statements, discipline) returning ' +
        '{ accepted, errors, uses } where each error is { line, message, blame } and blame is ' +
        'the line that created the conflicting state, or −1. The borrow rules: a moved-out name ' +
        'may not be used again; a name may not be moved or dropped while borrowed; a mutable ' +
        'borrow is refused while any shared borrow is live and vice versa; writing through a ' +
        'shared borrow is refused; a released borrow may not be used. A use through a BORROW ' +
        'must not increment the owner\'s use count — that is what borrowing buys. Then apply ' +
        'the discipline: "affine" and "linear" refuse more than one use of a name, "relevant" ' +
        'and "linear" refuse zero. The starter counts a read through a borrow as a use of the ' +
        'owner, so two shared borrows exhaust an affine budget.',
      entry: 'lab',
      starter: [
        'const DISCIPLINES = {',
        '  unrestricted: { contraction: true, weakening: true },',
        '  affine: { contraction: false, weakening: true },',
        '  relevant: { contraction: true, weakening: false },',
        '  linear: { contraction: false, weakening: false }',
        '};',
        '',
        'function check(statements, disciplineName) {',
        '  const rules = DISCIPLINES[disciplineName] || DISCIPLINES.affine;',
        '  const owners = {};',
        '  const borrows = {};',
        '  const uses = {};',
        '  const errors = [];',
        '',
        '  function fail(stmt, message, blame) {',
        '    errors.push({ line: stmt.line, message: message,',
        '      blame: blame === undefined ? -1 : blame });',
        '  }',
        '',
        '  function owner(stmt, name) {',
        '    const entry = owners[name];',
        '',
        '    if (!entry) { fail(stmt, name + " is not bound"); return null; }',
        '    if (!entry.alive) {',
        '      fail(stmt, name + " was already moved out of", entry.movedAt);',
        '      return null;',
        '    }',
        '    return entry;',
        '  }',
        '',
        '  statements.forEach(function (stmt) {',
        '    const kind = stmt.kind;',
        '    const a = stmt.args[0];',
        '    const b = stmt.args[1];',
        '',
        '    if (kind === "make") {',
        '      owners[a] = { alive: true, line: stmt.line, movedAt: -1, shared: [], mutable: null };',
        '      uses[a] = 0;',
        '      return;',
        '    }',
        '    if (kind === "move" || kind === "drop") {',
        '      const target = kind === "move" ? b : a;',
        '      const entry = owner(stmt, target);',
        '',
        '      if (!entry) return;',
        '      if (entry.shared.length > 0 || entry.mutable) {',
        '        const at = entry.mutable ? entry.mutable.line : entry.shared[0].line;',
        '',
        '        fail(stmt, "cannot " + kind + " " + target + " while it is borrowed", at);',
        '        return;',
        '      }',
        '      entry.alive = false;',
        '      entry.movedAt = stmt.line;',
        '      uses[target] += 1;',
        '      if (kind === "move") {',
        '        owners[a] = { alive: true, line: stmt.line, movedAt: -1, shared: [], mutable: null };',
        '        uses[a] = 0;',
        '      }',
        '      return;',
        '    }',
        '    if (kind === "use" || kind === "mutate") {',
        '      const writing = kind === "mutate";',
        '      const borrowed = borrows[a];',
        '',
        '      if (borrowed) {',
        '        if (!borrowed.live) { fail(stmt, a + " outlived its borrow", borrowed.endedAt); return; }',
        '        if (writing && !borrowed.mutable) {',
        '          fail(stmt, a + " is a shared borrow, not a mutable one", borrowed.line);',
        '          return;',
        '        }',
        '        // Counting a read through a borrow as a use of the owner is the bug.',
        '        uses[borrowed.target] += 1;',
        '        return;',
        '      }',
        '      const entry = owner(stmt, a);',
        '',
        '      if (!entry) return;',
        '      if (writing && entry.shared.length > 0) {',
        '        fail(stmt, "cannot mutate " + a + " while a shared borrow is live",',
        '          entry.shared[0].line);',
        '        return;',
        '      }',
        '      if (entry.mutable) {',
        '        fail(stmt, "cannot use " + a + " while it is mutably borrowed", entry.mutable.line);',
        '        return;',
        '      }',
        '      uses[a] += 1;',
        '      return;',
        '    }',
        '    if (kind === "share" || kind === "borrow") {',
        '      const wantsMutable = kind === "borrow";',
        '      const entry = owner(stmt, b);',
        '',
        '      if (!entry) return;',
        '      if (entry.mutable) {',
        '        fail(stmt, b + " is already mutably borrowed", entry.mutable.line);',
        '      } else if (wantsMutable && entry.shared.length > 0) {',
        '        fail(stmt, "cannot borrow " + b + " mutably while " + entry.shared.length +',
        '          " shared borrow is live", entry.shared[0].line);',
        '      }',
        '      const record = { name: a, target: b, mutable: wantsMutable, live: true,',
        '        line: stmt.line, endedAt: -1 };',
        '',
        '      borrows[a] = record;',
        '      if (wantsMutable) entry.mutable = record;',
        '      else entry.shared.push(record);',
        '      return;',
        '    }',
        '    const record = borrows[a];',
        '',
        '    if (!record) { fail(stmt, a + " is not a borrow"); return; }',
        '    if (!record.live) { fail(stmt, a + " was already released", record.endedAt); return; }',
        '    record.live = false;',
        '    record.endedAt = stmt.line;',
        '    const entry = owners[record.target];',
        '',
        '    if (!entry) return;',
        '    if (record.mutable) entry.mutable = null;',
        '    else entry.shared = entry.shared.filter(function (o) { return o !== record; });',
        '  });',
        '',
        '  const borrowErrors = errors.length;',
        '',
        '  Object.keys(uses).forEach(function (name) {',
        '    if (!rules.contraction && uses[name] > 1) {',
        '      errors.push({ line: -1, blame: -1,',
        '        message: name + " is used " + uses[name] + " times, and this discipline allows at most one" });',
        '    }',
        '    if (!rules.weakening && uses[name] === 0) {',
        '      errors.push({ line: -1, blame: -1,',
        '        message: name + " is never used, and this discipline requires at least one use" });',
        '    }',
        '  });',
        '  return { accepted: errors.length === 0, errors: errors, uses: uses,',
        '    borrowErrors: borrowErrors };',
        '}',
        '',
        'function lab() { return { check: check, DISCIPLINES: DISCIPLINES }; }'
      ].join('\n'),
      solution: [
        'const DISCIPLINES = {',
        '  unrestricted: { contraction: true, weakening: true },',
        '  affine: { contraction: false, weakening: true },',
        '  relevant: { contraction: true, weakening: false },',
        '  linear: { contraction: false, weakening: false }',
        '};',
        '',
        'function check(statements, disciplineName) {',
        '  const rules = DISCIPLINES[disciplineName] || DISCIPLINES.affine;',
        '  const owners = {};',
        '  const borrows = {};',
        '  const uses = {};',
        '  const errors = [];',
        '',
        '  function fail(stmt, message, blame) {',
        '    errors.push({ line: stmt.line, message: message,',
        '      blame: blame === undefined ? -1 : blame });',
        '  }',
        '',
        '  function owner(stmt, name) {',
        '    const entry = owners[name];',
        '',
        '    if (!entry) { fail(stmt, name + " is not bound"); return null; }',
        '    if (!entry.alive) {',
        '      fail(stmt, name + " was already moved out of", entry.movedAt);',
        '      return null;',
        '    }',
        '    return entry;',
        '  }',
        '',
        '  statements.forEach(function (stmt) {',
        '    const kind = stmt.kind;',
        '    const a = stmt.args[0];',
        '    const b = stmt.args[1];',
        '',
        '    if (kind === "make") {',
        '      owners[a] = { alive: true, line: stmt.line, movedAt: -1, shared: [], mutable: null };',
        '      uses[a] = 0;',
        '      return;',
        '    }',
        '    if (kind === "move" || kind === "drop") {',
        '      const target = kind === "move" ? b : a;',
        '      const entry = owner(stmt, target);',
        '',
        '      if (!entry) return;',
        '      if (entry.shared.length > 0 || entry.mutable) {',
        '        const at = entry.mutable ? entry.mutable.line : entry.shared[0].line;',
        '',
        '        fail(stmt, "cannot " + kind + " " + target + " while it is borrowed", at);',
        '        return;',
        '      }',
        '      entry.alive = false;',
        '      entry.movedAt = stmt.line;',
        '      uses[target] += 1;',
        '      if (kind === "move") {',
        '        owners[a] = { alive: true, line: stmt.line, movedAt: -1, shared: [], mutable: null };',
        '        uses[a] = 0;',
        '      }',
        '      return;',
        '    }',
        '    if (kind === "use" || kind === "mutate") {',
        '      const writing = kind === "mutate";',
        '      const borrowed = borrows[a];',
        '',
        '      if (borrowed) {',
        '        if (!borrowed.live) { fail(stmt, a + " outlived its borrow", borrowed.endedAt); return; }',
        '        if (writing && !borrowed.mutable) {',
        '          fail(stmt, a + " is a shared borrow, not a mutable one", borrowed.line);',
        '        }',
        '        return;',
        '      }',
        '      const entry = owner(stmt, a);',
        '',
        '      if (!entry) return;',
        '      if (writing && entry.shared.length > 0) {',
        '        fail(stmt, "cannot mutate " + a + " while a shared borrow is live",',
        '          entry.shared[0].line);',
        '        return;',
        '      }',
        '      if (entry.mutable) {',
        '        fail(stmt, "cannot use " + a + " while it is mutably borrowed", entry.mutable.line);',
        '        return;',
        '      }',
        '      uses[a] += 1;',
        '      return;',
        '    }',
        '    if (kind === "share" || kind === "borrow") {',
        '      const wantsMutable = kind === "borrow";',
        '      const entry = owner(stmt, b);',
        '',
        '      if (!entry) return;',
        '      if (entry.mutable) {',
        '        fail(stmt, b + " is already mutably borrowed", entry.mutable.line);',
        '      } else if (wantsMutable && entry.shared.length > 0) {',
        '        fail(stmt, "cannot borrow " + b + " mutably while " + entry.shared.length +',
        '          " shared borrow is live", entry.shared[0].line);',
        '      }',
        '      const record = { name: a, target: b, mutable: wantsMutable, live: true,',
        '        line: stmt.line, endedAt: -1 };',
        '',
        '      borrows[a] = record;',
        '      if (wantsMutable) entry.mutable = record;',
        '      else entry.shared.push(record);',
        '      return;',
        '    }',
        '    const record = borrows[a];',
        '',
        '    if (!record) { fail(stmt, a + " is not a borrow"); return; }',
        '    if (!record.live) { fail(stmt, a + " was already released", record.endedAt); return; }',
        '    record.live = false;',
        '    record.endedAt = stmt.line;',
        '    const entry = owners[record.target];',
        '',
        '    if (!entry) return;',
        '    if (record.mutable) entry.mutable = null;',
        '    else entry.shared = entry.shared.filter(function (o) { return o !== record; });',
        '  });',
        '',
        '  const borrowErrors = errors.length;',
        '',
        '  Object.keys(uses).forEach(function (name) {',
        '    if (!rules.contraction && uses[name] > 1) {',
        '      errors.push({ line: -1, blame: -1,',
        '        message: name + " is used " + uses[name] + " times, and this discipline allows at most one" });',
        '    }',
        '    if (!rules.weakening && uses[name] === 0) {',
        '      errors.push({ line: -1, blame: -1,',
        '        message: name + " is never used, and this discipline requires at least one use" });',
        '    }',
        '  });',
        '  return { accepted: errors.length === 0, errors: errors, uses: uses,',
        '    borrowErrors: borrowErrors };',
        '}',
        '',
        'function lab() { return { check: check, DISCIPLINES: DISCIPLINES }; }'
      ].join('\n'),
      tests: [
        {
          name: 'borrowing does not spend the owner\'s single use',
          assert: function (lab, api) {
            const parts = lab();
            const s = function (kind, args, line) {
              return { kind: kind, args: args, line: line };
            };
            const program = [s('make', ['x'], 0), s('share', ['a', 'x'], 1),
              s('share', ['b', 'x'], 2), s('use', ['a'], 3), s('use', ['b'], 4),
              s('release', ['a'], 5), s('release', ['b'], 6), s('drop', ['x'], 7)];
            const out = parts.check(program, 'linear');

            api.assert.equal(out.uses.x, 1,
              'x is consumed exactly once, by the drop — reading through a borrow must not ' +
                'count, or an affine budget is exhausted by looking at the value');
            api.assert.ok(out.accepted,
              'and the program is accepted even under the linear discipline, which is the ' +
                'whole reason borrowing exists');
          }
        },
        {
          name: 'use after move names the line that moved it',
          assert: function (lab, api) {
            const parts = lab();
            const s = function (kind, args, line) {
              return { kind: kind, args: args, line: line };
            };
            const out = parts.check([s('make', ['x'], 0), s('move', ['y', 'x'], 1),
              s('use', ['x'], 2)], 'affine');

            api.assert.equal(out.errors.length, 1, 'exactly one error');
            api.assert.equal(out.errors[0].line, 2, 'reported at the use');
            api.assert.equal(out.errors[0].blame, 1,
              'and blamed on the move — "x was already moved out of" without the line is ' +
                'unactionable');
          }
        },
        {
          name: 'aliasing XOR mutation, in both directions',
          assert: function (lab, api) {
            const parts = lab();
            const s = function (kind, args, line) {
              return { kind: kind, args: args, line: line };
            };
            const sharedThenMutable = parts.check([s('make', ['x'], 0),
              s('share', ['a', 'x'], 1), s('borrow', ['m', 'x'], 2)], 'affine');
            const twoMutable = parts.check([s('make', ['x'], 0),
              s('borrow', ['m', 'x'], 1), s('borrow', ['n', 'x'], 2)], 'affine');

            api.assert.ok(!sharedThenMutable.accepted,
              'a mutable borrow while a shared one is live must be refused');
            api.assert.equal(sharedThenMutable.errors[0].blame, 1,
              'blamed on the shared borrow');
            api.assert.ok(!twoMutable.accepted, 'two mutable borrows must be refused');
            api.assert.equal(twoMutable.errors[0].blame, 1, 'blamed on the first');
          }
        },
        {
          name: 'writing through a shared borrow, and using a released one',
          assert: function (lab, api) {
            const parts = lab();
            const s = function (kind, args, line) {
              return { kind: kind, args: args, line: line };
            };
            const write = parts.check([s('make', ['x'], 0), s('share', ['a', 'x'], 1),
              s('mutate', ['a'], 2)], 'affine');
            const late = parts.check([s('make', ['x'], 0), s('share', ['a', 'x'], 1),
              s('release', ['a'], 2), s('use', ['a'], 3)], 'affine');

            api.assert.ok(!write.accepted, 'a shared borrow is read-only');
            api.assert.ok(!late.accepted, 'and a released borrow is dead');
            api.assert.equal(late.errors[0].blame, 2,
              'blamed on the release, which is where the region ended');
          }
        },
        {
          name: 'the disciplines separate on exactly the two structural rules',
          assert: function (lab, api) {
            const parts = lab();
            const s = function (kind, args, line) {
              return { kind: kind, args: args, line: line };
            };
            const leak = [s('make', ['x'], 0)];
            const twice = [s('make', ['x'], 0), s('use', ['x'], 1), s('use', ['x'], 2),
              s('drop', ['x'], 3)];

            api.assert.ok(parts.check(leak, 'affine').accepted,
              'affine allows forgetting — this is why Rust does not catch leaks');
            api.assert.ok(!parts.check(leak, 'linear').accepted,
              'linear does not, because it drops weakening too');
            api.assert.ok(parts.check(twice, 'relevant').accepted,
              'relevant allows using a name more than once');
            api.assert.ok(!parts.check(twice, 'affine').accepted,
              'affine does not, because it drops contraction');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
