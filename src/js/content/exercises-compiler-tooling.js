/**
 * Graded exercises for desugaring, diagnostics and testing (M28.7-M28.9).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 * Each exercise exposes its functions through a single `lab()` entry.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'desugaring-to-a-core': [{
      id: 'lower-for-loop',
      title: 'Lower a for loop so that break and continue still mean what they meant',
      prompt: 'A surface loop is { kind: "for", name, items, body } where body is a list of ' +
        '{ kind: "add", value } (add a number to the accumulator), { kind: "addVar" } (add the ' +
        'loop variable), { kind: "continueIf", value } and { kind: "breakIf", value }. Write ' +
        'lower(loop, gensym) returning a list of core statements built from ' +
        '{ kind: "let", name, value }, { kind: "index", name, source, at }, ' +
        '{ kind: "incr", name }, { kind: "while", test: { left, op, right }, body } and the ' +
        'body forms above. `gensym(hint)` returns a fresh name. Every generated name must come ' +
        'from gensym. The tests run your core with a tiny interpreter and compare against the ' +
        'surface loop, so a lowering that changes the answer fails whatever it looks like. The ' +
        'starter puts the increment at the END of the body, which is how the loop reads and ' +
        'which continue jumps straight over.',
      entry: 'lab',
      opsLimit: 4000000,
      starter: [
        'function lower(loop, gensym) {',
        '  const source = gensym("xs");',
        '  const index = gensym("i");',
        '',
        '  return [',
        '    { kind: "let", name: source, value: loop.items },',
        '    { kind: "let", name: index, value: 0 },',
        '    { kind: "while",',
        '      test: { left: index, op: "<", right: { length: source } },',
        '      body: [{ kind: "index", name: loop.name, source: source, at: index }]',
        '        .concat(loop.body)',
        '        // The increment last: it reads well and continue skips it.',
        '        .concat([{ kind: "incr", name: index }]) }',
        '  ];',
        '}',
        '',
        'function lab() { return { lower: lower }; }'
      ].join('\n'),
      solution: [
        'function lower(loop, gensym) {',
        '  const source = gensym("xs");',
        '  const index = gensym("i");',
        '',
        '  return [',
        '    { kind: "let", name: source, value: loop.items },',
        '    { kind: "let", name: index, value: 0 },',
        '    { kind: "while",',
        '      test: { left: index, op: "<", right: { length: source } },',
        '      // Bind the element, THEN advance, then run the body. The element has',
        '      // already been read so moving the index cannot affect this iteration,',
        '      // continue cannot skip an increment that has already happened, and the',
        '      // test still sees the index it is about to use. No flag is needed,',
        '      // which is the usual sign the placement is right.',
        '      body: [',
        '        { kind: "index", name: loop.name, source: source, at: index },',
        '        { kind: "incr", name: index }',
        '      ].concat(loop.body) }',
        '  ];',
        '}',
        '',
        'function lab() { return { lower: lower }; }'
      ].join('\n'),
      tests: [
        {
          name: 'a plain loop sums its elements and stops at the end of the array',
          assert: function (lab, api) {
            const parts = lab();
            /* The interpreter is defined here so the test closes over nothing.
               `budget` separates "did not finish" from "crashed", which is the
               distinction a non-terminating lowering needs. */
            const run = function (core, items) {
              const env = {};
              const state = { total: 0, steps: 0, stopped: false, budget: 5000 };
              /* A string has .length too, so the object check has to come
                 first, or every name is read as a length request. */
              const value = function (v) {
                if (v && typeof v === 'object') return env[v.length].length;
                return typeof v === 'string' ? env[v] : v;
              };
              const exec = function (list) {
                for (let i = 0; i < list.length; i += 1) {
                  const s = list[i];

                  state.steps += 1;
                  if (state.steps > state.budget) throw new Error('budget');
                  if (s.kind === 'let') env[s.name] = s.value;
                  else if (s.kind === 'index') {
                    if (env[s.source][env[s.at]] === undefined) throw new Error('out of range');
                    env[s.name] = env[s.source][env[s.at]];
                  } else if (s.kind === 'incr') env[s.name] += 1;
                  else if (s.kind === 'add') state.total += s.value;
                  else if (s.kind === 'addVar') state.total += env[loopName];
                  else if (s.kind === 'continueIf') { if (env[loopName] === s.value) return 'continue'; }
                  else if (s.kind === 'breakIf') { if (env[loopName] === s.value) return 'break'; }
                  else if (s.kind === 'while') {
                    while (value(s.test.left) < value(s.test.right)) {
                      state.steps += 1;
                      if (state.steps > state.budget) throw new Error('budget');
                      const signal = exec(s.body);

                      if (signal === 'break') break;
                    }
                  }
                }
                return 'done';
              };
              let loopName = 'v';

              exec(core);
              return state.total;
            };
            let counter = 0;
            const gensym = function (hint) { counter += 1; return '$' + hint + counter; };
            const core = parts.lower({ kind: 'for', name: 'v', items: [1, 2, 3],
              body: [{ kind: 'addVar' }] }, gensym);

            api.assert.equal(run(core, [1, 2, 3]), 6,
              'one, two and three sum to six — a lowering that tests the guard against a stale ' +
                'index reads one element past the end instead');
          }
        },
        {
          name: 'continue skips the rest of the body and the loop still terminates',
          assert: function (lab, api) {
            const parts = lab();
            const run = function (core, loopName) {
              const env = {};
              const state = { total: 0, steps: 0, budget: 5000 };
              /* A string has .length too, so the object check has to come
                 first, or every name is read as a length request. */
              const value = function (v) {
                if (v && typeof v === 'object') return env[v.length].length;
                return typeof v === 'string' ? env[v] : v;
              };
              const exec = function (list) {
                for (let i = 0; i < list.length; i += 1) {
                  const s = list[i];

                  state.steps += 1;
                  if (state.steps > state.budget) throw new Error('budget exhausted');
                  if (s.kind === 'let') env[s.name] = s.value;
                  else if (s.kind === 'index') {
                    if (env[s.source][env[s.at]] === undefined) throw new Error('out of range');
                    env[s.name] = env[s.source][env[s.at]];
                  } else if (s.kind === 'incr') env[s.name] += 1;
                  else if (s.kind === 'add') state.total += s.value;
                  else if (s.kind === 'addVar') state.total += env[loopName];
                  else if (s.kind === 'continueIf') { if (env[loopName] === s.value) return 'continue'; }
                  else if (s.kind === 'breakIf') { if (env[loopName] === s.value) return 'break'; }
                  else if (s.kind === 'while') {
                    while (value(s.test.left) < value(s.test.right)) {
                      state.steps += 1;
                      if (state.steps > state.budget) throw new Error('budget exhausted');
                      if (exec(s.body) === 'break') break;
                    }
                  }
                }
                return 'done';
              };

              exec(core);
              return state.total;
            };
            let counter = 0;
            const gensym = function (hint) { counter += 1; return '$' + hint + counter; };
            const core = parts.lower({ kind: 'for', name: 'v', items: [1, 2, 3, 4],
              body: [{ kind: 'continueIf', value: 2 }, { kind: 'addVar' }] }, gensym);

            api.assert.equal(run(core, 'v'), 8,
              'one plus three plus four is eight — with the increment last, continue jumps over ' +
                'it and the loop never terminates');
          }
        },
        {
          name: 'break leaves the loop immediately',
          assert: function (lab, api) {
            const parts = lab();
            const run = function (core, loopName) {
              const env = {};
              const state = { total: 0, steps: 0, budget: 5000 };
              /* A string has .length too, so the object check has to come
                 first, or every name is read as a length request. */
              const value = function (v) {
                if (v && typeof v === 'object') return env[v.length].length;
                return typeof v === 'string' ? env[v] : v;
              };
              const exec = function (list) {
                for (let i = 0; i < list.length; i += 1) {
                  const s = list[i];

                  state.steps += 1;
                  if (state.steps > state.budget) throw new Error('budget exhausted');
                  if (s.kind === 'let') env[s.name] = s.value;
                  else if (s.kind === 'index') {
                    if (env[s.source][env[s.at]] === undefined) throw new Error('out of range');
                    env[s.name] = env[s.source][env[s.at]];
                  } else if (s.kind === 'incr') env[s.name] += 1;
                  else if (s.kind === 'addVar') state.total += env[loopName];
                  else if (s.kind === 'breakIf') { if (env[loopName] === s.value) return 'break'; }
                  else if (s.kind === 'while') {
                    while (value(s.test.left) < value(s.test.right)) {
                      state.steps += 1;
                      if (state.steps > state.budget) throw new Error('budget exhausted');
                      if (exec(s.body) === 'break') break;
                    }
                  }
                }
                return 'done';
              };

              exec(core);
              return state.total;
            };
            let counter = 0;
            const gensym = function (hint) { counter += 1; return '$' + hint + counter; };
            const core = parts.lower({ kind: 'for', name: 'v', items: [1, 2, 3, 4],
              body: [{ kind: 'breakIf', value: 3 }, { kind: 'addVar' }] }, gensym);

            api.assert.equal(run(core, 'v'), 3, 'one plus two, and then it stops');
          }
        },
        {
          name: 'an empty array runs the body zero times',
          assert: function (lab, api) {
            const parts = lab();
            let counter = 0;
            const gensym = function (hint) { counter += 1; return '$' + hint + counter; };
            const core = parts.lower({ kind: 'for', name: 'v', items: [],
              body: [{ kind: 'addVar' }] }, gensym);
            const env = {};
            let total = 0;
            let entered = 0;

            core.forEach(function (s) {
              if (s.kind === 'let') env[s.name] = s.value;
              if (s.kind !== 'while') return;
              while (env[s.test.left] < env[s.test.right.length].length) {
                entered += 1;
                if (entered > 100) break;
              }
            });
            api.assert.equal(entered, 0,
              'the guard is false before the first pass, so nothing is indexed — a lowering ' +
                'that binds the element before testing would read index 0 of an empty array');
            api.assert.equal(total, 0, 'and the accumulator is untouched');
          }
        },
        {
          name: 'every introduced name comes from gensym',
          assert: function (lab, api) {
            const parts = lab();
            const issued = [];
            const gensym = function (hint) {
              const name = '$' + hint + issued.length;

              issued.push(name);
              return name;
            };
            const core = parts.lower({ kind: 'for', name: 'v', items: [1, 2],
              body: [{ kind: 'addVar' }] }, gensym);
            const declared = core.filter(function (s) { return s.kind === 'let'; })
              .map(function (s) { return s.name; });

            api.assert.atLeast(issued.length, 2, 'at least a source and an index');
            declared.forEach(function (name) {
              api.assert.ok(issued.indexOf(name) !== -1,
                name + ' must come from gensym — a hard-coded name is one a user program can ' +
                  'also bind, and then the lowering captures it');
            });
          }
        }
      ]
    }],

    'diagnostics-as-a-product': [{
      id: 'suppress-cascade',
      title: 'Report the cause, and keep what you dropped',
      prompt: 'A diagnostic is { code, stage, span: { start, end }, message }. Stages rank ' +
        'lex, parse, resolve, typecheck in that order. Write suppress(list, options) returning ' +
        '{ kept, dropped, counts } where kept is in source order (by span start, then span end, ' +
        'then stage rank) and every dropped entry carries droppedBy. Apply three rules in this ' +
        'order: "stage" drops anything from a stage later than the EARLIEST stage that reported ' +
        'anything; "duplicate" drops the same code at the same span as something already kept; ' +
        '"contained" drops a diagnostic from the same stage whose span sits inside a kept one. ' +
        'counts has a total per rule. options.gate, options.contain and options.dedupe each ' +
        'default to on and switch a rule off when false. The starter reports everything, which ' +
        'is what a compiler does before anyone measures the cascade.',
      entry: 'lab',
      starter: [
        'const ORDER = ["lex", "parse", "resolve", "typecheck"];',
        '',
        'function rank(entry) { return ORDER.indexOf(entry.stage); }',
        '',
        'function sorted(list) {',
        '  return list.slice().sort(function (a, b) {',
        '    if (a.span.start !== b.span.start) return a.span.start - b.span.start;',
        '    if (a.span.end !== b.span.end) return a.span.end - b.span.end;',
        '    return rank(a) - rank(b);',
        '  });',
        '}',
        '',
        'function suppress(list, options) {',
        '  // Everything is true, so everything is reported.',
        '  return { kept: sorted(list), dropped: [],',
        '    counts: { stage: 0, duplicate: 0, contained: 0 } };',
        '}',
        '',
        'function lab() { return { suppress: suppress, sorted: sorted, ORDER: ORDER }; }'
      ].join('\n'),
      solution: [
        'const ORDER = ["lex", "parse", "resolve", "typecheck"];',
        '',
        'function rank(entry) { return ORDER.indexOf(entry.stage); }',
        '',
        'function sorted(list) {',
        '  return list.slice().sort(function (a, b) {',
        '    if (a.span.start !== b.span.start) return a.span.start - b.span.start;',
        '    if (a.span.end !== b.span.end) return a.span.end - b.span.end;',
        '    return rank(a) - rank(b);',
        '  });',
        '}',
        '',
        'function earliest(list) {',
        '  return list.reduce(function (best, entry) {',
        '    return rank(entry) < best ? rank(entry) : best;',
        '  }, ORDER.length);',
        '}',
        '',
        'function sameSpan(a, b) { return a.start === b.start && a.end === b.end; }',
        '',
        'function contains(outer, inner) {',
        '  return outer.start <= inner.start && outer.end >= inner.end;',
        '}',
        '',
        'function ruleAgainst(entry, kept, gate, settings) {',
        '  if (rank(entry) > gate) return "stage";',
        '  if (settings.dedupe !== false && kept.some(function (other) {',
        '    return other.code === entry.code && sameSpan(other.span, entry.span);',
        '  })) return "duplicate";',
        '  if (settings.contain !== false && kept.some(function (other) {',
        '    return other.stage === entry.stage && contains(other.span, entry.span);',
        '  })) return "contained";',
        '  return "";',
        '}',
        '',
        'function suppress(list, options) {',
        '  const settings = options || {};',
        '  // With gating off the gate is the LAST stage, so nothing is dropped by it.',
        '  const gate = settings.gate === false ? ORDER.length - 1 : earliest(list);',
        '  const kept = [];',
        '  const dropped = [];',
        '  const counts = { stage: 0, duplicate: 0, contained: 0 };',
        '',
        '  sorted(list).forEach(function (entry) {',
        '    const rule = ruleAgainst(entry, kept, gate, settings);',
        '',
        '    if (!rule) { kept.push(entry); return; }',
        '    counts[rule] += 1;',
        '    // Keep what was dropped, and why. Suppression you cannot inspect is',
        '    // indistinguishable from a compiler that failed to notice.',
        '    dropped.push(Object.assign({ droppedBy: rule }, entry));',
        '  });',
        '  return { kept: kept, dropped: dropped, counts: counts };',
        '}',
        '',
        'function lab() { return { suppress: suppress, sorted: sorted, ORDER: ORDER }; }'
      ].join('\n'),
      tests: [
        {
          name: 'one mistake in an early stage silences its consequences downstream',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.suppress([
              { code: 'E-LEX-STRING', stage: 'lex', span: { start: 8, end: 14 }, message: 'a' },
              { code: 'E-PARSE-EXPR', stage: 'parse', span: { start: 8, end: 14 }, message: 'b' },
              { code: 'E-PARSE-EXPECTED', stage: 'parse', span: { start: 14, end: 14 }, message: 'c' }
            ], {});

            api.assert.equal(out.kept.length, 1,
              'one mistake, one message — the other two are true and are consequences');
            api.assert.equal(out.kept[0].code, 'E-LEX-STRING', 'and the cause is the one kept');
            api.assert.equal(out.counts.stage, 2, 'both drops are stage gating');
            api.assert.equal(out.dropped.length, 2, 'and both are kept for inspection');
            api.assert.equal(out.dropped[0].droppedBy, 'stage', 'with the rule recorded');
          }
        },
        {
          name: 'turning gating off reports everything again',
          assert: function (lab, api) {
            const parts = lab();
            const list = [
              { code: 'E-LEX-STRING', stage: 'lex', span: { start: 8, end: 14 }, message: 'a' },
              { code: 'E-RESOLVE-UNBOUND', stage: 'resolve', span: { start: 30, end: 34 }, message: 'b' },
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 50, end: 54 }, message: 'c' }
            ];

            api.assert.equal(parts.suppress(list, {}).kept.length, 1, 'gated, one message');
            api.assert.equal(parts.suppress(list, { gate: false }).kept.length, 3,
              'ungated, all three — which is what the demo\'s checkbox is for, and the only ' +
                'way to see what a rule is worth');
            api.assert.equal(parts.suppress(list, { gate: false }).counts.stage, 0,
              'and nothing is charged to the stage rule');
          }
        },
        {
          name: 'the same code at the same span is reported once',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.suppress([
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 4, end: 8 }, message: 'a' },
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 4, end: 8 }, message: 'a' },
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 9, end: 12 }, message: 'b' }
            ], {});

            api.assert.equal(out.kept.length, 2, 'two distinct positions');
            api.assert.equal(out.counts.duplicate, 1, 'and one duplicate');
            const twice = [
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 4, end: 8 }, message: 'a' },
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 4, end: 8 }, message: 'a' }
            ];

            api.assert.equal(parts.suppress(twice, { dedupe: false }).kept.length, 1,
              'with deduplication off, containment still catches it — a span contains itself, ' +
                'so the two rules overlap on exactly this case');
            api.assert.equal(parts.suppress(twice, { dedupe: false, contain: false }).kept.length, 2,
              'and it takes turning BOTH off to see the duplicate reported twice');
          }
        },
        {
          name: 'a diagnostic inside another from the same stage is the same mistake seen closer',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.suppress([
              { code: 'E-TYPE-BRANCHES', stage: 'typecheck', span: { start: 4, end: 40 }, message: 'a' },
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 10, end: 14 }, message: 'b' },
              { code: 'E-TYPE-MISMATCH', stage: 'typecheck', span: { start: 50, end: 54 }, message: 'c' }
            ], {});

            api.assert.equal(out.kept.length, 2, 'the contained one goes');
            api.assert.equal(out.counts.contained, 1, 'charged to containment');
            api.assert.equal(out.kept[1].span.start, 50, 'and the one outside is kept');
          }
        },
        {
          name: 'the kept list is in source order, so the reader reads down the file',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.suppress([
              { code: 'C', stage: 'typecheck', span: { start: 90, end: 94 }, message: 'c' },
              { code: 'A', stage: 'typecheck', span: { start: 10, end: 14 }, message: 'a' },
              { code: 'B', stage: 'typecheck', span: { start: 50, end: 54 }, message: 'b' }
            ], {});

            api.assert.deepEqual(out.kept.map(function (e) { return e.code; }), ['A', 'B', 'C'],
              'source order, not the order the stages happened to produce them in');
          }
        }
      ]
    }],

    'testing-a-front-end': [{
      id: 'generator-and-property',
      title: 'Generate programs from a grammar, and prove the property has teeth',
      prompt: 'Write generate(seed, depth) returning an expression tree from a seeded generator ' +
        'you write yourself, so the same seed always gives the same tree however many times it ' +
        'has been called before. Nodes are { kind: "num", value } and { kind: "binary", op, left, ' +
        'right } over the operators plus, minus and times. Write roundTrip(tree, printer) which ' +
        'prints the tree, evaluates BOTH the tree and the printed text (a simple left-to-right ' +
        'evaluator honouring precedence), and returns { ok, printed, fromTree, fromText }. Then ' +
        'write sabotage(count, printer) running roundTrip over count generated trees and ' +
        'returning { checked, failures }. The starter\'s sabotage always uses the good printer, ' +
        'so it reports zero failures whatever printer it is handed — which is a property that ' +
        'cannot tell you anything.',
      entry: 'lab',
      seed: 7,
      starter: [
        'const OPS = ["+", "-", "*"];',
        'const POWER = { "+": 1, "-": 1, "*": 2 };',
        '',
        'function makeRng(seed) {',
        '  let state = (seed >>> 0) || 1;',
        '',
        '  // Its own generator, seeded from the argument, so the same seed always',
        '  // gives the same tree however many times it has been called before.',
        '  return function () {',
        '    state = (state + 0x6D2B79F5) | 0;',
        '    let t = Math.imul(state ^ (state >>> 15), 1 | state);',
        '',
        '    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;',
        '    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;',
        '  };',
        '}',
        '',
        'function grow(next, depth) {',
        '  if (depth <= 0 || next() < 0.35) {',
        '    return { kind: "num", value: 1 + Math.floor(next() * 9) };',
        '  }',
        '  const op = OPS[Math.floor(next() * OPS.length)];',
        '',
        '  return { kind: "binary", op: op,',
        '    left: grow(next, depth - 1), right: grow(next, depth - 1) };',
        '}',
        '',
        'function generate(seed, depth) { return grow(makeRng(seed), depth); }',
        '',
        'function goodPrinter(tree, required) {',
        '  if (tree.kind === "num") return String(tree.value);',
        '  const power = POWER[tree.op];',
        '  const text = goodPrinter(tree.left, power) + " " + tree.op + " "',
        '    + goodPrinter(tree.right, power + 1);',
        '',
        '  return power < required ? "(" + text + ")" : text;',
        '}',
        '',
        'function brokenPrinter(tree, required) {',
        '  if (tree.kind === "num") return String(tree.value);',
        '  const power = POWER[tree.op];',
        '  // No power required of the right operand.',
        '  const text = brokenPrinter(tree.left, power) + " " + tree.op + " "',
        '    + brokenPrinter(tree.right, 0);',
        '',
        '  return power < required ? "(" + text + ")" : text;',
        '}',
        '',
        'function evalTree(tree) {',
        '  if (tree.kind === "num") return tree.value;',
        '  const l = evalTree(tree.left);',
        '  const r = evalTree(tree.right);',
        '',
        '  if (tree.op === "+") return l + r;',
        '  if (tree.op === "-") return l - r;',
        '  return l * r;',
        '}',
        '',
        'function evalText(text) {',
        '  const tokens = text.replace(/\\(/g, " ( ").replace(/\\)/g, " ) ").split(/\\s+/)',
        '    .filter(function (t) { return t.length; });',
        '  const state = { at: 0, tokens: tokens };',
        '',
        '  return parseExpr(state, 1);',
        '}',
        '',
        'function parseExpr(state, minimum) {',
        '  let left = parseAtom(state);',
        '',
        '  while (state.at < state.tokens.length) {',
        '    const op = state.tokens[state.at];',
        '',
        '    if (POWER[op] === undefined || POWER[op] < minimum) break;',
        '    state.at += 1;',
        '    const right = parseExpr(state, POWER[op] + 1);',
        '',
        '    left = op === "+" ? left + right : (op === "-" ? left - right : left * right);',
        '  }',
        '  return left;',
        '}',
        '',
        'function parseAtom(state) {',
        '  const token = state.tokens[state.at];',
        '',
        '  state.at += 1;',
        '  if (token === "(") {',
        '    const value = parseExpr(state, 1);',
        '',
        '    state.at += 1;',
        '    return value;',
        '  }',
        '  return Number(token);',
        '}',
        '',
        'function roundTrip(tree, printer) {',
        '  const printed = (printer || goodPrinter)(tree, 0);',
        '  const fromTree = evalTree(tree);',
        '  const fromText = evalText(printed);',
        '',
        '  return { ok: fromTree === fromText, printed: printed,',
        '    fromTree: fromTree, fromText: fromText };',
        '}',
        '',
        'function sabotage(count, printer) {',
        '  let failures = 0;',
        '',
        '  for (let i = 0; i < count; i += 1) {',
        '    // The printer argument is ignored, so this can only ever report zero.',
        '    if (!roundTrip(generate(i, 3), goodPrinter).ok) failures += 1;',
        '  }',
        '  return { checked: count, failures: failures };',
        '}',
        '',
        'function lab() {',
        '  return { generate: generate, roundTrip: roundTrip, sabotage: sabotage,',
        '    goodPrinter: goodPrinter, brokenPrinter: brokenPrinter, evalTree: evalTree,',
        '    makeRng: makeRng };',
        '}'
      ].join('\n'),
      solution: [
        'const OPS = ["+", "-", "*"];',
        'const POWER = { "+": 1, "-": 1, "*": 2 };',
        '',
        'function makeRng(seed) {',
        '  let state = (seed >>> 0) || 1;',
        '',
        '  // Its own generator, seeded from the argument, so the same seed always',
        '  // gives the same tree however many times it has been called before.',
        '  return function () {',
        '    state = (state + 0x6D2B79F5) | 0;',
        '    let t = Math.imul(state ^ (state >>> 15), 1 | state);',
        '',
        '    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;',
        '    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;',
        '  };',
        '}',
        '',
        'function grow(next, depth) {',
        '  if (depth <= 0 || next() < 0.35) {',
        '    return { kind: "num", value: 1 + Math.floor(next() * 9) };',
        '  }',
        '  const op = OPS[Math.floor(next() * OPS.length)];',
        '',
        '  return { kind: "binary", op: op,',
        '    left: grow(next, depth - 1), right: grow(next, depth - 1) };',
        '}',
        '',
        'function generate(seed, depth) { return grow(makeRng(seed), depth); }',
        '',
        'function goodPrinter(tree, required) {',
        '  if (tree.kind === "num") return String(tree.value);',
        '  const power = POWER[tree.op];',
        '  const text = goodPrinter(tree.left, power) + " " + tree.op + " "',
        '    + goodPrinter(tree.right, power + 1);',
        '',
        '  return power < required ? "(" + text + ")" : text;',
        '}',
        '',
        'function brokenPrinter(tree, required) {',
        '  if (tree.kind === "num") return String(tree.value);',
        '  const power = POWER[tree.op];',
        '  const text = brokenPrinter(tree.left, power) + " " + tree.op + " "',
        '    + brokenPrinter(tree.right, 0);',
        '',
        '  return power < required ? "(" + text + ")" : text;',
        '}',
        '',
        'function evalTree(tree) {',
        '  if (tree.kind === "num") return tree.value;',
        '  const l = evalTree(tree.left);',
        '  const r = evalTree(tree.right);',
        '',
        '  if (tree.op === "+") return l + r;',
        '  if (tree.op === "-") return l - r;',
        '  return l * r;',
        '}',
        '',
        'function evalText(text) {',
        '  const tokens = text.replace(/\\(/g, " ( ").replace(/\\)/g, " ) ").split(/\\s+/)',
        '    .filter(function (t) { return t.length; });',
        '',
        '  return parseExpr({ at: 0, tokens: tokens }, 1);',
        '}',
        '',
        'function parseExpr(state, minimum) {',
        '  let left = parseAtom(state);',
        '',
        '  while (state.at < state.tokens.length) {',
        '    const op = state.tokens[state.at];',
        '',
        '    if (POWER[op] === undefined || POWER[op] < minimum) break;',
        '    state.at += 1;',
        '    const right = parseExpr(state, POWER[op] + 1);',
        '',
        '    left = op === "+" ? left + right : (op === "-" ? left - right : left * right);',
        '  }',
        '  return left;',
        '}',
        '',
        'function parseAtom(state) {',
        '  const token = state.tokens[state.at];',
        '',
        '  state.at += 1;',
        '  if (token === "(") {',
        '    const value = parseExpr(state, 1);',
        '',
        '    state.at += 1;',
        '    return value;',
        '  }',
        '  return Number(token);',
        '}',
        '',
        'function roundTrip(tree, printer) {',
        '  const printed = (printer || goodPrinter)(tree, 0);',
        '  const fromTree = evalTree(tree);',
        '  const fromText = evalText(printed);',
        '',
        '  return { ok: fromTree === fromText, printed: printed,',
        '    fromTree: fromTree, fromText: fromText };',
        '}',
        '',
        'function sabotage(count, printer) {',
        '  let failures = 0;',
        '',
        '  for (let i = 0; i < count; i += 1) {',
        '    // The printer under test, not the one we trust. Without this the',
        '    // property reports zero whatever it is handed, and zero then means',
        '    // nothing at all.',
        '    if (!roundTrip(generate(i, 3), printer || goodPrinter).ok) failures += 1;',
        '  }',
        '  return { checked: count, failures: failures };',
        '}',
        '',
        'function lab() {',
        '  return { generate: generate, roundTrip: roundTrip, sabotage: sabotage,',
        '    goodPrinter: goodPrinter, brokenPrinter: brokenPrinter, evalTree: evalTree,',
        '    makeRng: makeRng };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the good printer round-trips every generated tree',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.sabotage(300, parts.goodPrinter);

            api.assert.equal(out.checked, 300, 'three hundred generated trees');
            api.assert.equal(out.failures, 0,
              'and none of them changes value under printing — which on its own is equally ' +
                'consistent with a working property and a generator that never produced ' +
                'anything hard');
          }
        },
        {
          name: 'the broken printer is caught, which is what makes the zero mean something',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.sabotage(300, parts.brokenPrinter);

            api.assert.atLeast(out.failures, 1,
              'a printer that requires no power of its right operand MUST fail on some tree — ' +
                'a sabotage run that reports zero is running the wrong printer');
            api.assert.ok(out.failures < out.checked,
              'and it must not fail on all of them, or the sabotage is too coarse to locate ' +
                'anything: most expressions have nothing bracketable on the right');
          }
        },
        {
          name: 'the specific case the broken printer loses',
          assert: function (lab, api) {
            const parts = lab();
            const num = function (v) { return { kind: 'num', value: v }; };
            const tree = { kind: 'binary', op: '-', left: num(1),
              right: { kind: 'binary', op: '-', left: num(2), right: num(3) } };

            api.assert.equal(parts.evalTree(tree), 2, 'one minus (two minus three) is two');
            api.assert.equal(parts.roundTrip(tree, parts.goodPrinter).ok, true,
              'the good printer keeps the brackets');
            const broken = parts.roundTrip(tree, parts.brokenPrinter);

            api.assert.equal(broken.ok, false, 'the broken one drops them');
            api.assert.equal(broken.fromText, -4,
              'and 1 - 2 - 3 is minus four, which is a different program');
          }
        },
        {
          name: 'the same seed gives the same tree, which is what makes a failure reproducible',
          assert: function (lab, api) {
            const parts = lab();
            const show = function (t) {
              return t.kind === 'num' ? String(t.value)
                : '(' + show(t.left) + t.op + show(t.right) + ')';
            };

            api.assert.equal(show(parts.generate(4, 3)), show(parts.generate(4, 3)),
              'seed 4 twice gives the same tree — a generator whose position depends on how ' +
                'many times it has been called turns a bug report into an anecdote');
            api.assert.notEqual(show(parts.generate(4, 3)), show(parts.generate(5, 3)),
              'and a different seed gives a different one, or the corpus is one program');
          }
        },
        {
          name: 'a tree that needs no brackets is unaffected by either printer',
          assert: function (lab, api) {
            const parts = lab();
            const num = function (v) { return { kind: 'num', value: v }; };
            const tree = { kind: 'binary', op: '+', left: num(1),
              right: { kind: 'binary', op: '*', left: num(2), right: num(3) } };

            api.assert.equal(parts.roundTrip(tree, parts.goodPrinter).printed, '1 + 2 * 3',
              'times already binds tighter, so no brackets are needed');
            api.assert.equal(parts.roundTrip(tree, parts.brokenPrinter).ok, true,
              'which is why the broken printer is invisible on most expressions, and why the ' +
                'catch rate is a few per cent rather than most of them');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
