/**
 * Section: lexing in context.
 *
 * The measurement is the interpolation count. The same nested template goes
 * through two lexers, one with a mode stack and one without, and the flat one
 * finds zero interpolations where the stacked one finds two — while reporting
 * no error, because a lexer with no notion of nesting has nothing to be wrong
 * about. That is the exact shape of the bug this section is about: not a crash,
 * a token stream that is quietly the wrong shape.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'lexing-in-context';
  const SOURCES = {
    flat: '`hello ${name}`',
    nested: '`a ${b + `c ${d} e`} f`',
    deep: '`p ${q + `r ${s + `t ${u} v`} w`} x`'
  };
  const INDENT_SAMPLES = {
    blanks: ['def f():', '    a = 1', '', '    # a comment line', '    if a:',
      '        b = 2', '    c = 3', 'd = 4'].join('\n'),
    tabs: ['if a:', '\tb = 1', '        c = 2', '\t\td = 3'].join('\n'),
    bad: ['if a:', '        b = 1', '    c = 2'].join('\n')
  };
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — lexer modes for string interpolation',
      caption: 'Inside a template literal, a backtick ends it and `${` starts an embedded ' +
        'expression. Inside that expression the lexer is back in ordinary code mode — where a ' +
        'backtick starts ANOTHER template. So the transitions are not a cycle between two ' +
        'states; they are a stack, because coming out of the inner template must return to the ' +
        'interpolation and coming out of the interpolation must return to the outer template. A ' +
        'finite state machine with two states gets the flat case right and the nested case ' +
        'wrong, and it gets it wrong silently — the tokens come out looking plausible.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> code',
        '    code --> template : backtick, PUSH',
        '    template --> code : backtick, POP',
        '    template --> interpolation : ${ , PUSH',
        '    interpolation --> template : } , POP',
        '    interpolation --> template2 : backtick, PUSH again',
        '    note right of interpolation',
        '      the stack is what makes the second',
        '      backtick open rather than close',
        '    end note'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The lexer/parser split exists because regular languages are cheap and it is a ' +
        'convention, not a law.** Tokenising with a finite automaton is linear and simple, and ' +
        'it lets the grammar talk about `IDENT` rather than about letters. The split is worth ' +
        'keeping until the lexer needs information only the parser has, which in every real ' +
        'language happens somewhere.',
      '**Maximal munch is the tie-breaking rule and it is occasionally wrong.** The lexer takes ' +
        'the longest match at each position, which is what makes `>=` one token rather than two. ' +
        'It is also what made `List<List<int>>` a syntax error in C++ for two decades: the `>>` ' +
        'is longer, so it wins, and the fix in C++11 was a rule in the PARSER that splits it ' +
        'back apart in a template context.',
      '**Keywords are not a lexer concept, they are a table lookup.** The lexer matches an ' +
        'identifier and then checks a reserved-word set. That is why adding a keyword to a ' +
        'language is a breaking change — every variable with that name stops compiling — and why ' +
        'SOFT keywords exist: words that are keywords only where the grammar expects one, which ' +
        'the lexer cannot decide and the parser must.',
      '**Context-sensitive lexing is where the "the language is context-free" claim actually ' +
        'fails.** In JavaScript, `/` is division or the start of a regex depending on what came ' +
        'before. In Python, an f-string contains expressions that need the full lexer. In shell ' +
        'and Ruby, a heredoc changes how the following LINES are read. None of these is decidable ' +
        'from the characters alone.',
      '**A mode stack is the standard answer, and it makes the lexer a pushdown machine.** Each ' +
        'construct that can nest pushes a mode and pops it on the way out, so the lexer knows ' +
        'which rules apply. The demo runs the same nested template through a lexer with a stack ' +
        'and one without, and the flat one produces a plausible, wrong token stream with no ' +
        'error.',
      '**The offside rule turns columns into tokens.** A Python-style lexer keeps a stack of ' +
        'indentation columns: a deeper line emits INDENT and pushes, a shallower one emits ' +
        'DEDENT and pops until it matches, and a column matching nothing on the stack is an ' +
        'error. Downstream, the grammar sees ordinary bracket-like tokens and never mentions ' +
        'whitespace.',
      '**The rules that make the offside rule work are the ones implementations forget.** Blank ' +
        'lines emit nothing at all — not even a NEWLINE — and neither do comment-only lines, ' +
        'which is what lets you leave a blank line inside a block. A tab advances to the next ' +
        'multiple of the tab width, so a tab and eight spaces are the same column and a tab and ' +
        'four spaces are not, which is how two lines that look aligned are not.',
      '**Getting this wrong produces silent misparsing, not a crash.** Every failure in this ' +
        'section is a token stream that the parser happily accepts and that means something ' +
        'else. That is why lexer bugs are found by users rather than by tests: the test corpus ' +
        'never contained a template inside an interpolation, because nobody thought to write ' +
        'one.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — remove the mode stack and watch the tokens go wrong',
        markup: root.LexModesTemplate.render()
      },
      diagram: diagram(),
      insight: '**Most "the parser is context-free" claims fail at the lexer, not the grammar; ' +
        'the lexer is where the language\'s genuinely context-sensitive parts get hidden.** ' +
        'Read a language specification and the grammar looks clean — and then the lexical ' +
        'section has a paragraph about regex-versus-division, or a note that a tab counts as ' +
        'eight columns, or a state machine for template literals. Those paragraphs are where ' +
        'the context sensitivity went. The practical consequence is that a tool built from the ' +
        'grammar alone — a syntax highlighter, a formatter, a lightweight linter — will be ' +
        'correct on ninety-eight per cent of files and subtly wrong on the rest, and the ' +
        'failures will all be in the constructs the lexical section describes.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LexModesTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const lexFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const source = SOURCES[parts[0]];

    return { source: source,
      stacked: root.LexerModes.lex(source, { useStack: true }),
      flat: root.LexerModes.lex(source, { useStack: false }),
      chosen: root.LexerModes.lex(source, { useStack: parts[1] === 'stack' }) };
  });

  const indentFor = root.Helpers.memoise(function (name) {
    const source = INDENT_SAMPLES[name];

    return { source: source, result: root.LexerModes.indentTokens(source),
      lines: source.split('\n') };
  });

  function countOf(result, type) {
    return result.tokens.filter(function (token) { return token.type === type; }).length;
  }

  function update() {
    const values = panel.values();
    const state = lexFor(values['lxc-source'] + '\n' + values['lxc-stack']);
    const indent = indentFor(values['lxc-indent']);

    paintMetrics(state, indent);
    paintTokens(state, values['lxc-stack']);
    paintStack(state);
    paintIndent(indent);
    paintMunch();
    paintCases();
  }

  function paintMetrics(state, indent) {
    root.MetricGrid.update({
      'lxc-tokens': { value: root.Format.exact(state.stacked.tokens.length) + ' / ' +
        root.Format.exact(state.flat.tokens.length),
      note: 'with the stack, then without — and neither lexer reports an error' },
      'lxc-depth': { value: root.Format.exact(state.stacked.maxDepth) + ' / ' +
        root.Format.exact(state.flat.maxDepth),
      note: 'the flat lexer has one mode, so its depth is always 1 by construction' },
      'lxc-interp': { value: root.Format.exact(countOf(state.stacked, 'interpolation-start')) +
        ' / ' + root.Format.exact(countOf(state.flat, 'interpolation-start')),
      note: 'the flat lexer treats an interpolation inside a nested template as literal text' },
      'lxc-indent-errors': { value: root.Format.exact(indent.result.errors.length),
        note: indent.result.errors.length
          ? indent.result.errors[0].message
          : 'every dedent returned to a column some block had opened' }
    });
  }

  function paintTokens(state, which) {
    root.jQuery('#lxc-tokens-view').html(
      '<div>source: ' + root.Helpers.escapeHtml(state.source) + '</div>' +
      '<div style="margin-top:.4rem">' + state.chosen.tokens.map(function (token) {
        return root.Helpers.escapeHtml(token.type + '(' + token.text + ')');
      }).join(' ') + '</div>');

    root.Helpers.setText('lxc-tokens-caption', which === 'stack'
      ? 'With the stack, every backtick is correctly an open or a close according to what mode ' +
        'the lexer is in, and every `${` opens an interpolation whose contents are lexed as ' +
        'code. Switch the lexer control and compare: the flat lexer emits the same NUMBER of ' +
        'tokens for a flat template and a different, wrong stream for a nested one.'
      : 'Without the stack, a backtick simply toggles. On a nested template that means the ' +
        'backtick opening the inner template is read as CLOSING the outer one, so everything ' +
        'after it shifts by one level: real code is lexed as template text, template text is ' +
        'lexed as code, and the interpolation markers inside the inner template are never ' +
        'recognised at all. Nothing here is an error — the tokens are all well formed, and they ' +
        'describe a different program.');
  }

  function paintStack(state) {
    root.jQuery('#lxc-stack-table tbody').html(state.chosen.history.slice(0, 14)
      .map(function (entry) {
        return '<tr><td class="mono">' + entry.at + '</td><td class="mono">' +
          root.Helpers.escapeHtml(entry.action) + '</td><td class="mono">' +
          root.Helpers.escapeHtml(entry.stack) + '</td><td class="mono">' + entry.depth +
          '</td></tr>';
      }).join('') || '<tr><td class="mono">—</td><td class="mono">no pushes or pops</td>' +
        '<td class="mono">code</td><td class="mono">1</td></tr>');

    root.Helpers.setText('lxc-stack-note',
      'Read the stack column as the lexer\'s answer to "where am I". `code > template > ' +
      'interpolation > template` is a template literal, inside an interpolation, inside another ' +
      'template — three levels, and the lexer needs all three to decide what the next backtick ' +
      'means. This is the point at which the tokeniser has stopped being a finite automaton: ' +
      'the depth is unbounded, so no fixed number of states covers it, and the machine is a ' +
      'pushdown automaton exactly like the ones two sections ago.');
  }

  function paintIndent(indent) {
    root.jQuery('#lxc-indent-source').html(indent.lines.map(function (line, i) {
      return root.Helpers.escapeHtml((i + 1) + ': ' + line.replace(/\t/g, '→   ')) || '&nbsp;';
    }).join('<br>'));

    const byLine = groupTokens(indent.result.tokens);

    root.jQuery('#lxc-indent-table tbody').html(byLine.map(function (row) {
      return '<tr><td class="mono">' + row.line + '</td><td class="mono">' + row.column +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.tokens) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td>' +
      '<td class="mono">no tokens</td></tr>');

    root.Helpers.setText('lxc-indent-note',
      'A tab is drawn as `→` followed by the columns it advanced past. In the tabs sample the ' +
      'second and third lines look identically indented in most editors and are at columns 8 ' +
      'and 8 — they agree — while the fourth is at 16, which is a nesting level the author ' +
      'may not have intended. In the bad sample the last line dedents to column 4, which no ' +
      'block ever opened, and that is an error rather than a guess: the lexer refuses to pick ' +
      'the nearest block, because picking one would silently reparent a statement.');
  }

  function groupTokens(tokens) {
    const rows = [];
    let pending = [];

    tokens.forEach(function (token) {
      if (token.type === 'LINE') {
        rows.push({ line: token.line, column: token.column,
          tokens: pending.concat(['LINE(' + token.text + ')']).join(' ') });
        pending = [];
        return;
      }
      if (token.type === 'NEWLINE') return;
      pending.push(token.type);
    });
    if (pending.length) {
      rows.push({ line: 'end', column: 0, tokens: pending.join(' ') });
    }
    return rows;
  }

  function paintMunch() {
    const cases = [
      { input: 'List<List<int>>', operators: ['<', '>', '>>'], right: false,
        why: 'the longest match takes >> as a shift, which C++ had to fix in the parser' },
      { input: 'List<List<int>>', operators: ['<', '>'], right: true,
        why: 'without >> in the set the brackets lex correctly and shifts break instead' },
      { input: 'a>=b', operators: ['>', '=', '>='], right: true,
        why: 'the case maximal munch exists for' },
      { input: 'a--b', operators: ['-', '--'], right: false,
        why: 'a minus minus b lexes as a decrement, which is why C needs a space here' }
    ];

    root.jQuery('#lxc-munch tbody').html(cases.map(function (test) {
      const tokens = root.LexerModes.munch(test.input, test.operators);

      return '<tr><td class="mono">' + root.Helpers.escapeHtml(test.input) + '</td>' +
        '<td class="mono">' + root.Helpers.escapeHtml(test.operators.join(' ')) + '</td>' +
        '<td class="mono">' + root.Helpers.escapeHtml(tokens.map(function (token) {
          return token.text;
        }).join(' · ')) + '</td><td>' + (test.right ? 'yes' : 'no — ' + test.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lxc-munch-note',
      'The first two rows are the same input under two operator sets, and they show that the ' +
      'rule is not the problem — the operator set is. Maximal munch is right for `>=` and wrong ' +
      'for `>>` inside a template argument list, and no purely lexical rule tells the two apart, ' +
      'because whether you are inside a template argument list is a parser fact. C++11 resolved ' +
      'it by letting the parser split a `>>` token when it is looking for a closing angle ' +
      'bracket, which is the lexer/parser split being broken deliberately and documented as ' +
      'such.');
  }

  function paintCases() {
    const rows = [
      { language: 'JavaScript', construct: '/ as division or regex delimiter',
        needs: 'whether an expression has just ended',
        how: 'the lexer is told by the parser, or a heuristic on the previous token' },
      { language: 'JavaScript', construct: 'template literals with nested interpolation',
        needs: 'how deep the nesting is', how: 'a mode stack — the demo above' },
      { language: 'Python', construct: 'indentation',
        needs: 'the stack of open columns',
        how: 'INDENT and DEDENT tokens synthesised by the lexer' },
      { language: 'Python', construct: 'f-strings with expressions inside',
        needs: 'that it is inside a format spec inside a string',
        how: 'a mode stack, and since 3.12 the full tokeniser recurses' },
      { language: 'C', construct: 'typedef names',
        needs: 'the symbol table',
        how: 'the lexer hack — the parser feeds declarations back to the lexer' },
      { language: 'Ruby and shell', construct: 'heredocs',
        needs: 'a pending terminator and which line the body starts on',
        how: 'a queue of pending heredocs consulted at the next newline' },
      { language: 'Rust', construct: 'lifetimes against character literals',
        needs: "whether 'a is a lifetime or an unterminated char",
        how: 'lookahead for the closing quote — a lexical rule, and a fragile one' }
    ];

    root.jQuery('#lxc-cases tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.language + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.construct) + '</td><td>' + row.needs + '</td><td>' +
        row.how + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lxc-cases-note',
      'Third column: every entry is information the lexer cannot compute from the characters in ' +
      'front of it. Two of them need the parser, one needs the symbol table, and the rest need ' +
      'a stack. That is the whole content of the insight — these are the places where a real ' +
      'language stops being context-free, and none of them is in the grammar. When you are ' +
      'writing a tool that consumes a language you did not implement, this table is the list of ' +
      'things to test first.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
