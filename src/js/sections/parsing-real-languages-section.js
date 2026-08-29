/**
 * Section: parsing real languages.
 *
 * Every case in the gallery is runnable rather than described: a minimal input,
 * the parse a naive implementation produces, and the parse the language
 * actually specifies, with a control to switch between them. The six ASI cases
 * are asserted against the ECMAScript rules — `return` on its own line inserts,
 * a line starting with `(` does not — and the same comparison runs in the test
 * suite, because "JavaScript inserts semicolons sometimes" is exactly the kind
 * of claim that is right in outline and wrong in every particular.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'parsing-real-languages';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the C lexer hack feeding the symbol table back into the lexer',
      caption: 'In C, `x * y;` is a multiplication if `x` is a variable and a declaration of `y` ' +
        'as a pointer to `x` if `x` is a typedef name. Nothing in the token stream distinguishes ' +
        'them, and no context-free grammar can, because the answer depends on a declaration that ' +
        'may be thousands of lines earlier or in another file. Every C compiler solves it the ' +
        'same way: the parser, having built a symbol table entry for a typedef, tells the lexer, ' +
        'and the lexer thereafter emits `TYPE_NAME` instead of `IDENTIFIER` for that spelling. ' +
        'Note the direction of the dashed arrow — it goes backwards through the pipeline, which ' +
        'is exactly what a layered architecture is supposed to prevent, and it is not optional.',
      definition: [
        'flowchart LR',
        '    A[characters] --> B[lexer]',
        '    B -->|"IDENTIFIER or<br/>TYPE_NAME"| C[parser]',
        '    C --> D[symbol table]',
        '    D -.->|"these spellings are type<br/>names now"| B',
        '    C --> E[parse tree]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**No widely used language is context-free, and the grammar in the specification is not ' +
        'the whole story.** Each language has a handful of constructs where the parse depends on ' +
        'information the grammar cannot express, and each one shipped an engineering answer that ' +
        'breaks the clean pipeline. This section runs them.',
      '**C\'s typedef ambiguity is the oldest and the cleanest example.** `x * y;` is a ' +
        'multiplication or a declaration depending on whether `x` names a type — a fact the ' +
        'parser learns and the LEXER needs. The lexer hack pushes it backwards, which also means ' +
        'the lexer cannot run ahead of the parser and that parsing C is order-dependent in a way ' +
        'that complicates every incremental tool.',
      '**C++ made it worse in two directions.** `vector<vector<int>>` lexes its closing brackets ' +
        'as a shift operator under maximal munch, fixed in C++11 by letting the parser split the ' +
        'token; and the most vexing parse means `Widget w(Gadget());` declares a FUNCTION, ' +
        'because the standard says an ambiguity between a declaration and an expression resolves ' +
        'to the declaration. Brace initialisation exists largely to escape that rule.',
      '**Python moved its context sensitivity into the lexer and then needed a better parser ' +
        'anyway.** INDENT and DEDENT tokens handle the offside rule cleanly. Soft keywords like ' +
        '`match` do not: a word that is a keyword only in one position cannot be classified ' +
        'lexically, and CPython replaced its LL(1) parser with a PEG one in 3.9 partly for this.',
      '**JavaScript\'s automatic semicolon insertion is a recovery rule promoted to a language ' +
        'feature.** The general rule is "if the parse fails at a newline, insert a semicolon", ' +
        'plus RESTRICTED productions where a newline inserts whether or not the parse would have ' +
        'failed — after `return`, `throw`, `break`, `continue`, and before a postfix `++`. The ' +
        'demo implements exactly those rules.',
      '**The famous ASI hazards are all one shape: a line that continues when you meant it to ' +
        'end.** A line starting with `(` is read as a call on the previous line; one starting ' +
        'with `[` is read as an index. That is why some codebases begin such lines with a ' +
        'semicolon, and why `return` followed by a newline silently returns undefined rather ' +
        'than the value below.',
      '**YAML is the cautionary tale about a grammar nobody can implement twice.** The ' +
        'specification is long enough that implementations differ on real documents, and ' +
        '`country: NO` parses as the boolean false under YAML 1.1. The lesson is about ' +
        'specification complexity rather than about parsing technique: a format that needs a ' +
        'hundred pages will be implemented inconsistently.',
      '**The three general answers are scannerless parsing, GLR with semantic filters, and parse-' +
        'then-disambiguate.** Scannerless removes the lexer/parser boundary so context is ' +
        'available everywhere; GLR keeps every reading and a later pass discards the ones that ' +
        'fail a semantic check; parse-then-disambiguate builds a permissive tree and fixes it ' +
        'up. All three trade a clean architecture for correctness, which is the theme.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — break a parse, then apply what the language really does',
        markup: root.RealLanguagesTemplate.render()
      },
      diagram: diagram(),
      insight: '**Every language with a "surprising parse" bug report has one of these ' +
        'ambiguities behind it, and the fixes are all forms of feeding semantic information back ' +
        'into parsing — which is exactly what a clean architecture says you should not do.** ' +
        'That is worth sitting with, because the instinct when you meet the lexer hack is that ' +
        'C did something ugly. It did not: the ugliness is in the language, and the ' +
        'architecture is a faithful report of it. The generalisable lesson is for language ' +
        'design rather than for implementation — every construct whose meaning depends on a ' +
        'distant declaration buys expressiveness with a permanent tax on every tool anyone will ' +
        'ever write for the language, including the ones that do not exist yet. Given the ' +
        'choice, spend syntax to avoid it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RealLanguagesTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function realSource(text) {
    return String(text).split('\\n').join('\n');
  }

  const asiFor = root.Helpers.memoise(function (text) {
    return root.RealLanguages.insertSemicolons(realSource(text));
  });

  const casesFor = root.Helpers.memoise(function () {
    return root.RealLanguages.asiCases().map(function (test) {
      const out = root.RealLanguages.insertSemicolons(test.source);

      return { name: test.name, source: test.source, got: out.text,
        expected: test.expected, match: out.text === test.expected, note: test.note };
    });
  });

  function outcomeFor(values) {
    if (values['rlp-case'] === 'typedef') return typedefOutcome(values);
    if (values['rlp-case'] === 'angles') return anglesOutcome(values);
    return asiOutcome(values);
  }

  function asiOutcome(values) {
    const source = realSource(values['rlp-source']);
    const applied = asiFor(values['rlp-source']);
    const naive = source.split('\n').join(' ');

    return {
      input: source.split('\n').join(' ⏎ '),
      verdict: values['rlp-fix'] === 'applied' ? applied.text : naive,
      differs: applied.text !== naive + ' ;' && applied.text !== naive,
      feedback: 'the newline positions, which the grammar cannot see',
      inserted: applied.inserted
    };
  }

  function typedefOutcome(values) {
    const result = root.RealLanguages.classifyC('x * y ;',
      values['rlp-typedef'] === 'yes' ? ['x'] : []);

    return {
      input: 'x * y ;',
      verdict: values['rlp-fix'] === 'applied' ? result.withHack : result.naive,
      differs: result.differs,
      feedback: result.needs,
      inserted: []
    };
  }

  function anglesOutcome(values) {
    const result = root.RealLanguages.angleBrackets('vector<vector<int>>',
      values['rlp-fix'] === 'applied');

    return {
      input: 'vector<vector<int>>',
      verdict: result.tokens.join(' · ') +
        (result.balanced ? ' — balanced' : ' — ' + result.depth + ' bracket(s) never closed'),
      differs: true,
      feedback: 'that the parser is looking for a closing angle bracket right now',
      inserted: []
    };
  }

  function update() {
    const values = panel.values();
    const outcome = outcomeFor(values);
    const cases = casesFor('cases');

    paintMetrics(outcome, cases, values);
    paintResult(outcome, values);
    paintInserted(outcome);
    paintCases(cases);
    paintGallery();
    paintAnswers();
  }

  function paintMetrics(outcome, cases, values) {
    const matching = cases.filter(function (row) { return row.match; }).length;

    root.MetricGrid.update({
      'rlp-verdict': { value: outcome.verdict,
        note: values['rlp-fix'] === 'applied'
          ? 'what the language specification actually says'
          : 'what a parser built from the published grammar would do' },
      'rlp-differs': { value: outcome.differs ? 'yes' : 'no',
        note: outcome.differs
          ? 'the two readings are different programs, and only one is right'
          : 'on this input the naive parse happens to be correct — which is why the bug hides' },
      'rlp-feedback': { value: outcome.feedback,
        note: 'information the parser needs and the grammar cannot carry' },
      'rlp-cases': { value: root.Format.exact(matching) + ' of ' +
        root.Format.exact(cases.length),
      note: matching === cases.length
        ? 'every case matches the ECMAScript rules, asserted in the test suite'
        : 'a case disagrees with the specification' }
    });
  }

  function paintResult(outcome, values) {
    root.jQuery('#rlp-result').html(
      '<div>input: ' + root.Helpers.escapeHtml(outcome.input) + '</div>' +
      '<div style="margin-top:.4rem">fix ' +
      (values['rlp-fix'] === 'applied' ? 'applied' : 'off') + ': ' +
      root.Helpers.escapeHtml(outcome.verdict) + '</div>');

    root.Helpers.setText('rlp-result-note',
      'Switch the fix control and read the two lines together. For the ASI case with the source ' +
      '`return\\n1`, the naive reading is `return 1` and the specified reading is `return ; 1 ;` ' +
      '— a function that returns undefined and then evaluates a pointless expression. Nothing ' +
      'about that is a parse error; both are well-formed programs and the specification picks ' +
      'the surprising one. That is the shape every case in this section takes.');
  }

  function paintInserted(outcome) {
    root.jQuery('#rlp-inserted tbody').html(outcome.inserted.map(function (entry) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(entry.after) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(entry.before) + '</td><td>' +
        root.Helpers.escapeHtml(entry.rule) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td>' +
      '<td>this case does not insert anything — switch to the JavaScript one</td></tr>');

    root.Helpers.setText('rlp-inserted-note',
      'Two of the three rules are conditional and one is not, which is the distinction worth ' +
      'carrying away. "The parse would fail here" is the general rule and it is benign: it ' +
      'inserts where a semicolon was obviously intended. The RESTRICTED productions insert ' +
      'whether or not the parse would have failed, which is why `return` on its own line is ' +
      'silently wrong rather than a syntax error — the parse would have succeeded and the ' +
      'specification overrode it.');
  }

  function paintCases(cases) {
    root.jQuery('#rlp-asi tbody').html(cases.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.name) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.source.split('\n').join(' ⏎ ')) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.got) + '</td><td class="mono">' +
        (row.match ? 'yes' : 'NO — expected ' + row.expected) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rlp-asi-note',
      'Rows three and four are the ones that cost people afternoons. A line beginning with `(` ' +
      'or `[` does NOT get a semicolon before it, because the parse continues perfectly well — ' +
      'the previous line becomes a call or an index. That is the entire reason for the ' +
      'defensive leading semicolon you see at the start of some minified files and some ' +
      'style guides. Rows one and two are the restricted productions, and row five is the ' +
      'reassuring case: an operator at the end of a line means the expression continues, so ' +
      'wrapping a long expression is safe.');
  }

  function paintGallery() {
    root.jQuery('#rlp-gallery tbody').html(root.RealLanguages.gallery().map(function (entry) {
      return '<tr><td class="mono">' + entry.language + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.construct) + '<br><span style="opacity:.7">' +
        root.Helpers.escapeHtml(entry.input) + '</span></td><td>' +
        root.Helpers.escapeHtml(entry.naive) + '</td><td>' +
        root.Helpers.escapeHtml(entry.fix) + '<br><span style="opacity:.7">cost: ' +
        root.Helpers.escapeHtml(entry.cost) + '</span></td></tr>';
    }).join(''));

    root.Helpers.setText('rlp-gallery-note',
      'Read the cost lines down the last column. Every one of them is a dependency pointing the ' +
      'wrong way through the pipeline, or a rule that makes a well-formed program mean something ' +
      'other than it looks like. That is not a coincidence and it is not carelessness: each of ' +
      'these languages made a syntax decision that people liked, and the tax fell on the ' +
      'implementers and on everyone who ever writes a tool for the language. The YAML row is ' +
      'the outlier — its cost is borne by users, who have to quote strings defensively forever.');
  }

  function paintAnswers() {
    const rows = [
      { answer: 'The lexer hack', how: 'the parser tells the lexer which names are types',
        cost: 'the lexer depends on the parser, and on declaration order',
        used: 'every C and C++ compiler' },
      { answer: 'Scannerless parsing', how: 'no lexer at all — the grammar goes down to characters',
        cost: 'much larger grammars, and whitespace handling everywhere',
        used: 'SDF/Rascal, some PEG tools, tree-sitter in part' },
      { answer: 'GLR with semantic filters',
        how: 'keep every reading, discard the ones a later check rejects',
        cost: 'the parse tree is a forest until the filter runs',
        used: 'Elkhound for C++, several research front ends' },
      { answer: 'Parse then disambiguate',
        how: 'a permissive grammar, then a pass that fixes the tree',
        cost: 'the permissive grammar accepts programs the language does not',
        used: 'most hand-written front ends, including Clang' },
      { answer: 'Lexer modes and stacks',
        how: 'the lexer keeps its own context stack',
        cost: 'the lexer is now a pushdown machine, not a regular one',
        used: 'JavaScript template literals, Python f-strings, every heredoc' },
      { answer: 'Change the language',
        how: 'add syntax so the ambiguity cannot arise',
        cost: 'a breaking change, or a second way to write the same thing',
        used: 'C++11 brace initialisation, Python soft keywords, Rust turbofish' }
    ];

    root.jQuery('#rlp-answers tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.answer + '</td><td>' + row.how + '</td><td>' +
        row.cost + '</td><td>' + row.used + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rlp-answers-note',
      'The last row is the only one that removes the problem rather than paying for it, and it ' +
      'is available exactly once — while the language is still young. Rust\'s turbofish `::<>` ' +
      'is the cleanest example: it exists purely because `a < b > (c)` is ambiguous between a ' +
      'comparison and a generic call, and rather than a lexer hack or a GLR filter Rust spent ' +
      'four characters of syntax and the ambiguity does not exist. People complain about how it ' +
      'looks. It is the cheapest fix on this table by a wide margin.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
