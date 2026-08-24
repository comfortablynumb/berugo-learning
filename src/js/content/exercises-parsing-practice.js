/**
 * Graded exercises for Pratt parsing, lexing, recovery and real languages
 * (M25.9-M25.12).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'pratt-parsing-and-precedence': [{
      id: 'pratt-parser',
      title: 'Write the Pratt loop: prefix, infix, postfix and a ternary',
      prompt: 'parse(table, tokens) must return the fully parenthesised expression as a string. ' +
        '`table` is { prefix, infix, postfix, ternary }: a prefix or postfix entry is ' +
        '{ power }, an infix entry is { power, right }, and `ternary` is ' +
        '{ question, colon, power }. Format an atom as itself, a prefix node as `(op operand)`, ' +
        'a postfix node as `(operand op)`, an infix node as `(left op right)` and a ternary as ' +
        '`(cond ? then : else)`. Parentheses in the input group. The loop: parse a prefix, then ' +
        'while the next token binds strictly tighter than the limit you were called with, ' +
        'consume it and let it take what is on the left. A LEFT-associative infix operator ' +
        'recurses with its own power; a RIGHT-associative one recurses with its power minus ' +
        'one. The starter recurses with the operator’s own power in both cases, so ' +
        'exponentiation comes out left-associative.',
      entry: 'parse',
      starter: [
        'function parse(table, tokens) {',
        '  // Ignores the `right` flag: a ^ b ^ c comes out as ((a ^ b) ^ c).',
        '  let at = 0;',
        '',
        '  function expression(limit) {',
        '    let left = nud();',
        '',
        '    for (;;) {',
        '      const token = tokens[at];',
        '',
        '      if (token === undefined) return left;',
        '      const post = table.postfix && table.postfix[token];',
        '',
        '      if (post && post.power > limit) { at += 1; left = "(" + left + " " + token + ")";',
        '        continue; }',
        '      const infix = table.infix && table.infix[token];',
        '',
        '      if (!infix || infix.power <= limit) return left;',
        '      at += 1;',
        '      left = "(" + left + " " + token + " " + expression(infix.power) + ")";',
        '    }',
        '  }',
        '',
        '  function nud() {',
        '    const token = tokens[at];',
        '    const pre = table.prefix && table.prefix[token];',
        '',
        '    if (pre) { at += 1; return "(" + token + " " + expression(pre.power) + ")"; }',
        '    if (token === "(") {',
        '      at += 1;',
        '      const inner = expression(0);',
        '',
        '      if (tokens[at] === ")") at += 1;',
        '      return inner;',
        '    }',
        '    at += 1;',
        '    return token;',
        '  }',
        '  return expression(0);',
        '}'
      ].join('\n'),
      solution: [
        'function parse(table, tokens) {',
        '  let at = 0;',
        '',
        '  function expression(limit) {',
        '    let left = nud();',
        '',
        '    for (;;) {',
        '      const token = tokens[at];',
        '',
        '      if (token === undefined) return left;',
        '      const post = table.postfix && table.postfix[token];',
        '',
        '      if (post && post.power > limit) {',
        '        at += 1;',
        '        left = "(" + left + " " + token + ")";',
        '        continue;',
        '      }',
        '      if (table.ternary && token === table.ternary.question',
        '        && table.ternary.power > limit) {',
        '        at += 1;',
        '        const middle = expression(0);',
        '',
        '        if (tokens[at] === table.ternary.colon) at += 1;',
        '        const right = expression(table.ternary.power - 1);',
        '',
        '        left = "(" + left + " ? " + middle + " : " + right + ")";',
        '        continue;',
        '      }',
        '      const infix = table.infix && table.infix[token];',
        '',
        '      if (!infix || infix.power <= limit) return left;',
        '      at += 1;',
        '      const right = expression(infix.right ? infix.power - 1 : infix.power);',
        '',
        '      left = "(" + left + " " + token + " " + right + ")";',
        '    }',
        '  }',
        '',
        '  function nud() {',
        '    const token = tokens[at];',
        '    const pre = table.prefix && table.prefix[token];',
        '',
        '    if (pre) { at += 1; return "(" + token + " " + expression(pre.power) + ")"; }',
        '    if (token === "(") {',
        '      at += 1;',
        '      const inner = expression(0);',
        '',
        '      if (tokens[at] === ")") at += 1;',
        '      return inner;',
        '    }',
        '    at += 1;',
        '    return token;',
        '  }',
        '  return expression(0);',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'precedence and both associativities',
          assert: function (parse, api) {
            const table = {
              prefix: { '-': { power: 90 } },
              infix: { '+': { power: 50, right: false }, '*': { power: 60, right: false },
                '^': { power: 80, right: true } },
              postfix: { '++': { power: 95 } },
              ternary: { question: '?', colon: ':', power: 5 }
            };
            const run = function (text) { return parse(table, text.split(' ')); };

            api.assert.equal(run('a + b * c'), '(a + (b * c))');
            api.assert.equal(run('a * b + c'), '((a * b) + c)');
            api.assert.equal(run('a + b + c'), '((a + b) + c)', 'left-associative');
            api.assert.equal(run('a ^ b ^ c'), '(a ^ (b ^ c))',
              'RIGHT-associative — this is the case the starter gets wrong');
            api.assert.equal(run('a + b * c ^ d'), '(a + (b * (c ^ d)))');
          }
        },
        {
          name: 'prefix, postfix, ternary and grouping',
          assert: function (parse, api) {
            const table = {
              prefix: { '-': { power: 90 } },
              infix: { '+': { power: 50, right: false }, '*': { power: 60, right: false },
                '^': { power: 80, right: true } },
              postfix: { '++': { power: 95 } },
              ternary: { question: '?', colon: ':', power: 5 }
            };
            const run = function (text) { return parse(table, text.split(' ')); };

            api.assert.equal(run('- a + b'), '((- a) + b)',
              'unary minus must not swallow the rest of the line');
            api.assert.equal(run('- a * b'), '((- a) * b)');
            api.assert.equal(run('a ++ + b'), '((a ++) + b)');
            api.assert.equal(run('a ? b : c'), '(a ? b : c)');
            api.assert.equal(run('a ? b : c ? d : e'), '(a ? b : (c ? d : e))',
              'the ternary is right-associative');
            api.assert.equal(run('( a + b ) * c'), '((a + b) * c)');
          }
        },
        {
          name: 'the table is data: changing a number changes the tree',
          assert: function (parse, api) {
            const swapped = {
              prefix: {}, postfix: {}, ternary: null,
              infix: { '+': { power: 60, right: false }, '*': { power: 50, right: false } }
            };

            api.assert.equal(parse(swapped, 'a + b * c'.split(' ')), '((a + b) * c)',
              'with + binding tighter, the sum nests');

            const leftPower = {
              prefix: {}, postfix: {}, ternary: null,
              infix: { '^': { power: 80, right: false } }
            };

            api.assert.equal(parse(leftPower, 'a ^ b ^ c'.split(' ')), '((a ^ b) ^ c)',
              'flipping one boolean flips the associativity and nothing else');
          }
        }
      ]
    }],

    'lexing-in-context': [{
      id: 'indent-dedent',
      title: 'Generate INDENT and DEDENT from an indentation stack',
      prompt: 'tokenise(source, tabWidth) must return an array of token objects for a ' +
        'Python-like source. For each line: measure its indentation COLUMN, where a space ' +
        'advances by one and a tab advances to the next multiple of `tabWidth`. Skip the line ' +
        'entirely — emitting nothing at all, not even a NEWLINE — when the rest of it is blank ' +
        'or starts with `#`. Otherwise: if the column is deeper than the top of the stack, push ' +
        'it and emit { type: "INDENT" }; if shallower, pop and emit { type: "DEDENT" } until the ' +
        'top matches, and emit { type: "ERROR", column } if it never does; then emit ' +
        '{ type: "LINE", text } with the line trimmed, and { type: "NEWLINE" }. At the end, emit ' +
        'a DEDENT for every level still open. The starter counts leading spaces, so a tab ' +
        'counts as one column and blank lines produce tokens.',
      entry: 'tokenise',
      starter: [
        'function tokenise(source, tabWidth) {',
        '  // Counts characters rather than columns, and emits tokens for blank lines.',
        '  const stack = [0];',
        '  const out = [];',
        '',
        '  source.split("\\n").forEach(function (line) {',
        '    let width = 0;',
        '',
        '    while (width < line.length && (line[width] === " " || line[width] === "\\t")) {',
        '      width += 1;',
        '    }',
        '    const rest = line.slice(width);',
        '',
        '    if (width > stack[stack.length - 1]) {',
        '      stack.push(width);',
        '      out.push({ type: "INDENT" });',
        '    }',
        '    while (stack[stack.length - 1] > width) {',
        '      stack.pop();',
        '      out.push({ type: "DEDENT" });',
        '    }',
        '    out.push({ type: "LINE", text: rest.trim() });',
        '    out.push({ type: "NEWLINE" });',
        '  });',
        '  while (stack.length > 1) { stack.pop(); out.push({ type: "DEDENT" }); }',
        '  return out;',
        '}'
      ].join('\n'),
      solution: [
        'function tokenise(source, tabWidth) {',
        '  const width = tabWidth || 8;',
        '  const stack = [0];',
        '  const out = [];',
        '',
        '  source.split("\\n").forEach(function (line) {',
        '    let column = 0;',
        '    let at = 0;',
        '',
        '    while (at < line.length && (line[at] === " " || line[at] === "\\t")) {',
        '      column = line[at] === "\\t"',
        '        ? (Math.floor(column / width) + 1) * width : column + 1;',
        '      at += 1;',
        '    }',
        '    const rest = line.slice(at);',
        '',
        '    if (rest.trim() === "" || rest.indexOf("#") === 0) return;',
        '    if (column > stack[stack.length - 1]) {',
        '      stack.push(column);',
        '      out.push({ type: "INDENT" });',
        '    } else {',
        '      while (stack[stack.length - 1] > column) {',
        '        stack.pop();',
        '        out.push({ type: "DEDENT" });',
        '      }',
        '      if (stack[stack.length - 1] !== column) {',
        '        out.push({ type: "ERROR", column: column });',
        '      }',
        '    }',
        '    out.push({ type: "LINE", text: rest.trim() });',
        '    out.push({ type: "NEWLINE" });',
        '  });',
        '  while (stack.length > 1) { stack.pop(); out.push({ type: "DEDENT" }); }',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'blank lines and comment-only lines emit nothing at all',
          assert: function (tokenise, api) {
            const source = ['def f():', '    a = 1', '', '    # a comment', '    b = 2',
              'c = 3'].join('\n');
            const out = tokenise(source, 8);
            const count = function (type) {
              return out.filter(function (t) { return t.type === type; }).length;
            };

            api.assert.equal(count('LINE'), 4,
              '6 source lines minus a blank and a comment leaves 4 — got ' + count('LINE'));
            api.assert.equal(count('NEWLINE'), 4, 'one NEWLINE per LINE, and no more');
            api.assert.equal(count('INDENT'), 1, 'one block opens');
            api.assert.equal(count('DEDENT'), 1, 'and it closes');
            api.assert.equal(count('ERROR'), 0);
          }
        },
        {
          name: 'a tab advances to the next multiple of the tab width',
          assert: function (tokenise, api) {
            const tabbed = ['if a:', '\tb = 1'].join('\n');
            const spaced = ['if a:', '        b = 1'].join('\n');
            const shape = function (tokens) {
              return tokens.map(function (t) { return t.type; }).join(' ');
            };

            api.assert.equal(shape(tokenise(tabbed, 8)), shape(tokenise(spaced, 8)),
              'a tab and eight spaces must produce the same token shape at tabWidth 8');

            const four = tokenise(['if a:', '\tb = 1', '    c = 2'].join('\n'), 4);

            api.assert.equal(
              four.filter(function (t) { return t.type === 'ERROR'; }).length, 0,
              'at tabWidth 4 a tab and four spaces are the same column, so no error');

            const eight = tokenise(['if a:', '\tb = 1', '    c = 2'].join('\n'), 8);

            api.assert.equal(
              eight.filter(function (t) { return t.type === 'DEDENT'; }).length, 1,
              'at tabWidth 8 the tab is column 8 and the spaces are column 4, so it dedents');
          }
        },
        {
          name: 'a dedent to an unopened column is an error, and every block closes at the end',
          assert: function (tokenise, api) {
            const bad = tokenise(['if a:', '        b = 1', '    c = 2'].join('\n'), 8);
            const errors = bad.filter(function (t) { return t.type === 'ERROR'; });

            api.assert.equal(errors.length, 1,
              'column 4 was never opened — expected 1 ERROR, got ' + errors.length);
            api.assert.equal(errors[0].column, 4);

            const nested = tokenise(['a', '  b', '    c', '      d'].join('\n'), 8);
            const types = nested.map(function (t) { return t.type; });

            api.assert.equal(types.filter(function (t) { return t === 'INDENT'; }).length, 3);
            api.assert.equal(types.filter(function (t) { return t === 'DEDENT'; }).length, 3,
              'three blocks are open at the end and all three must close');
            api.assert.equal(types[types.length - 1], 'DEDENT',
              'the closing dedents come last');
          }
        }
      ]
    }],

    'error-recovery-and-diagnostics': [{
      id: 'panic-mode',
      title: 'Panic-mode recovery: three errors, three diagnostics, and the valid declarations',
      prompt: 'parse(tokens) must parse a statement language and return ' +
        '{ diagnostics, declarations }. A statement is `let NAME = VALUE ;` or ' +
        '`print VALUE ;`, where VALUE is a NAME or a number. On any mismatch, push one ' +
        'diagnostic { at, expected } and then RECOVER by panic mode: discard tokens until you ' +
        'reach one in the synchronising set — a `;`, which you consume, or `let` or `print`, ' +
        'which you leave for the next statement. Push { kind, name } into `declarations` for ' +
        'each statement that parsed completely. The starter reports the first error and stops, ' +
        'so a file with three mistakes yields one diagnostic and loses every later declaration.',
      entry: 'parse',
      starter: [
        'function parse(tokens) {',
        '  // Stops at the first error: everything after it is invisible.',
        '  const diagnostics = [];',
        '  const declarations = [];',
        '  let at = 0;',
        '',
        '  function fail(expected) {',
        '    diagnostics.push({ at: at, expected: expected });',
        '    at = tokens.length;',
        '    return false;',
        '  }',
        '  while (at < tokens.length) {',
        '    if (tokens[at] === "let") {',
        '      at += 1;',
        '      const name = tokens[at];',
        '',
        '      if (!name || !/^[a-z]+$/.test(name)) { fail("a name"); continue; }',
        '      at += 1;',
        '      if (tokens[at] !== "=") { fail("="); continue; }',
        '      at += 1;',
        '      if (!tokens[at] || !/^[a-z0-9]+$/.test(tokens[at])) { fail("a value"); continue; }',
        '      at += 1;',
        '      if (tokens[at] !== ";") { fail(";"); continue; }',
        '      at += 1;',
        '      declarations.push({ kind: "let", name: name });',
        '      continue;',
        '    }',
        '    if (tokens[at] === "print") {',
        '      at += 1;',
        '      if (!tokens[at] || !/^[a-z0-9]+$/.test(tokens[at])) { fail("a value"); continue; }',
        '      at += 1;',
        '      if (tokens[at] !== ";") { fail(";"); continue; }',
        '      at += 1;',
        '      declarations.push({ kind: "print", name: null });',
        '      continue;',
        '    }',
        '    fail("let or print");',
        '  }',
        '  return { diagnostics: diagnostics, declarations: declarations };',
        '}'
      ].join('\n'),
      solution: [
        'function parse(tokens) {',
        '  const diagnostics = [];',
        '  const declarations = [];',
        '  let at = 0;',
        '',
        '  function recover() {',
        '    while (at < tokens.length) {',
        '      if (tokens[at] === ";") { at += 1; return; }',
        '      if (tokens[at] === "let" || tokens[at] === "print") return;',
        '      at += 1;',
        '    }',
        '  }',
        '',
        '  function fail(expected) {',
        '    diagnostics.push({ at: at, expected: expected });',
        '    recover();',
        '  }',
        '  while (at < tokens.length) {',
        '    if (tokens[at] === "let") {',
        '      at += 1;',
        '      const name = tokens[at];',
        '',
        '      if (!name || !/^[a-z]+$/.test(name) || name === "let" || name === "print") {',
        '        fail("a name");',
        '        continue;',
        '      }',
        '      at += 1;',
        '      if (tokens[at] !== "=") { fail("="); continue; }',
        '      at += 1;',
        '      if (!tokens[at] || !/^[a-z0-9]+$/.test(tokens[at])) { fail("a value"); continue; }',
        '      at += 1;',
        '      if (tokens[at] !== ";") { fail(";"); continue; }',
        '      at += 1;',
        '      declarations.push({ kind: "let", name: name });',
        '      continue;',
        '    }',
        '    if (tokens[at] === "print") {',
        '      at += 1;',
        '      if (!tokens[at] || !/^[a-z0-9]+$/.test(tokens[at])) { fail("a value"); continue; }',
        '      at += 1;',
        '      if (tokens[at] !== ";") { fail(";"); continue; }',
        '      at += 1;',
        '      declarations.push({ kind: "print", name: null });',
        '      continue;',
        '    }',
        '    fail("let or print");',
        '  }',
        '  return { diagnostics: diagnostics, declarations: declarations };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a clean file produces no diagnostics and every declaration',
          assert: function (parse, api) {
            const tokens = 'let a = 1 ; let b = 2 ; print a ;'.split(' ');
            const out = parse(tokens);

            api.assert.equal(out.diagnostics.length, 0);
            api.assert.equal(out.declarations.length, 3);
            api.assert.equal(out.declarations[0].name, 'a');
            api.assert.equal(out.declarations[2].kind, 'print');
          }
        },
        {
          name: 'three independent errors report exactly three diagnostics, not one and not a cascade',
          assert: function (parse, api) {
            const tokens = ('let a = 1 ; let b 2 ; print a ; let c = ; let d = 4 ; ' +
              'print ; print d ;').split(' ');
            const out = parse(tokens);

            api.assert.equal(out.diagnostics.length, 3,
              'three mistakes, three diagnostics — got ' + out.diagnostics.length +
                '; one means the parser stopped and more means it cascaded');
            api.assert.equal(out.declarations.length, 4,
              'the four valid statements must survive — got ' + out.declarations.length);
            const names = out.declarations.map(function (d) { return d.name; });

            api.assert.ok(names.indexOf('a') !== -1, '`let a` is before the first error');
            api.assert.ok(names.indexOf('d') !== -1,
              '`let d` is after two errors and must still be recovered');
          }
        },
        {
          name: 'recovery resumes at a synchronising token and never loops',
          assert: function (parse, api) {
            const garbage = parse('} } } ;'.split(' '));

            api.assert.ok(garbage.diagnostics.length >= 1, 'the garbage is reported');
            api.assert.equal(garbage.declarations.length, 0);

            const keyword = parse('let = = = let a = 1 ;'.split(' '));

            api.assert.ok(keyword.diagnostics.length >= 1);
            api.assert.equal(keyword.declarations.length, 1,
              'recovery must stop AT `let` rather than consuming it, so the good statement ' +
                'still parses — got ' + keyword.declarations.length);
            api.assert.equal(keyword.declarations[0].name, 'a');
          }
        }
      ]
    }],

    'parsing-real-languages': [{
      id: 'semicolon-insertion',
      title: 'Implement JavaScript-style automatic semicolon insertion',
      prompt: 'insert(tokens) must return a new token array with semicolons inserted where the ' +
        'ECMAScript rules require. Each token is { text, newlineBefore }. Insert a `;` before a ' +
        'token with `newlineBefore` when EITHER the previous token is one of `return`, `throw`, ' +
        '`break` or `continue` (a restricted production, which inserts whether or not the parse ' +
        'would fail), OR the current token is a postfix `++` or `--` (also restricted), OR the ' +
        'previous token could end an expression and the current one could not continue it. A ' +
        'token can END an expression if it is a name, a number, `)`, `]`, `}`, `++` or `--`; a ' +
        'token CONTINUES the expression if it is `(`, `[`, `.`, `,` or a binary operator ' +
        '(`+ - * / = && || ? :`). Never insert after `;`, `{` or `}`. Finally, append a `;` if ' +
        'the last token is not already one. The starter omits the restricted productions, so ' +
        '`return` on its own line is left alone.',
      entry: 'insert',
      starter: [
        'function insert(tokens) {',
        '  // No restricted productions: `return` followed by a newline is left as `return 1`.',
        '  const RESTRICTED = ["return", "throw", "break", "continue"];',
        '  const ENDS = [")", "]", "}", "++", "--"];',
        '  const CONTINUES = ["(", "[", ".", ",", "+", "-", "*", "/", "=", "&&", "||", "?", ":"];',
        '  const out = [];',
        '',
        '  function endsExpression(token) {',
        '    if (!token) return false;',
        '    if (RESTRICTED.indexOf(token.text) !== -1) return false;',
        '    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token.text)) return true;',
        '    if (/^[0-9]+$/.test(token.text)) return true;',
        '    return ENDS.indexOf(token.text) !== -1;',
        '  }',
        '  tokens.forEach(function (token, i) {',
        '    const previous = tokens[i - 1];',
        '',
        '    if (token.newlineBefore && previous',
        '      && [";", "{", "}"].indexOf(previous.text) === -1',
        '      && CONTINUES.indexOf(token.text) === -1',
        '      && endsExpression(previous)) {',
        '      out.push({ text: ";", synthetic: true });',
        '    }',
        '    out.push(token);',
        '  });',
        '  if (tokens.length && tokens[tokens.length - 1].text !== ";") {',
        '    out.push({ text: ";", synthetic: true });',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      solution: [
        'function insert(tokens) {',
        '  const RESTRICTED = ["return", "throw", "break", "continue"];',
        '  const ENDS = [")", "]", "}", "++", "--"];',
        '  const CONTINUES = ["(", "[", ".", ",", "+", "-", "*", "/", "=", "&&", "||", "?", ":"];',
        '  const out = [];',
        '',
        '  function endsExpression(token) {',
        '    if (!token) return false;',
        '    if (RESTRICTED.indexOf(token.text) !== -1) return false;',
        '    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token.text)) return true;',
        '    if (/^[0-9]+$/.test(token.text)) return true;',
        '    return ENDS.indexOf(token.text) !== -1;',
        '  }',
        '',
        '  function shouldInsert(previous, token) {',
        '    if (!previous) return false;',
        '    if ([";", "{", "}"].indexOf(previous.text) !== -1) return false;',
        '    if (RESTRICTED.indexOf(previous.text) !== -1) return true;',
        '    if (token.text === "++" || token.text === "--") return true;',
        '    if (CONTINUES.indexOf(token.text) !== -1) return false;',
        '    return endsExpression(previous);',
        '  }',
        '  tokens.forEach(function (token, i) {',
        '    if (token.newlineBefore && shouldInsert(tokens[i - 1], token)) {',
        '      out.push({ text: ";", synthetic: true });',
        '    }',
        '    out.push(token);',
        '  });',
        '  if (tokens.length && tokens[tokens.length - 1].text !== ";") {',
        '    out.push({ text: ";", synthetic: true });',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the two restricted productions insert regardless of the parse',
          assert: function (insert, api) {
            const build = function (lines) {
              const out = [];

              lines.forEach(function (line, index) {
                line.split(' ').forEach(function (text, i) {
                  out.push({ text: text, newlineBefore: index > 0 && i === 0 });
                });
              });
              return out;
            };
            const show = function (tokens) {
              return tokens.map(function (t) { return t.text; }).join(' ');
            };

            api.assert.equal(show(insert(build(['return', '1']))), 'return ; 1 ;',
              'a newline after `return` inserts, even though `return 1` would have parsed');
            api.assert.equal(show(insert(build(['throw', 'e']))), 'throw ; e ;');
            api.assert.equal(show(insert(build(['a', '++ b']))), 'a ; ++ b ;',
              'a newline before a postfix ++ inserts');
          }
        },
        {
          name: 'a line that genuinely continues gets no semicolon',
          assert: function (insert, api) {
            const build = function (lines) {
              const out = [];

              lines.forEach(function (line, index) {
                line.split(' ').forEach(function (text, i) {
                  out.push({ text: text, newlineBefore: index > 0 && i === 0 });
                });
              });
              return out;
            };
            const show = function (tokens) {
              return tokens.map(function (t) { return t.text; }).join(' ');
            };

            api.assert.equal(show(insert(build(['a = b', '( c )']))), 'a = b ( c ) ;',
              'a line starting with ( is read as a call — the classic hazard');
            api.assert.equal(show(insert(build(['a = b', '[ c ]']))), 'a = b [ c ] ;',
              'a line starting with [ is read as an index');
            api.assert.equal(show(insert(build(['a = b +', 'c']))), 'a = b + c ;',
              'a trailing operator needs a right operand, so wrapping is safe');
          }
        },
        {
          name: 'the ordinary case, and no insertion after a semicolon or a brace',
          assert: function (insert, api) {
            const build = function (lines) {
              const out = [];

              lines.forEach(function (line, index) {
                line.split(' ').forEach(function (text, i) {
                  out.push({ text: text, newlineBefore: index > 0 && i === 0 });
                });
              });
              return out;
            };
            const show = function (tokens) {
              return tokens.map(function (t) { return t.text; }).join(' ');
            };

            api.assert.equal(show(insert(build(['a = 1', 'b = 2']))), 'a = 1 ; b = 2 ;',
              'the case the whole rule exists for');
            api.assert.equal(show(insert(build(['a = 1 ;', 'b = 2']))), 'a = 1 ; b = 2 ;',
              'no double semicolon after an explicit one');
            api.assert.equal(show(insert(build(['{', 'a = 1']))), '{ a = 1 ;',
              'nothing is inserted after an opening brace');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
