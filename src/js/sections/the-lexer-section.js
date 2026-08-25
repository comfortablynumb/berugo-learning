/**
 * Section: The lexer.
 *
 * Three claims, each with a number beside it.
 *
 * Trivia is preserved: the "comments and blank lines" sample is 5 real tokens
 * carrying 9 pieces of trivia, and the chips make that visible rather than
 * asserted. A lexer that dropped them would produce the same token count and
 * be unable to serve a formatter.
 *
 * Errors are tokens: the malformed sample has three bad literals and one good
 * line, and the good line is still scanned. Every error row shows the token
 * that follows it, which is what "scanning continued" means concretely.
 *
 * A number is one token or none: `0x1` used to scan as `0` then `x1`, a
 * perfectly well-formed stream for a program nobody wrote, and the parser
 * reported a missing semicolon somewhere to the right. Consuming the tail into
 * one error token puts the squiggle where the mistake is.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'the-lexer';
  let panel = null;

  const EDITS = {
    tail: { at: -6, text: '9', drop: 1, about: 'a digit near the end' },
    middle: { at: 0.5, text: ' ', drop: 0, about: 'a space inserted at the midpoint' },
    head: { at: 1, text: 'L', drop: 1, about: 'the second character of the first token' }
  };

  const NUMBER_FORMS = [
    { text: '42', why: 'a plain integer' },
    { text: '3.5', why: 'one decimal point' },
    { text: '1_000_000', why: 'separators between digits, stripped before conversion' },
    { text: '1_000.5e2', why: 'separators, a point and an exponent together' },
    { text: '2e-3', why: 'a signed exponent' },
    { text: '1.2.3', why: 'two decimal points — one error token, not "1.2 then .3"' },
    { text: '0x1', why: 'Berugo has no hex form, so this is one mistake, not two tokens' },
    { text: '1abc', why: 'a numeral running into an identifier' },
    { text: '1e', why: 'an exponent marker with no digits — the e is not consumed' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the scanner\'s modes, and how a string gets back out',
      caption: 'A scanner is a state machine, and the reason it needs more than one state is ' +
        'string interpolation: inside `${ … }` the language is Berugo again, so the scanner ' +
        'has to count braces to know where the expression ends — a record literal inside an ' +
        'interpolation contains braces of its own, and stopping at the first `}` would cut it ' +
        'in half. Every path back to `normal` emits a token. The two dashed edges are the ' +
        'failure paths, and they lead to an error TOKEN rather than out of the machine: a ' +
        'string with no closing quote ends at the newline and scanning carries on, which is ' +
        'why a file with one bad literal still yields a usable stream.',
      definition: [
        'stateDiagram-v2',
        '[*] --> normal',
        'normal --> word: letter or _',
        'word --> normal: emit name or keyword',
        'normal --> number: digit',
        'number --> normal: emit number',
        'number --> badNumber: second point, or a letter',
        'badNumber --> normal: emit error token',
        'normal --> string: quote',
        'string --> escape: backslash',
        'escape --> string: one escaped character',
        'string --> interp: dollar brace',
        'interp --> interp: nested brace',
        'interp --> string: matching close brace',
        'string --> normal: closing quote, emit string',
        'string --> unterminated: newline or end of file',
        'unterminated --> normal: emit error token',
        'normal --> trivia: space or slash slash',
        'trivia --> normal: attach to the next token'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A span on every token, not a line number.** A token records the offset it starts at ' +
        'and the offset it ends at, so a diagnostic can underline exactly the characters at ' +
        'fault and an editor can turn a click into a node. Every later stage copies spans ' +
        'forward, and the stages that synthesise nodes copy the *original* span — which is ' +
        'what stops an error message pointing at code the developer never wrote.',
      '**Trivia is attached, not discarded.** Whitespace and comments become a list on the ' +
        'token that follows them. That one decision is what lets a single lexer serve the ' +
        'compiler, the formatter and the language server; a lexer that throws trivia away has ' +
        'to be rewritten the first time somebody wants `--fix`, and by then three tools depend ' +
        'on it.',
      '**Errors are tokens, and this is the load-bearing choice.** An unterminated string ' +
        'produces an error token and scanning continues, so a file with one bad literal still ' +
        'yields a usable stream and one diagnostic rather than nothing and a stack trace. That ' +
        'is the whole reason an editor can colour a file while you are still typing it — and ' +
        'a file being typed is malformed most of the time.',
      '**Maximal munch is policy, and it has to be written down.** The operator table is sorted ' +
        'longest first, so `==` is never scanned as two `=` and `->` never as `-` then `>`. ' +
        'Leaving that implicit is the source of a great many one-character bugs, all of which ' +
        'look like parser problems.',
      '**A malformed numeral is one mistake, not two tokens.** Maximal munch stops at the first ' +
        'character a number cannot use, so `0x1` scans as `0` followed by the name `x1` — a ' +
        'perfectly well-formed stream for a program nobody wrote. The parser then complains ' +
        'about a missing semicolon several tokens to the right. Consuming the trailing ' +
        'identifier into one error token is what puts the squiggle on `0x1`.',
      '**Interpolation is why a scanner needs modes.** Inside `${ … }` the language is Berugo ' +
        'again, so the scanner counts braces rather than stopping at the first `}`. A record ' +
        'literal inside an interpolation has braces of its own, and the naive scan cuts it in ' +
        'half — producing a string that ends in the middle and an expression that starts ' +
        'nowhere.',
      '**Incremental relexing needs a safe boundary, and the boundary is a token end.** An edit ' +
        'at offset *k* cannot change any token that finished before the last token boundary at ' +
        'or before *k*. Everything earlier is reusable; everything later is rescanned. The demo ' +
        'reports how many tokens survive a one-character edit, and the answer depends entirely ' +
        'on where the edit is — which is why an editor feels fast at the end of a file and slow ' +
        'at the top.',
      '**The generated alternative is real, and this scanner is hand-written anyway.** M24 ' +
        'builds a lexer generator from regular expressions with maximal munch and priority, ' +
        'and it would produce this token set. What it would not produce is trivia attachment, ' +
        'error tokens with recovery, or interpolation modes — all three are the reasons ' +
        'production compilers hand-write the scanner and generate nothing.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — tokens, trivia, error tokens and one edit',
        markup: root.LexerTemplate.render()
      },
      diagram: diagram(),
      insight: '**Preserving trivia and emitting error tokens are the two decisions that ' +
        'decide whether one lexer serves three tools or one.** Both look like overhead while ' +
        'you are writing the scanner: trivia is a list that nothing reads yet, and error ' +
        'tokens are a code path that a correct program never takes. Both become impossible to ' +
        'retrofit the moment anything depends on the scanner, because the retrofit is not ' +
        '"add a field" — it is "every consumer now has to handle a token kind it has never ' +
        'seen, and every position it computed is off by the trivia it was silently skipping". ' +
        'The practical test is to ask, before writing the first token type, what a formatter ' +
        'would need and what an editor would need. A formatter needs every character of the ' +
        'file to be reachable from the token stream. An editor needs the stream to exist for ' +
        'a file that does not compile. Neither is a compiler requirement, and a scanner that ' +
        'meets only the compiler\'s requirements is the one that gets rewritten.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LexerTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const lexFor = root.Helpers.memoise(function (source) {
    const out = root.Berugo.Lexer.lex(source);

    return Object.assign({ summary: root.Berugo.Lexer.summary(out) }, out);
  });

  const numbersFor = root.Helpers.memoise(function () {
    return NUMBER_FORMS.map(function (form) {
      const out = root.Berugo.Lexer.lex('let n = ' + form.text + ';');
      const token = out.tokens[3];

      return { text: form.text, why: form.why, kind: token.kind,
        value: token.kind === 'number' ? String(token.value) : '—',
        float: token.kind === 'number' ? (token.float ? 'yes' : 'no') : '—',
        tokens: out.tokens.length };
    });
  });

  const relexFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const source = root.LexerTemplate.SAMPLES[parts[0]];
    const edit = editFor(source, parts[1]);

    return Object.assign({ about: EDITS[parts[1]].about, edit: edit },
      root.Berugo.Lexer.relex(root.Berugo.Lexer.lex(source), edit));
  });

  /** A relative edit position becomes two absolute offsets. */
  function editFor(source, kind) {
    const spec = EDITS[kind];
    const at = spec.at < 0 ? source.length + spec.at
      : (spec.at < 1 ? Math.floor(source.length * spec.at) : spec.at);

    return { start: at, end: at + spec.drop, text: spec.text };
  }

  function update() {
    const values = panel.values();
    const source = root.LexerTemplate.SAMPLES[values['lx-sample']];
    const lexed = lexFor(source);
    const relexed = relexFor(values['lx-sample'] + '\n' + values['lx-edit']);

    paintSource(source, lexed);
    paintMetrics(lexed, relexed);
    paintStream(lexed, values['lx-trivia']);
    paintErrors(source, lexed);
    paintNumbers();
    paintRelex(relexed);
  }

  function paintSource(source, lexed) {
    root.AstView.render(document.getElementById('lx-source'),
      root.AstView.multiMarkup(source, lexed.errors.map(function (entry) {
        return { start: entry.start, end: entry.end };
      })));

    root.Helpers.setText('lx-source-caption', lexed.summary.characters +
      ' characters. Every one of them is reachable from the token stream — a real token, or a ' +
      'piece of trivia attached to the token after it — which is the property a formatter ' +
      'needs and the one a compiler-only lexer does not bother to keep. The highlighted ' +
      'ranges, if any, are the spans of the error tokens.');
  }

  function paintMetrics(lexed, relexed) {
    root.MetricGrid.update({
      'lx-tokens': { value: root.Format.exact(lexed.summary.tokens),
        note: 'including the end-of-file token, which the parser needs to have something to ' +
          'point at when a file stops early' },
      'lx-trivia-count': { value: root.Format.exact(lexed.summary.trivia),
        note: lexed.summary.trivia + ' pieces attached to ' + lexed.summary.tokens +
          ' tokens; a lexer that dropped them would report the same token count' },
      'lx-errors': { value: root.Format.exact(lexed.summary.errors),
        note: lexed.summary.errors === 0 ? 'nothing malformed in this sample'
          : 'scanning continued past every one — the tokens after them are real' },
      'lx-reuse': { value: relexed.reused + ' of ' + relexed.total,
        note: 'the edit is ' + relexed.about + ', and rescanning may start at offset ' +
          relexed.rescannedFrom }
    });
  }

  function paintStream(lexed, showTrivia) {
    root.AstView.render(document.getElementById('lx-stream'),
      root.AstView.tokenMarkup(lexed.tokens, { trivia: showTrivia }));

    root.Helpers.setText('lx-stream-caption', streamCaption(lexed, showTrivia));
  }

  function streamCaption(lexed, showTrivia) {
    const interp = lexed.summary.interpolations;

    return (showTrivia ? 'Dashed chips are trivia: whitespace shown as ·, newlines as ⏎, and ' +
      'comments as themselves. They are attached to the token that follows them, so the ' +
      'stream still reads in source order. '
      : 'Trivia is hidden here, which is what a compiler-only lexer would hand you — the ' +
      'token stream is identical and the file can no longer be reconstructed from it. ') +
      (interp ? 'This sample has ' + interp + ' interpolation' + (interp === 1 ? '' : 's') +
        ', each scanned by counting braces so a record literal inside one survives. '
        : '') +
      'Error tokens are red and sit in the stream exactly where the bad text was.';
  }

  function paintErrors(source, lexed) {
    const rows = lexed.errors.map(function (entry) {
      const index = lexed.tokens.findIndex(function (token) {
        return token.start === entry.start && token.kind === 'error';
      });
      const next = index === -1 ? null : lexed.tokens[index + 1];
      const at = root.Berugo.Lexer.position(source, entry.start);

      return { code: entry.code, where: at.line + ':' + at.column,
        text: source.slice(entry.start, entry.end), message: entry.message,
        next: next ? next.kind + ' ' + (next.text || '(end of file)') : '—' };
    });

    root.jQuery('#lx-errors-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.code) +
        '</td><td class="mono">' + row.where + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.text) + '</td><td>' +
        root.Helpers.escapeHtml(row.message) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.next) + '</td></tr>';
    }).join('') || '<tr><td colspan="5">nothing malformed in this sample — ' +
      'switch to the malformed source to see the recovery path</td></tr>');

    root.Helpers.setText('lx-errors-table-caption',
      'The last column is the whole argument for error tokens. Every one of these is followed ' +
      'by a real token, which means the scanner did not stop — it recorded what went wrong, ' +
      'skipped exactly the bad text, and carried on. A scanner that threw would produce one ' +
      'message and no stream, and an editor showing a file with one typo would have nothing ' +
      'to colour.');
  }

  function paintNumbers() {
    const rows = numbersFor('all');
    const rejected = rows.filter(function (row) { return row.kind === 'error'; }).length;

    root.jQuery('#lx-number-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.text) +
        '</td><td class="mono">' + row.kind + '</td><td class="mono">' + row.value +
        '</td><td>' + row.float + '</td><td>' + root.Helpers.escapeHtml(row.why) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('lx-number-table-caption',
      rows.length + ' forms, ' + rejected + ' of them rejected. The interesting rows are the ' +
      'last four, because each is a form that a maximal-munch scanner will happily split into ' +
      'two valid tokens. `1e` is the exception that proves the rule: the exponent marker is ' +
      'not consumed when no digits follow it, so `1e` would be `1` then the name `e` — and ' +
      'the trailing-letter check turns it into one error token instead. Deciding which of ' +
      'these is a lexical error and which is a parse error is a real design choice, and the ' +
      'rule here is that anything that cannot be a numeral is reported where the numeral is.');
  }

  function paintRelex(relexed) {
    const rows = [
      ['Edit', relexed.about, 'one character at offset ' + relexed.edit.start],
      ['Safe boundary', String(relexed.rescannedFrom),
        'the end of the last token that finished at or before the edit'],
      ['Tokens reused', relexed.reused + ' of ' + relexed.total,
        'everything that ended before the boundary is untouched'],
      ['Rescanned', (relexed.total - relexed.reused) + ' of ' + relexed.total,
        'the rest, including the token the edit landed in'],
      ['Reuse rate', root.Format.percent(relexed.total ? relexed.reused / relexed.total : 0, 1),
        'this is why an editor feels fast at the end of a file and slow at the top']
    ];

    root.jQuery('#lx-relex-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row[1]) + '</td><td>' + root.Helpers.escapeHtml(row[2]) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('lx-relex-table-caption',
      'The reuse figure is the honest one: this implementation rescans from the boundary to ' +
      'the end of the file rather than stopping when the token stream reconverges, so the ' +
      'saving is entirely in the prefix. A production incremental lexer also detects ' +
      'convergence at the tail, which roughly doubles the reuse on an edit in the middle. ' +
      'Reporting the weaker number rather than the achievable one is the difference between ' +
      'a measurement and a brochure — and the correctness claim is separate and stronger: ' +
      'the incremental result is asserted to be identical to a full rescan, because an ' +
      'incremental lexer that drifts is worse than none.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
