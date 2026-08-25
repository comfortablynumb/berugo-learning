/**
 * Graded exercises for language design, the lexer and the parser (M28.1-M28.3).
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
    'designing-a-language': [{
      id: 'feature-cost',
      title: 'Score a feature twice, and find what nothing runs',
      prompt: 'A feature is { id, parse, later }. A program is { id, covers: [featureId] }. ' +
        'Write rank(features, key) returning the features sorted by that key descending, ' +
        'breaking ties by id ascending, where key is "parse", "later", "total" or "ratio" — ' +
        'total is parse + later and ratio is later divided by parse. Write coverage(features, ' +
        'programs) returning one row per feature as { id, programs, covered } in the input ' +
        'order, where programs is how many programs list it and covered is whether that is ' +
        'more than zero. Write uncovered(features, programs) returning the ids of the ' +
        'uncovered features. The starter ranks by total whatever key it is given, so it cannot ' +
        'tell the parser ranking from the after-the-parser one — which is the entire point of ' +
        'scoring twice.',
      entry: 'lab',
      starter: [
        'function valueOf(feature, key) {',
        '  // Always the total: this collapses the two columns the table exists to separate.',
        '  return feature.parse + feature.later;',
        '}',
        '',
        'function rank(features, key) {',
        '  return features.slice().sort(function (a, b) {',
        '    const difference = valueOf(b, key) - valueOf(a, key);',
        '',
        '    if (difference !== 0) return difference;',
        '    return a.id < b.id ? -1 : 1;',
        '  });',
        '}',
        '',
        'function coverage(features, programs) {',
        '  return features.map(function (feature) {',
        '    const count = programs.filter(function (program) {',
        '      return program.covers.indexOf(feature.id) !== -1;',
        '    }).length;',
        '',
        '    return { id: feature.id, programs: count, covered: count > 0 };',
        '  });',
        '}',
        '',
        'function uncovered(features, programs) {',
        '  return coverage(features, programs).filter(function (row) {',
        '    return !row.covered;',
        '  }).map(function (row) { return row.id; });',
        '}',
        '',
        'function lab() {',
        '  return { rank: rank, coverage: coverage, uncovered: uncovered, valueOf: valueOf };',
        '}'
      ].join('\n'),
      solution: [
        'function valueOf(feature, key) {',
        '  if (key === "parse") return feature.parse;',
        '  if (key === "later") return feature.later;',
        '  if (key === "ratio") return feature.parse === 0 ? Infinity : feature.later / feature.parse;',
        '  return feature.parse + feature.later;',
        '}',
        '',
        'function rank(features, key) {',
        '  return features.slice().sort(function (a, b) {',
        '    const difference = valueOf(b, key) - valueOf(a, key);',
        '',
        '    if (difference !== 0) return difference;',
        '    return a.id < b.id ? -1 : 1;',
        '  });',
        '}',
        '',
        'function coverage(features, programs) {',
        '  return features.map(function (feature) {',
        '    const count = programs.filter(function (program) {',
        '      return program.covers.indexOf(feature.id) !== -1;',
        '    }).length;',
        '',
        '    return { id: feature.id, programs: count, covered: count > 0 };',
        '  });',
        '}',
        '',
        'function uncovered(features, programs) {',
        '  return coverage(features, programs).filter(function (row) {',
        '    return !row.covered;',
        '  }).map(function (row) { return row.id; });',
        '}',
        '',
        'function lab() {',
        '  return { rank: rank, coverage: coverage, uncovered: uncovered, valueOf: valueOf };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the parser ranking and the after-the-parser ranking are different orders',
          assert: function (lab, api) {
            const parts = lab();
            const features = [
              { id: 'match', parse: 4, later: 5 },
              { id: 'operators', parse: 3, later: 1 },
              { id: 'arrays', parse: 1, later: 3 }
            ];

            api.assert.equal(parts.rank(features, 'parse')[0].id, 'match',
              'match costs the most to parse');
            api.assert.equal(parts.rank(features, 'parse')[1].id, 'operators',
              'operators are second by parser cost');
            api.assert.equal(parts.rank(features, 'later')[0].id, 'match',
              'match also costs the most afterwards');
            api.assert.equal(parts.rank(features, 'later')[2].id, 'operators',
              'but operators are LAST by later cost — ranking by the total cannot show this');
          }
        },
        {
          name: 'the ratio finds the feature that is cheap to parse and expensive afterwards',
          assert: function (lab, api) {
            const parts = lab();
            const features = [
              { id: 'arrays', parse: 1, later: 3 },
              { id: 'match', parse: 4, later: 5 },
              { id: 'literals', parse: 3, later: 1 }
            ];
            const byRatio = parts.rank(features, 'ratio');

            api.assert.equal(byRatio[0].id, 'arrays',
              'arrays have the worst ratio at 3.00, and the best parser cost');
            api.assert.equal(byRatio[2].id, 'literals', 'literals have the best ratio at 0.33');
            api.assert.closeTo(parts.valueOf(features[0], 'ratio'), 3, 1e-9, 'three later per one parse');
            api.assert.equal(parts.valueOf(features[1], 'total'), 9, 'match totals nine');
          }
        },
        {
          name: 'ties break by id, so the ranking is stable and comparable between runs',
          assert: function (lab, api) {
            const parts = lab();
            const features = [
              { id: 'modules', parse: 1, later: 3 },
              { id: 'arrays', parse: 1, later: 3 },
              { id: 'loops', parse: 2, later: 2 }
            ];
            const byTotal = parts.rank(features, 'total').map(function (f) { return f.id; });

            api.assert.deepEqual(byTotal, ['arrays', 'loops', 'modules'],
              'all three total four, so the order is by id');
          }
        },
        {
          name: 'coverage reports a feature that no program exercises',
          assert: function (lab, api) {
            const parts = lab();
            const features = [{ id: 'literals' }, { id: 'modules' }, { id: 'match' }];
            const programs = [
              { id: 'arithmetic', covers: ['literals'] },
              { id: 'string', covers: ['literals'] },
              { id: 'match', covers: ['match'] }
            ];
            const rows = parts.coverage(features, programs);

            api.assert.equal(rows.length, 3, 'one row per feature, in the input order');
            api.assert.equal(rows[0].id, 'literals', 'the input order is preserved');
            api.assert.equal(rows[0].programs, 2, 'two programs cover literals');
            api.assert.equal(rows[1].covered, false, 'modules is covered by nothing');
            api.assert.deepEqual(parts.uncovered(features, programs), ['modules'],
              'and uncovered names it — this is the gap that was real: modules were implemented ' +
                'in two stages and exercised by zero programs');
          }
        },
        {
          name: 'an empty program list makes every feature uncovered',
          assert: function (lab, api) {
            const parts = lab();
            const features = [{ id: 'a' }, { id: 'b' }];

            api.assert.deepEqual(parts.uncovered(features, []), ['a', 'b'],
              'nothing runs, so nothing is covered');
            api.assert.deepEqual(parts.coverage(features, []).map(function (r) { return r.programs; }),
              [0, 0], 'and both counts are zero rather than undefined');
          }
        }
      ]
    }],

    'the-lexer': [{
      id: 'numeric-scanner',
      title: 'Scan a numeral, or produce one error token',
      prompt: 'Write scanNumber(source, start) returning { kind, start, end, value } where kind ' +
        'is "number" or "error". Accept digits, one optional fraction (a point followed by at ' +
        'least one digit), one optional exponent (e or E, an optional sign, and at least one ' +
        'digit), and underscores between digits, which are stripped before conversion. Reject ' +
        'as ONE error token: a second decimal point, and a numeral running straight into a ' +
        'letter or underscore — the error token must span the whole malformed run. An exponent ' +
        'marker with no digits after it is not part of the number, so 1e is a numeral followed ' +
        'by a letter and therefore an error too. Then write scanAll(source) returning the array ' +
        'of tokens for a source containing only numerals separated by single spaces. The ' +
        'starter stops at the first character a number cannot use, so 0x1 comes back as the ' +
        'number 0 and the parser complains somewhere to the right.',
      entry: 'lab',
      starter: [
        'function isDigit(ch) { return ch >= "0" && ch <= "9"; }',
        '',
        'function isNameStart(ch) {',
        '  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";',
        '}',
        '',
        'function consumeDigits(source, at) {',
        '  while (at < source.length && (isDigit(source[at])',
        '    || (source[at] === "_" && isDigit(source[at + 1])))) {',
        '    at += 1;',
        '  }',
        '  return at;',
        '}',
        '',
        'function scanNumber(source, start) {',
        '  let at = consumeDigits(source, start);',
        '',
        '  if (source[at] === "." && isDigit(source[at + 1])) {',
        '    at = consumeDigits(source, at + 1);',
        '  }',
        '  if (source[at] === "e" || source[at] === "E") {',
        '    const mark = at;',
        '',
        '    at += 1;',
        '    if (source[at] === "+" || source[at] === "-") at += 1;',
        '    if (!isDigit(source[at])) at = mark;',
        '    else at = consumeDigits(source, at);',
        '  }',
        '  // Maximal munch stops here. A trailing letter becomes somebody else’s problem.',
        '  const text = source.slice(start, at).replace(/_/g, "");',
        '',
        '  return { kind: "number", start: start, end: at, value: Number(text) };',
        '}',
        '',
        'function scanAll(source) {',
        '  const tokens = [];',
        '  let at = 0;',
        '',
        '  while (at < source.length) {',
        '    if (source[at] === " ") { at += 1; continue; }',
        '    const token = scanNumber(source, at);',
        '',
        '    tokens.push(token);',
        '    at = token.end > at ? token.end : at + 1;',
        '  }',
        '  return tokens;',
        '}',
        '',
        'function lab() { return { scanNumber: scanNumber, scanAll: scanAll }; }'
      ].join('\n'),
      solution: [
        'function isDigit(ch) { return ch >= "0" && ch <= "9"; }',
        '',
        'function isNameStart(ch) {',
        '  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";',
        '}',
        '',
        'function isNameBody(ch) { return isNameStart(ch) || isDigit(ch); }',
        '',
        'function consumeDigits(source, at) {',
        '  while (at < source.length && (isDigit(source[at])',
        '    || (source[at] === "_" && isDigit(source[at + 1])))) {',
        '    at += 1;',
        '  }',
        '  return at;',
        '}',
        '',
        'function garbage(source, start, at) {',
        '  let end = at;',
        '',
        '  while (end < source.length && isNameBody(source[end])) end += 1;',
        '  return { kind: "error", start: start, end: end, value: source.slice(start, end) };',
        '}',
        '',
        'function scanFraction(source, at) {',
        '  if (source[at] === "." && isDigit(source[at + 1])) {',
        '    return { at: consumeDigits(source, at + 1), seen: true };',
        '  }',
        '  return { at: at, seen: false };',
        '}',
        '',
        'function scanExponent(source, at) {',
        '  if (source[at] !== "e" && source[at] !== "E") return at;',
        '  let next = at + 1;',
        '',
        '  if (source[next] === "+" || source[next] === "-") next += 1;',
        '  if (!isDigit(source[next])) return at;',
        '  return consumeDigits(source, next);',
        '}',
        '',
        'function scanNumber(source, start) {',
        '  let at = consumeDigits(source, start);',
        '  const fraction = scanFraction(source, at);',
        '',
        '  at = fraction.at;',
        '  // A SECOND point is a typo, and reporting it as two tokens sends the reader',
        '  // to the wrong place.',
        '  if (source[at] === "." && isDigit(source[at + 1])) {',
        '    return garbage(source, start, consumeDigits(source, at + 1));',
        '  }',
        '  at = scanExponent(source, at);',
        '  // A numeral running into an identifier is ONE mistake, not two valid tokens.',
        '  if (isNameStart(source[at])) return garbage(source, start, at);',
        '  const text = source.slice(start, at).replace(/_/g, "");',
        '',
        '  return { kind: "number", start: start, end: at, value: Number(text) };',
        '}',
        '',
        'function scanAll(source) {',
        '  const tokens = [];',
        '  let at = 0;',
        '',
        '  while (at < source.length) {',
        '    if (source[at] === " ") { at += 1; continue; }',
        '    const token = scanNumber(source, at);',
        '',
        '    tokens.push(token);',
        '    at = token.end > at ? token.end : at + 1;',
        '  }',
        '  return tokens;',
        '}',
        '',
        'function lab() { return { scanNumber: scanNumber, scanAll: scanAll }; }'
      ].join('\n'),
      tests: [
        {
          name: 'the five well-formed shapes scan to the right values',
          assert: function (lab, api) {
            const parts = lab();
            const check = function (text, value) {
              const token = parts.scanNumber(text, 0);

              api.assert.equal(token.kind, 'number', text + ' is a number');
              api.assert.equal(token.end, text.length, text + ' consumes the whole numeral');
              api.assert.closeTo(token.value, value, 1e-9, text + ' has the value ' + value);
            };

            check('42', 42);
            check('3.5', 3.5);
            check('1_000_000', 1000000);
            check('1_000.5e2', 100050);
            check('2e-3', 0.002);
          }
        },
        {
          name: 'a numeral running into a letter is one error token, not two valid tokens',
          assert: function (lab, api) {
            const parts = lab();
            const hex = parts.scanNumber('0x1', 0);

            api.assert.equal(hex.kind, 'error',
              '0x1 must be an error — maximal munch alone gives the number 0 followed by the ' +
                'name x1, a perfectly well-formed stream for a program nobody wrote');
            api.assert.equal(hex.end, 3, 'and the error spans all three characters');

            const mixed = parts.scanNumber('1abc', 0);

            api.assert.equal(mixed.kind, 'error', '1abc is one mistake');
            api.assert.equal(mixed.end, 4, 'spanning the whole run');
          }
        },
        {
          name: 'an exponent marker with no digits is not consumed, so it is a trailing letter',
          assert: function (lab, api) {
            const parts = lab();
            const bare = parts.scanNumber('1e', 0);

            api.assert.equal(bare.kind, 'error',
              '1e is an error: the e is not part of the number, so the numeral runs into a letter');
            api.assert.equal(bare.end, 2, 'and the span covers both characters');

            const signed = parts.scanNumber('2e+10', 0);

            api.assert.equal(signed.kind, 'number', 'but 2e+10 is a perfectly good number');
            api.assert.closeTo(signed.value, 2e10, 1, 'worth twenty billion');
          }
        },
        {
          name: 'two decimal points are one error, not 1.2 followed by .3',
          assert: function (lab, api) {
            const parts = lab();
            const token = parts.scanNumber('1.2.3', 0);

            api.assert.equal(token.kind, 'error', 'a second decimal point is a typo');
            api.assert.equal(token.end, 5, 'and the error covers all five characters');
            api.assert.equal(parts.scanNumber('1.2', 0).kind, 'number', 'one point is fine');
          }
        },
        {
          name: 'scanning a whole line keeps the good tokens beside the bad ones',
          assert: function (lab, api) {
            const parts = lab();
            const tokens = parts.scanAll('42 0x1 3.5 1.2.3 7');
            const kinds = tokens.map(function (token) { return token.kind; });

            api.assert.deepEqual(kinds, ['number', 'error', 'number', 'error', 'number'],
              'five tokens: three numbers and two errors, with scanning continuing past both');
            api.assert.equal(tokens[4].value, 7,
              'the token after the second error is still scanned correctly, which is the whole ' +
                'argument for error tokens over exceptions');
            api.assert.equal(tokens[1].end - tokens[1].start, 3, 'the first error spans 0x1');
          }
        }
      ]
    }],

    'the-parser': [{
      id: 'pratt-expressions',
      title: 'Parse expressions with a precedence table',
      prompt: 'Tokens are strings: numerals, names, and the operators in the table. Write ' +
        'parse(tokens, table) returning a tree of { kind: "num" | "name", value } and ' +
        '{ kind: "binary", op, left, right }. `table` maps an operator to { left, right } ' +
        'binding powers. Use a Pratt loop: read an atom, then while the next operator has a ' +
        'LEFT power at or above the current minimum, consume it and parse its right side with ' +
        'the operator\'s RIGHT power as the new minimum. Then write show(tree) rendering the ' +
        'tree fully parenthesised, so grouping is visible: (1 + (2 * 3)). The starter uses the ' +
        'left power on both sides, which makes every operator right-associative — so 1 - 2 - 3 ' +
        'comes out as (1 - (2 - 3)), a different number.',
      entry: 'lab',
      starter: [
        'function atom(state) {',
        '  const token = state.tokens[state.at];',
        '',
        '  state.at += 1;',
        '  if (/^[0-9]/.test(token)) return { kind: "num", value: Number(token) };',
        '  return { kind: "name", value: token };',
        '}',
        '',
        'function expr(state, minimum) {',
        '  let left = atom(state);',
        '',
        '  while (state.at < state.tokens.length) {',
        '    const op = state.tokens[state.at];',
        '    const powers = state.table[op];',
        '',
        '    if (!powers || powers.left < minimum) break;',
        '    state.at += 1;',
        '    // The left power on both sides: this makes everything right-associative.',
        '    const right = expr(state, powers.left);',
        '',
        '    left = { kind: "binary", op: op, left: left, right: right };',
        '  }',
        '  return left;',
        '}',
        '',
        'function parse(tokens, table) {',
        '  return expr({ tokens: tokens, at: 0, table: table }, 0);',
        '}',
        '',
        'function show(tree) {',
        '  if (tree.kind === "binary") {',
        '    return "(" + show(tree.left) + " " + tree.op + " " + show(tree.right) + ")";',
        '  }',
        '  return String(tree.value);',
        '}',
        '',
        'function lab() { return { parse: parse, show: show }; }'
      ].join('\n'),
      solution: [
        'function atom(state) {',
        '  const token = state.tokens[state.at];',
        '',
        '  state.at += 1;',
        '  if (/^[0-9]/.test(token)) return { kind: "num", value: Number(token) };',
        '  return { kind: "name", value: token };',
        '}',
        '',
        'function expr(state, minimum) {',
        '  let left = atom(state);',
        '',
        '  while (state.at < state.tokens.length) {',
        '    const op = state.tokens[state.at];',
        '    const powers = state.table[op];',
        '',
        '    if (!powers || powers.left < minimum) break;',
        '    state.at += 1;',
        '    // The RIGHT power is the new minimum. Making it one higher than the left',
        '    // power stops the recursive call taking an operator of the same level,',
        '    // which is the whole of left associativity.',
        '    const right = expr(state, powers.right);',
        '',
        '    left = { kind: "binary", op: op, left: left, right: right };',
        '  }',
        '  return left;',
        '}',
        '',
        'function parse(tokens, table) {',
        '  return expr({ tokens: tokens, at: 0, table: table }, 0);',
        '}',
        '',
        'function show(tree) {',
        '  if (tree.kind === "binary") {',
        '    return "(" + show(tree.left) + " " + tree.op + " " + show(tree.right) + ")";',
        '  }',
        '  return String(tree.value);',
        '}',
        '',
        'function lab() { return { parse: parse, show: show }; }'
      ].join('\n'),
      tests: [
        {
          name: 'higher precedence binds tighter',
          assert: function (lab, api) {
            const parts = lab();
            const table = { '+': { left: 9, right: 10 }, '*': { left: 11, right: 12 } };

            api.assert.equal(parts.show(parts.parse(['1', '+', '2', '*', '3'], table)),
              '(1 + (2 * 3))', 'times binds tighter than plus');
            api.assert.equal(parts.show(parts.parse(['1', '*', '2', '+', '3'], table)),
              '((1 * 2) + 3)', 'and the other way round');
          }
        },
        {
          name: 'equal precedence groups left, which is what the difference of one encodes',
          assert: function (lab, api) {
            const parts = lab();
            const table = { '-': { left: 9, right: 10 } };

            api.assert.equal(parts.show(parts.parse(['1', '-', '2', '-', '3'], table)),
              '((1 - 2) - 3)',
              'left associative: using the left power as the new minimum gives (1 - (2 - 3)), ' +
                'which is a different number');
            api.assert.equal(parts.show(parts.parse(['9', '-', '1', '-', '1', '-', '1'], table)),
              '(((9 - 1) - 1) - 1)', 'and it keeps grouping left however long the chain is');
          }
        },
        {
          name: 'a right-associative operator is one number changed, not a special case',
          assert: function (lab, api) {
            const parts = lab();
            /* The RIGHT power one LOWER than the left is the whole of right
               associativity — no separate rule, no second code path. */
            const table = { '^': { left: 14, right: 13 } };

            api.assert.equal(parts.show(parts.parse(['2', '^', '3', '^', '2'], table)),
              '(2 ^ (3 ^ 2))',
              'exponentiation groups right, which is why the table has two powers and not one');
          }
        },
        {
          name: 'six levels in one expression come out in the right shape',
          assert: function (lab, api) {
            const parts = lab();
            const table = {
              '||': { left: 1, right: 2 }, '&&': { left: 3, right: 4 },
              '<': { left: 7, right: 8 }, '+': { left: 9, right: 10 },
              '*': { left: 11, right: 12 }
            };
            const tokens = ['1', '+', '2', '*', '3', '<', '10', '&&', 'a', '||', 'b'];

            api.assert.equal(parts.show(parts.parse(tokens, table)),
              '((((1 + (2 * 3)) < 10) && a) || b)',
              'the loosest operator ends up outermost, which is what low binding power means');
          }
        },
        {
          name: 'an unknown operator ends the expression rather than being consumed',
          assert: function (lab, api) {
            const parts = lab();
            const table = { '+': { left: 9, right: 10 } };
            const tree = parts.parse(['1', '+', '2', ';', '3'], table);

            api.assert.equal(parts.show(tree), '(1 + 2)',
              'the semicolon is not in the table, so the loop stops — which is how a Pratt ' +
                'expression parser hands control back to the statement parser');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
