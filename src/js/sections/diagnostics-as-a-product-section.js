/**
 * Section: Diagnostics as a product.
 *
 * The measurement is the error suite. Twelve programs, each containing exactly
 * one mistake, each of which must produce exactly one diagnostic with the
 * right code. Before the suppression rules existed, the suite produced fifteen
 * diagnostics for twelve mistakes — and every extra one was TRUE. A string
 * with no closing quote really does leave an expression the parser cannot
 * read. Truth is not the bar; being the message the reader needs is.
 *
 * The three rules and their counts are all reported, and each can be switched
 * off, because a suppression you cannot inspect is indistinguishable from a
 * compiler that failed to notice.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'diagnostics-as-a-product';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an editor request, answered from cached stages',
      caption: 'Every editor feature in this section is a lookup, not an analysis. A keystroke ' +
        'invalidates the stages downstream of it and the rest are reused; a hover reads the ' +
        'type table; go-to-definition and rename read the binding table; completion reads the ' +
        'scope tree. That is the payoff for having produced tables in 28.5 and 28.6 rather ' +
        'than verdicts. Diagnostics are the one path that touches every stage, because a ' +
        'diagnostic can come from any of them — and it is also the path that has to decide ' +
        'which of them to believe, which is what the suppression box is doing.',
      definition: [
        'graph TD',
        'K["a keystroke"] --> C{"cached stages still valid?"}',
        'C -->|"no"| L["lex"]',
        'C -->|"yes"| R["reuse"]',
        'L --> P["parse"]',
        'P --> RS["resolve — binding table"]',
        'RS --> T["typecheck — type table"]',
        'T --> D["collect diagnostics from every stage"]',
        'D --> S["suppress: gate, contain, dedupe"]',
        'S --> UI["squiggles"]',
        'RS --> GD["go to definition · rename · completion"]',
        'T --> HV["hover"]',
        'S --> FX["quick fixes"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A compiler that reports every consequence of one mistake is worse than one that ' +
        'reports nothing**, because the reader has to work out which of eleven messages is the ' +
        'cause. The error suite makes that testable: every program in it contains exactly one ' +
        'mistake and must produce exactly one diagnostic. Two of the twelve produced three and ' +
        'two before the rules below existed.',
      '**Every extra message was TRUE, and that is the point.** A string with no closing quote ' +
        'really does leave an expression the parser cannot read, and really does leave a ' +
        'statement with no semicolon. Truth is not the bar. Suppression is not about hiding ' +
        'wrong answers, it is about deciding which true answer the reader needs.',
      '**Stage gating is the rule that does most of the work.** A later stage\'s diagnostics ' +
        'are dropped when an earlier stage reported anything, because names resolved against a ' +
        'tree with an error node in it, and types inferred from those names, are guesses about ' +
        'a program that was never read correctly. Real compilers do exactly this: they do not ' +
        'type-check a file with parse errors.',
      '**Containment and duplication are the other two, and they are cheaper.** Within a ' +
        'stage, a diagnostic whose span sits inside an earlier one\'s is the same mistake seen ' +
        'from further in; the same code at the same span is the same message twice. Both are a ' +
        'few lines and both are reported separately, so it is visible which rule earned what.',
      '**Every drop is counted and kept.** The demo shows the suppressed diagnostics with the ' +
        'rule that removed each one, and each rule can be switched off. A suppression you ' +
        'cannot inspect is indistinguishable from a compiler that failed to notice — and the ' +
        'difference matters the first time a rule suppresses something it should not have.',
      '**A machine-applicable fix is an edit the compiler will apply without asking, and that ' +
        'bar is higher than "a plausible repair".** Every fix here is derived from a table the ' +
        'compiler already has: the binding table for a misspelled name, the grammar for a ' +
        'missing token. Where no table answers, there is no fix rather than a guess.',
      '**A fix is verified by applying it and rechecking.** The demo applies each one and ' +
        'reports two things separately: whether the diagnostic it was offered for is gone, and ' +
        'whether the file is now clean. They are different questions — a source can hold two ' +
        'mistakes — and conflating them would either overstate the fixes or reject correct ones.',
      '**Hover, go-to-definition, completion and rename are lookups in tables that already ' +
        'exist.** None of them is a new analysis. That is the return on having produced a ' +
        'binding table in 28.5 and a type table in 28.6 instead of verdicts, and it is why the ' +
        'honest test of a compiler\'s name resolution is to ask it for a definition: if it ' +
        'cannot answer without running the type checker, resolution is not a data structure.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — three suppression rules, quick fixes, and an editor',
        markup: root.DiagnosticsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Go-to-definition and rename fall out of the resolution table for free; if a ' +
        'compiler cannot answer them, its name resolution is not a data structure, and ' +
        'everything else will be harder too.** That is a diagnostic test you can run on any ' +
        'compiler in about a minute, and it predicts a surprising amount. A compiler that ' +
        'resolves names inline in the checker can still produce excellent error messages — for ' +
        'a while — but it cannot answer "where is this defined" without re-running a pass, ' +
        'cannot rename correctly under shadowing without a second implementation of scoping, ' +
        'and cannot tell an optimiser whether two names are the same binding. Each of those ' +
        'arrives as a separate project, each is quietly a rewrite, and each is discovered ' +
        'after the architecture has hardened. The counterpart on the diagnostics side is ' +
        'cascade suppression: it is three rules and about forty lines, it converts fifteen ' +
        'messages into twelve, and it is impossible to add convincingly at the end — because ' +
        'by then nobody can say which of the fifteen was the cause, and the only way to find ' +
        'out is the error suite that should have existed from the start.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DiagnosticsTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /**
   * The memoise key is JSON, not a delimited string. A key built by joining
   * source code to other values needs a separator the source cannot contain,
   * and there is no such character: a newline appears in every program, and
   * the invisible one this used instead is exactly the kind of thing that
   * survives review and breaks later. JSON needs no separator at all.
   */
  const analyseFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const source = parts[0];
    const options = parts[1];
    const analysis = root.Berugo.Ide.analyse(source);

    return { source: source, analysis: analysis,
      spots: analysis.tokens.filter(function (token) { return token.kind === 'name'; }),
      reported: root.Berugo.Diagnostics.suppress(analysis.raw, options) };
  });

  const fixesFor = root.Helpers.memoise(function () {
    return root.Berugo.Pipeline.fixSuite();
  });

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Pipeline.errorSuite();
  });

  /**
   * One session across the whole demo, so the recheck metric measures
   * something real: switching a suppression rule does not change the source,
   * so the analysis is reused, and changing the sample reruns every stage.
   */
  const session = root.Berugo.Ide.session();

  function update() {
    const values = panel.values();
    const source = root.DiagnosticsTemplate.SAMPLES[values['dx-sample']];
    const options = { gate: values['dx-gate'], contain: values['dx-contain'],
      dedupe: values['dx-dedupe'] };
    const state = analyseFor(JSON.stringify([source, options]));
    const tick = session.update(source);

    paintSource(state);
    paintMetrics(state, tick);
    paintRendered(state);
    paintAll(state);
    paintFixes();
    paintEditor(state, Number(values['dx-editor']));
    paintSuite();
  }

  function paintSource(state) {
    root.AstView.render(document.getElementById('dx-source'),
      root.AstView.multiMarkup(state.source, state.reported.kept.map(function (entry) {
        return entry.span;
      })));

    root.Helpers.setText('dx-source-caption', state.reported.kept.length
      ? state.reported.kept.length + ' range' + (state.reported.kept.length === 1 ? '' : 's') +
        ' would be underlined, out of ' + state.reported.total + ' the stages produced. Turn ' +
        'a rule off and watch the extra squiggles appear — every one of them is true, and ' +
        'every one of them is a consequence of a mistake already marked.'
      : 'Nothing is underlined: this file has no diagnostics. That is also worth seeing, ' +
        'because the machinery still ran — the tables exist, and hover and go-to-definition ' +
        'work on it.');
  }

  function paintMetrics(state, tick) {
    const counts = state.reported.counts;

    root.MetricGrid.update({
      'dx-raw': { value: root.Format.exact(state.reported.total),
        note: 'collected from the parser, the resolver and the type checker' },
      'dx-reported': { value: root.Format.exact(state.reported.kept.length),
        note: state.reported.primary ? state.reported.primary.code + ' is the primary one'
          : 'this file is clean' },
      'dx-suppressed': { value: root.Format.exact(state.reported.dropped.length),
        note: counts.stage + ' by stage gating, ' + counts.contained + ' contained, ' +
          counts.duplicate + ' duplicate' },
      'dx-recheck': { value: tick.reused ? '0 of 4' : '4 of 4',
        note: tick.reused
          ? 'the source did not change, so the whole analysis was reused'
          : 'the source changed, so every stage ran again' }
    });
  }

  function paintRendered(state) {
    const html = state.reported.kept.slice(0, 6).map(function (entry) {
      return root.AstView.diagnosticMarkup(
        root.Berugo.Diagnostics.format(entry, state.source));
    }).join('');

    root.AstView.render(document.getElementById('dx-rendered'),
      html || '<p class="note">Nothing to report.</p>');

    root.Helpers.setText('dx-rendered-caption',
      'A caret run under exactly the characters at fault, which is what the span was for — and ' +
      'why a span with no end is a bug rather than an untidiness: it produces a diagnostic ' +
      'that underlines nothing and nobody notices. The note under each message is the rule, ' +
      'not the instance: it says what the compiler requires, so a reader who has not met this ' +
      'code before learns the rule as well as the location.');
  }

  function paintAll(state) {
    const rows = state.reported.kept.map(function (entry) {
      return { entry: entry, kept: true, by: '' };
    }).concat(state.reported.dropped.map(function (entry) {
      return { entry: entry, kept: false, by: entry.droppedBy };
    }));

    root.jQuery('#dx-all tbody').html(rows.map(function (row) {
      const at = root.Berugo.Lexer.position(state.source, row.entry.span.start);

      return '<tr><td>' + row.entry.stage + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.entry.code) + '</td><td class="mono">' + at.line + ':' +
        at.column + '</td><td>' + root.Helpers.escapeHtml(row.entry.message) + '</td><td>' +
        (row.kept ? 'yes' : 'no') + '</td><td>' + root.Helpers.escapeHtml(row.by || '—') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="6">this file produced no diagnostics at all</td></tr>');

    root.Helpers.setText('dx-all-caption', allCaption(state));
  }

  function allCaption(state) {
    const counts = state.reported.counts;

    return 'Every diagnostic every stage produced, kept or dropped, with the rule responsible. ' +
      'Read the dropped rows and notice that each is TRUE — that is what makes this hard. ' +
      'Stage gating removed ' + counts.stage + ' here, containment ' + counts.contained +
      ' and deduplication ' + counts.duplicate + '. Keeping the dropped ones rather than ' +
      'discarding them is what lets a rule be audited when it eventually suppresses something ' +
      'it should not have, and it costs one array.';
  }

  function paintFixes() {
    const suite = fixesFor('all');

    root.jQuery('#dx-fixes tbody').html(suite.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td>' + root.Helpers.escapeHtml(row.title) + '</td><td>' +
        (row.removed ? 'yes' : 'NO') + '</td><td>' + (row.clean ? 'yes' : 'no') +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.fixed) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dx-fixes-caption',
      suite.offered + ' of the ' + root.Berugo.Spec.ERROR_SUITE.length + ' error programs get ' +
      'a fix, ' + suite.removed + ' of those remove the diagnostic they were offered for, and ' +
      suite.clean + ' leave the file entirely clean. The two columns are deliberately ' +
      'separate. Closing an unterminated string removes E-LEX-STRING and leaves the statement ' +
      'still missing its semicolon — the fix is correct and the file has a second mistake in ' +
      'it. Reporting only "file clean" would mark a correct fix as a failure; reporting only ' +
      '"diagnostic removed" would let a fix that breaks the file pass. The other nine ' +
      'programs get no fix at all, because no table the compiler has answers them, and ' +
      'guessing is how a quick fix becomes something people turn off.');
  }

  function paintEditor(state, cursor) {
    const spots = state.spots;
    const spot = spots[Math.min(cursor, spots.length - 1)];
    const rows = spot ? editorRows(state.analysis, spot) : [];

    root.jQuery('#dx-editor-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row[1]) + '</td><td>' + root.Helpers.escapeHtml(row[2]) +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3">no identifier at this position</td></tr>');

    root.Helpers.setText('dx-editor-table-caption',
      'Four requests, four table lookups, no new analysis. Every one of these is what a ' +
      'language server answers on a keystroke, and every one of them is available because ' +
      '28.5 and 28.6 produced tables rather than verdicts. Note that they answer on a file ' +
      'that does not compile — which is the normal state of a file being edited, and the ' +
      'reason the parser had to be total.');
  }

  function editorRows(analysis, spot) {
    const hover = root.Berugo.Ide.hover(analysis, spot.start);
    const definition = root.Berugo.Ide.definition(analysis, spot.start);
    const references = root.Berugo.Ide.references(analysis, spot.start);
    const completions = root.Berugo.Ide.completions(analysis, spot.start);

    return [
      ['Hover on `' + spot.value + '`', hover ? (hover.kind + ' : ' + (hover.type || 'unknown'))
        : 'nothing', 'the type table'],
      ['Go to definition', definition ? definition.kind + ' at offset ' + definition.span.start
        : 'unresolved', 'the binding table'],
      ['Find all references', references.length + ' occurrence' +
        (references.length === 1 ? '' : 's'), 'the binding table, keyed by occurrence'],
      ['Completion here', completions.names.slice(0, 8).join(', ') +
        (completions.names.length > 8 ? ', …' : ''), 'the scope tree']
    ];
  }

  function paintSuite() {
    const suite = suiteFor('all');

    root.jQuery('#dx-suite tbody').html(suite.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.id) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.expected) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.got || 'none') + '</td><td class="mono">' + row.reported +
        '</td><td class="mono">' + row.suppressed + '</td><td>' + (row.ok ? 'yes' : 'NO') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('dx-suite-caption',
      suite.passed + ' of ' + suite.total + ' programs produce exactly one diagnostic with ' +
      'exactly the expected code. The stages produced ' + suite.raw + ' diagnostics for ' +
      suite.total + ' mistakes and ' + suite.reported + ' were reported, so ' +
      (suite.raw - suite.reported) + ' were cascade. That difference is the entire measurable ' +
      'value of the suppression rules, and it is small on purpose: this is a compiler whose ' +
      'stages already recover well. On a compiler that reports every consequence, the same ' +
      'twelve programs would produce dozens.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
