/**
 * Graded exercises for type classes and pattern matching (M27.8-M27.9).
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
    'beyond-plain-generics': [{
      id: 'instance-resolution',
      title: 'Resolve a constraint into a dictionary, and refuse when two instances match',
      prompt: 'A type is { name, args, variable }. An instance is { className, head, context } ' +
        'where head is a type and context is a list of { className, type }. Write ' +
        'resolve(goal, instances, allowOverlap) returning { ok, dictionary, count, depth } or ' +
        '{ ok: false, why, overlap, ambiguous }. Match an instance head against the goal ONE ' +
        'WAY — the head may have variables, the goal may not — and a repeated head variable ' +
        'must bind consistently. A goal whose type is a bare variable is AMBIGUOUS and is ' +
        'refused before any instance is consulted. When more than one instance matches, refuse ' +
        'with overlap: true unless allowOverlap, in which case take the most specific (the most ' +
        'concrete constructor names in the head). Build the dictionary name as "d" plus the ' +
        'class name plus the head with non-letters removed, applied to its context ' +
        'dictionaries. The starter skips the consistency check, so a head of Pair a a matches a ' +
        'goal of Pair Int Bool.',
      entry: 'lab',
      starter: [
        'function tcon(name, args) {',
        '  return { name: name, args: args || [], variable: false };',
        '}',
        '',
        'function tvar(name) { return { name: name, args: [], variable: true }; }',
        '',
        'function showType(type) {',
        '  if (type.args.length === 0) return type.name;',
        '  return type.name + " " + type.args.map(function (a) {',
        '    return a.args.length === 0 ? showType(a) : "(" + showType(a) + ")";',
        '  }).join(" ");',
        '}',
        '',
        'function match(head, goal, bound) {',
        '  const seen = bound || {};',
        '',
        '  if (head.variable) {',
        '    // No consistency check: a head variable seen twice rebinds instead of comparing,',
        '    // so Pair a a matches Pair Int Bool.',
        '    seen[head.name] = goal;',
        '    return seen;',
        '  }',
        '  if (head.name !== goal.name || head.args.length !== goal.args.length) return null;',
        '  let current = seen;',
        '',
        '  for (let i = 0; i < head.args.length; i += 1) {',
        '    current = match(head.args[i], goal.args[i], current);',
        '    if (current === null) return null;',
        '  }',
        '  return current;',
        '}',
        '',
        'function substitute(type, bound) {',
        '  if (type.variable) return bound[type.name] === undefined ? type : bound[type.name];',
        '  return tcon(type.name, type.args.map(function (a) { return substitute(a, bound); }));',
        '}',
        '',
        'function specificity(type) {',
        '  if (type.variable) return 0;',
        '  return 1 + type.args.reduce(function (sum, a) { return sum + specificity(a); }, 0);',
        '}',
        '',
        'function dictName(instance) {',
        '  return "d" + instance.className + showType(instance.head).replace(/[^A-Za-z]/g, "");',
        '}',
        '',
        'function resolve(goal, instances, allowOverlap, depth) {',
        '  const level = depth || 0;',
        '',
        '  if (level > 12) return { ok: false, why: "resolution did not terminate" };',
        '  if (goal.type.variable) {',
        '    return { ok: false, ambiguous: true,',
        '      why: goal.className + " " + goal.type.name + " has a type variable no call site can fix" };',
        '  }',
        '  const candidates = instances.filter(function (inst) {',
        '    return inst.className === goal.className && match(inst.head, goal.type, {}) !== null;',
        '  });',
        '',
        '  if (candidates.length === 0) {',
        '    return { ok: false, why: "no instance for " + goal.className + " " + showType(goal.type) };',
        '  }',
        '  if (candidates.length > 1 && !allowOverlap) {',
        '    return { ok: false, overlap: true,',
        '      why: candidates.length + " instances match " + goal.className + " " + showType(goal.type) };',
        '  }',
        '  const chosen = candidates.slice().sort(function (a, b) {',
        '    return specificity(b.head) - specificity(a.head);',
        '  })[0];',
        '  const bound = match(chosen.head, goal.type, {});',
        '  const parts = [];',
        '  let count = 1;',
        '  let deepest = 1;',
        '',
        '  for (let i = 0; i < chosen.context.length; i += 1) {',
        '    const sub = { className: chosen.context[i].className,',
        '      type: substitute(chosen.context[i].type, bound) };',
        '    const inner = resolve(sub, instances, allowOverlap, level + 1);',
        '',
        '    if (!inner.ok) return inner;',
        '    parts.push(inner.dictionary);',
        '    count += inner.count;',
        '    deepest = Math.max(deepest, 1 + inner.depth);',
        '  }',
        '  const name = dictName(chosen);',
        '',
        '  return { ok: true, count: count, depth: deepest,',
        '    dictionary: parts.length === 0 ? name : name + "(" + parts.join(", ") + ")" };',
        '}',
        '',
        'function lab() {',
        '  return { resolve: resolve, tcon: tcon, tvar: tvar, showType: showType, match: match };',
        '}'
      ].join('\n'),
      solution: [
        'function tcon(name, args) {',
        '  return { name: name, args: args || [], variable: false };',
        '}',
        '',
        'function tvar(name) { return { name: name, args: [], variable: true }; }',
        '',
        'function showType(type) {',
        '  if (type.args.length === 0) return type.name;',
        '  return type.name + " " + type.args.map(function (a) {',
        '    return a.args.length === 0 ? showType(a) : "(" + showType(a) + ")";',
        '  }).join(" ");',
        '}',
        '',
        'function match(head, goal, bound) {',
        '  const seen = bound || {};',
        '',
        '  if (head.variable) {',
        '    if (seen[head.name] !== undefined) {',
        '      return showType(seen[head.name]) === showType(goal) ? seen : null;',
        '    }',
        '    seen[head.name] = goal;',
        '    return seen;',
        '  }',
        '  if (head.name !== goal.name || head.args.length !== goal.args.length) return null;',
        '  let current = seen;',
        '',
        '  for (let i = 0; i < head.args.length; i += 1) {',
        '    current = match(head.args[i], goal.args[i], current);',
        '    if (current === null) return null;',
        '  }',
        '  return current;',
        '}',
        '',
        'function substitute(type, bound) {',
        '  if (type.variable) return bound[type.name] === undefined ? type : bound[type.name];',
        '  return tcon(type.name, type.args.map(function (a) { return substitute(a, bound); }));',
        '}',
        '',
        'function specificity(type) {',
        '  if (type.variable) return 0;',
        '  return 1 + type.args.reduce(function (sum, a) { return sum + specificity(a); }, 0);',
        '}',
        '',
        'function dictName(instance) {',
        '  return "d" + instance.className + showType(instance.head).replace(/[^A-Za-z]/g, "");',
        '}',
        '',
        'function resolve(goal, instances, allowOverlap, depth) {',
        '  const level = depth || 0;',
        '',
        '  if (level > 12) return { ok: false, why: "resolution did not terminate" };',
        '  if (goal.type.variable) {',
        '    return { ok: false, ambiguous: true,',
        '      why: goal.className + " " + goal.type.name + " has a type variable no call site can fix" };',
        '  }',
        '  const candidates = instances.filter(function (inst) {',
        '    return inst.className === goal.className && match(inst.head, goal.type, {}) !== null;',
        '  });',
        '',
        '  if (candidates.length === 0) {',
        '    return { ok: false, why: "no instance for " + goal.className + " " + showType(goal.type) };',
        '  }',
        '  if (candidates.length > 1 && !allowOverlap) {',
        '    return { ok: false, overlap: true,',
        '      why: candidates.length + " instances match " + goal.className + " " + showType(goal.type) };',
        '  }',
        '  const chosen = candidates.slice().sort(function (a, b) {',
        '    return specificity(b.head) - specificity(a.head);',
        '  })[0];',
        '  const bound = match(chosen.head, goal.type, {});',
        '  const parts = [];',
        '  let count = 1;',
        '  let deepest = 1;',
        '',
        '  for (let i = 0; i < chosen.context.length; i += 1) {',
        '    const sub = { className: chosen.context[i].className,',
        '      type: substitute(chosen.context[i].type, bound) };',
        '    const inner = resolve(sub, instances, allowOverlap, level + 1);',
        '',
        '    if (!inner.ok) return inner;',
        '    parts.push(inner.dictionary);',
        '    count += inner.count;',
        '    deepest = Math.max(deepest, 1 + inner.depth);',
        '  }',
        '  const name = dictName(chosen);',
        '',
        '  return { ok: true, count: count, depth: deepest,',
        '    dictionary: parts.length === 0 ? name : name + "(" + parts.join(", ") + ")" };',
        '}',
        '',
        'function lab() {',
        '  return { resolve: resolve, tcon: tcon, tvar: tvar, showType: showType, match: match };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a nested type builds a nested dictionary',
          assert: function (lab, api) {
            const parts = lab();
            const T = parts.tcon;
            const V = parts.tvar;
            const instances = [
              { className: 'Eq', head: T('Int'), context: [] },
              { className: 'Eq', head: T('List', [V('a')]),
                context: [{ className: 'Eq', type: V('a') }] }
            ];
            const one = parts.resolve({ className: 'Eq', type: T('Int') }, instances, false);
            const deep = parts.resolve({ className: 'Eq',
              type: T('List', [T('List', [T('Int')])]) }, instances, false);

            api.assert.equal(one.dictionary, 'dEqInt', 'a ground instance is a constant');
            api.assert.equal(deep.dictionary, 'dEqLista(dEqLista(dEqInt))',
              'and an instance with a context is a function from dictionaries to dictionaries');
            api.assert.equal(deep.count, 3, 'three dictionaries');
            api.assert.equal(deep.depth, 3, 'three levels deep');
          }
        },
        {
          name: 'matching is one-way: an unrelated goal must not match',
          assert: function (lab, api) {
            const parts = lab();
            const T = parts.tcon;
            const V = parts.tvar;
            const instances = [
              { className: 'Eq', head: T('List', [V('a')]),
                context: [{ className: 'Eq', type: V('a') }] }
            ];
            const out = parts.resolve({ className: 'Eq',
              type: T('Pair', [T('Int'), T('Int')]) }, instances, false);

            api.assert.ok(!out.ok,
              'the Eq (List a) instance must not match a goal about Pair: the constructor ' +
                'names differ');
            api.assert.ok(out.why.indexOf('no instance') !== -1,
              'and the message says no instance rather than reporting overlap');
          }
        },
        {
          name: 'a repeated head variable must bind consistently',
          assert: function (lab, api) {
            const parts = lab();
            const T = parts.tcon;
            const V = parts.tvar;

            api.assert.ok(parts.match(T('Pair', [V('a'), V('a')]),
              T('Pair', [T('Int'), T('Int')]), {}) !== null,
              'Pair a a matches Pair Int Int');
            api.assert.ok(parts.match(T('Pair', [V('a'), V('a')]),
              T('Pair', [T('Int'), T('Bool')]), {}) === null,
              'and does not match Pair Int Bool, because a would have to be both');
          }
        },
        {
          name: 'overlap is refused, and allowing it changes the dictionary',
          assert: function (lab, api) {
            const parts = lab();
            const T = parts.tcon;
            const V = parts.tvar;
            const base = [
              { className: 'Show', head: T('Int'), context: [] },
              { className: 'Show', head: T('List', [V('a')]),
                context: [{ className: 'Show', type: V('a') }] }
            ];
            const risky = base.concat([
              { className: 'Show', head: T('List', [T('Int')]), context: [] }
            ]);
            const goal = { className: 'Show', type: T('List', [T('Int')]) };

            api.assert.equal(parts.resolve(goal, base, false).dictionary, 'dShowLista(dShowInt)',
              'with one matching instance the answer is unambiguous');
            const strict = parts.resolve(goal, risky, false);

            api.assert.ok(!strict.ok && strict.overlap,
              'with two matching instances resolution must refuse — choosing silently is what ' +
                'coherence exists to prevent');
            api.assert.equal(parts.resolve(goal, risky, true).dictionary, 'dShowListInt',
              'and allowing overlap picks the more specific one, which is a DIFFERENT ' +
                'dictionary and therefore a different program');
          }
        },
        {
          name: 'an ambiguous goal is refused before any instance is consulted',
          assert: function (lab, api) {
            const parts = lab();
            const instances = [{ className: 'Show', head: parts.tcon('Int'), context: [] }];
            const out = parts.resolve({ className: 'Show', type: parts.tvar('a') },
              instances, false);

            api.assert.ok(!out.ok, 'Show a cannot be resolved');
            api.assert.ok(out.ambiguous,
              'and it is ambiguity rather than a missing instance — no instance could ever ' +
                'help, because there is no type to search for');
          }
        }
      ]
    }],
    'algebraic-data-types-and-pattern-matching': [{
      id: 'exhaustiveness-witness',
      title: 'Check exhaustiveness with a witness, and verify the witness matches nothing',
      prompt: 'A pattern is { w: true } for a wildcard or { name, args }. A signature maps a ' +
        'type name to its constructors, each { name, arity, args } listing its argument types. ' +
        'Write useful(matrix, vector, types) implementing Maranget\'s relation: is there a ' +
        'value matching `vector` that no row of `matrix` matches? Return ' +
        '{ useful, witness } where witness is a pattern vector. In the wildcard case, if the ' +
        'matrix\'s head constructors cover the type you must recurse under EACH of them; if ' +
        'they do not, a missing constructor is the witness. Then write ' +
        'missingCase(matrix, types) returning the witness for an incomplete match, or "" — and ' +
        'matches(pattern, value) so the witness can be checked. The starter skips the ' +
        'cover case, so it reports a complete match over a covered type as incomplete.',
      entry: 'lab',
      starter: [
        'const SIGNATURE = {',
        '  Bool: [{ name: "true", arity: 0, args: [] }, { name: "false", arity: 0, args: [] }],',
        '  Colour: [{ name: "red", arity: 0, args: [] }, { name: "green", arity: 0, args: [] },',
        '    { name: "blue", arity: 0, args: [] }],',
        '  List: [{ name: "nil", arity: 0, args: [] },',
        '    { name: "cons", arity: 2, args: ["Bool", "List"] }]',
        '};',
        '',
        'function wild() { return { w: true }; }',
        'function con(name, args) { return { name: name, args: args || [] }; }',
        '',
        'function fill(n) {',
        '  const out = [];',
        '',
        '  for (let i = 0; i < n; i += 1) out.push(wild());',
        '  return out;',
        '}',
        '',
        'function show(pattern) {',
        '  if (pattern.w) return "_";',
        '  if (pattern.args.length === 0) return pattern.name;',
        '  return pattern.name + "(" + pattern.args.map(show).join(", ") + ")";',
        '}',
        '',
        'function showRow(row) { return row.map(show).join(" , "); }',
        '',
        'function entryFor(typeName, name) {',
        '  return (SIGNATURE[typeName] || []).filter(function (e) { return e.name === name; })[0];',
        '}',
        '',
        'function specialise(matrix, name, arity) {',
        '  const rows = [];',
        '',
        '  matrix.forEach(function (row) {',
        '    if (row[0].w) { rows.push(fill(arity).concat(row.slice(1))); return; }',
        '    if (row[0].name !== name) return;',
        '    rows.push(row[0].args.concat(row.slice(1)));',
        '  });',
        '  return rows;',
        '}',
        '',
        'function defaults(matrix) {',
        '  return matrix.filter(function (row) { return row[0].w; })',
        '    .map(function (row) { return row.slice(1); });',
        '}',
        '',
        'function heads(matrix) {',
        '  const names = [];',
        '',
        '  matrix.forEach(function (row) {',
        '    if (row[0].w) return;',
        '    if (names.indexOf(row[0].name) === -1) names.push(row[0].name);',
        '  });',
        '  return names;',
        '}',
        '',
        'function argTypes(types, name) {',
        '  const entry = entryFor(types[0], name);',
        '',
        '  return (entry ? entry.args : []).concat(types.slice(1));',
        '}',
        '',
        'function useful(matrix, vector, types) {',
        '  if (vector.length === 0) {',
        '    return matrix.length === 0 ? { useful: true, witness: [] } : { useful: false };',
        '  }',
        '  if (!vector[0].w) {',
        '    const entry = entryFor(types[0], vector[0].name) || { arity: 0 };',
        '    const inner = useful(specialise(matrix, vector[0].name, entry.arity),',
        '      vector[0].args.concat(vector.slice(1)), argTypes(types, vector[0].name));',
        '',
        '    if (!inner.useful) return { useful: false };',
        '    return { useful: true,',
        '      witness: [con(vector[0].name, inner.witness.slice(0, entry.arity))]',
        '        .concat(inner.witness.slice(entry.arity)) };',
        '  }',
        '  const present = heads(matrix);',
        '  const all = SIGNATURE[types[0]] || [];',
        '  const missing = all.filter(function (e) { return present.indexOf(e.name) === -1; });',
        '  // The cover case is skipped: when nothing is missing this still uses the default.',
        '  const inner = useful(defaults(matrix), vector.slice(1), types.slice(1));',
        '',
        '  if (!inner.useful) return { useful: false };',
        '  const head = missing.length > 0 ? con(missing[0].name, fill(missing[0].arity)) : wild();',
        '',
        '  return { useful: true, witness: [head].concat(inner.witness) };',
        '}',
        '',
        'function missingCase(matrix, types) {',
        '  const out = useful(matrix, fill(types.length), types);',
        '',
        '  return out.useful ? showRow(out.witness) : "";',
        '}',
        '',
        'function matches(pattern, value) {',
        '  if (pattern.w) return true;',
        '  if (pattern.name !== value.name) return false;',
        '  return pattern.args.every(function (p, i) { return matches(p, value.args[i]); });',
        '}',
        '',
        'function lab() {',
        '  return { useful: useful, missingCase: missingCase, matches: matches,',
        '    wild: wild, con: con, showRow: showRow };',
        '}'
      ].join('\n'),
      solution: [
        'const SIGNATURE = {',
        '  Bool: [{ name: "true", arity: 0, args: [] }, { name: "false", arity: 0, args: [] }],',
        '  Colour: [{ name: "red", arity: 0, args: [] }, { name: "green", arity: 0, args: [] },',
        '    { name: "blue", arity: 0, args: [] }],',
        '  List: [{ name: "nil", arity: 0, args: [] },',
        '    { name: "cons", arity: 2, args: ["Bool", "List"] }]',
        '};',
        '',
        'function wild() { return { w: true }; }',
        'function con(name, args) { return { name: name, args: args || [] }; }',
        '',
        'function fill(n) {',
        '  const out = [];',
        '',
        '  for (let i = 0; i < n; i += 1) out.push(wild());',
        '  return out;',
        '}',
        '',
        'function show(pattern) {',
        '  if (pattern.w) return "_";',
        '  if (pattern.args.length === 0) return pattern.name;',
        '  return pattern.name + "(" + pattern.args.map(show).join(", ") + ")";',
        '}',
        '',
        'function showRow(row) { return row.map(show).join(" , "); }',
        '',
        'function entryFor(typeName, name) {',
        '  return (SIGNATURE[typeName] || []).filter(function (e) { return e.name === name; })[0];',
        '}',
        '',
        'function specialise(matrix, name, arity) {',
        '  const rows = [];',
        '',
        '  matrix.forEach(function (row) {',
        '    if (row[0].w) { rows.push(fill(arity).concat(row.slice(1))); return; }',
        '    if (row[0].name !== name) return;',
        '    rows.push(row[0].args.concat(row.slice(1)));',
        '  });',
        '  return rows;',
        '}',
        '',
        'function defaults(matrix) {',
        '  return matrix.filter(function (row) { return row[0].w; })',
        '    .map(function (row) { return row.slice(1); });',
        '}',
        '',
        'function heads(matrix) {',
        '  const names = [];',
        '',
        '  matrix.forEach(function (row) {',
        '    if (row[0].w) return;',
        '    if (names.indexOf(row[0].name) === -1) names.push(row[0].name);',
        '  });',
        '  return names;',
        '}',
        '',
        'function argTypes(types, name) {',
        '  const entry = entryFor(types[0], name);',
        '',
        '  return (entry ? entry.args : []).concat(types.slice(1));',
        '}',
        '',
        'function useful(matrix, vector, types) {',
        '  if (vector.length === 0) {',
        '    return matrix.length === 0 ? { useful: true, witness: [] } : { useful: false };',
        '  }',
        '  if (!vector[0].w) {',
        '    const entry = entryFor(types[0], vector[0].name) || { arity: 0 };',
        '    const inner = useful(specialise(matrix, vector[0].name, entry.arity),',
        '      vector[0].args.concat(vector.slice(1)), argTypes(types, vector[0].name));',
        '',
        '    if (!inner.useful) return { useful: false };',
        '    return { useful: true,',
        '      witness: [con(vector[0].name, inner.witness.slice(0, entry.arity))]',
        '        .concat(inner.witness.slice(entry.arity)) };',
        '  }',
        '  const present = heads(matrix);',
        '  const all = SIGNATURE[types[0]] || [];',
        '  const missing = all.filter(function (e) { return present.indexOf(e.name) === -1; });',
        '',
        '  if (all.length > 0 && missing.length === 0) {',
        '    for (let i = 0; i < all.length; i += 1) {',
        '      const probe = con(all[i].name, fill(all[i].arity));',
        '      const under = useful(matrix, [probe].concat(vector.slice(1)), types);',
        '',
        '      if (under.useful) return under;',
        '    }',
        '    return { useful: false };',
        '  }',
        '  const inner = useful(defaults(matrix), vector.slice(1), types.slice(1));',
        '',
        '  if (!inner.useful) return { useful: false };',
        '  const head = missing.length > 0 ? con(missing[0].name, fill(missing[0].arity)) : wild();',
        '',
        '  return { useful: true, witness: [head].concat(inner.witness) };',
        '}',
        '',
        'function missingCase(matrix, types) {',
        '  const out = useful(matrix, fill(types.length), types);',
        '',
        '  return out.useful ? showRow(out.witness) : "";',
        '}',
        '',
        'function matches(pattern, value) {',
        '  if (pattern.w) return true;',
        '  if (pattern.name !== value.name) return false;',
        '  return pattern.args.every(function (p, i) { return matches(p, value.args[i]); });',
        '}',
        '',
        'function lab() {',
        '  return { useful: useful, missingCase: missingCase, matches: matches,',
        '    wild: wild, con: con, showRow: showRow };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a complete match over a covered type reports nothing missing',
          assert: function (lab, api) {
            const parts = lab();
            const w = parts.wild;
            const c = parts.con;

            api.assert.equal(parts.missingCase([[c('nil')], [c('cons', [w(), w()])]], ['List']),
              '', 'nil and cons cover List completely');
            api.assert.equal(parts.missingCase(
              [[c('red')], [c('green')], [c('blue')]], ['Colour']), '',
              'all three colours are covered');
            api.assert.equal(parts.missingCase(
              [[c('true'), c('true')], [c('true'), c('false')], [c('false'), w()]],
              ['Bool', 'Bool']), '',
              'this two-column match is complete — a checker that skips the cover case ' +
                'reports it as incomplete, which is a false alarm and the worst kind');
          }
        },
        {
          name: 'an incomplete match names a concrete value',
          assert: function (lab, api) {
            const parts = lab();
            const w = parts.wild;
            const c = parts.con;

            api.assert.equal(parts.missingCase([[c('red')], [c('green')]], ['Colour']), 'blue',
              'the missing constructor is the witness');
            api.assert.equal(parts.missingCase(
              [[c('nil')], [c('cons', [c('true'), w()])]], ['List']), 'cons(false, nil)',
              'the element pattern is too narrow, and the witness says exactly how');
          }
        },
        {
          name: 'the witness really does match no clause',
          assert: function (lab, api) {
            const parts = lab();
            const w = parts.wild;
            const c = parts.con;
            const matrix = [[c('nil')], [c('cons', [c('true'), w()])]];
            const out = parts.useful(matrix, [w()], ['List']);

            api.assert.ok(out.useful, 'the match is incomplete');
            const value = out.witness[0];

            matrix.forEach(function (row) {
              api.assert.ok(!parts.matches(row[0], value),
                'the witness ' + parts.showRow(out.witness) + ' must match no clause — a ' +
                  'plausible-looking witness that is actually matched is worse than none');
            });
          }
        },
        {
          name: 'redundancy is the same question against the rows above',
          assert: function (lab, api) {
            const parts = lab();
            const w = parts.wild;
            const c = parts.con;
            const matrix = [[c('red')], [w()], [c('blue')]];

            api.assert.ok(parts.useful([], [c('red')], ['Colour']).useful,
              'the first clause is reachable against an empty matrix');
            api.assert.ok(parts.useful([[c('red')]], [w()], ['Colour']).useful,
              'the wildcard is reachable, because green and blue reach it');
            api.assert.ok(!parts.useful(matrix.slice(0, 2), [c('blue')], ['Colour']).useful,
              'and the third clause is not: the wildcard above already caught blue');
          }
        },
        {
          name: 'nesting is handled, not just the top level',
          assert: function (lab, api) {
            const parts = lab();
            const w = parts.wild;
            const c = parts.con;

            const matrix = [[c('nil')], [c('cons', [w(), c('nil')])]];
            const out = parts.useful(matrix, [w()], ['List']);

            api.assert.ok(out.useful, 'a list of two or more is unmatched');
            api.assert.ok(parts.showRow(out.witness).indexOf('cons(') === 0,
              'and the witness is a cons cell, built two levels deep: got ' +
                parts.showRow(out.witness));
            matrix.forEach(function (row) {
              api.assert.ok(!parts.matches(row[0], out.witness[0]),
                'the nested witness must match no clause either');
            });
            api.assert.equal(parts.missingCase([[c('nil')],
              [c('cons', [w(), c('nil')])], [c('cons', [w(), c('cons', [w(), w()])])]],
            ['List']), '', 'and adding the case that covers it completes the match');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
