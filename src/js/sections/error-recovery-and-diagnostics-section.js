/**
 * Section: error recovery and diagnostics.
 *
 * The measurement is the pair (diagnostics, survivors). A file with three
 * independent mistakes should produce three diagnostics — not one, and not
 * eleven — and the valid declarations around them should still be in the tree.
 * The three strategies produce 1/1, 3/4 and 3/5 on the same source, which is the
 * whole argument in six numbers: stopping loses everything after the first
 * error, panic mode recovers the rest, and repair additionally recovers the
 * statement the error was IN.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'error-recovery-and-diagnostics';
  const SOURCES = {
    three: null,
    missing: 'let a = 1 let b = 2 ;',
    cascade: 'let = = = ; print + + + ;',
    clean: null
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
      title: 'Diagram — the decision at a syntax error',
      caption: 'Detecting the error is the easy half and it is where a textbook parser stops. ' +
        'Everything below the first box is recovery, and the branches are genuinely different ' +
        'products: stopping gives you a compiler that reports one error per run, panic mode ' +
        'gives you a compiler, and repair plus cascade suppression gives you a language server. ' +
        'The suppression test on the right is what stops one missing brace from producing a ' +
        'page of diagnostics — a second error within a couple of tokens of the first is almost ' +
        'always the first one echoing, so it is counted and not shown.',
      definition: [
        'flowchart TD',
        '    A[no table entry for this token] --> B[report a diagnostic]',
        '    B --> C{strategy?}',
        '    C -->|stop| D[give up: one error per run]',
        '    C -->|panic| E[skip tokens to a synchronising one]',
        '    C -->|repair| F{can one insertion or deletion continue?}',
        '    F -->|yes| G[apply the cheapest repair and carry on]',
        '    F -->|no| E',
        '    E --> H{another error within the window?}',
        '    G --> H',
        '    H -->|yes| I[count it as a cascade and do not report]',
        '    H -->|no| J[report it]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Detecting an error and recovering from one are different problems, and only the first ' +
        'is in the parsing literature.** Detection falls out of the table: there is no entry, so ' +
        'the input is not in the language. Recovery is the engineering question of what to do ' +
        'next, and it is what separates a parser from a usable tool.',
      '**A parser that stops at the first error is unusable in an editor.** An editor reparses ' +
        'on every keystroke, and most of those parses are of a file that is mid-edit and ' +
        'therefore broken. If the parser gives up at the first problem, completion, go-to-' +
        'definition and type information all vanish for the rest of the file — which is exactly ' +
        'when you need them.',
      '**Panic mode is the cheap, robust strategy: discard tokens until a synchronising one.** ' +
        'The synchronising set is what makes it work — tokens like `;` and the statement ' +
        'keywords, where the parser knows where it is regardless of what came before. Resuming ' +
        'there cannot produce a second bogus error, and everything between is silently lost.',
      '**Phrase-level recovery and repair do better and cost more.** Try inserting or deleting a ' +
        'single token, score the options with a cost model, and continue with the cheapest one ' +
        'that gets the parser moving. The demo\'s model makes insertion cheaper than deletion, ' +
        'because a missing token is the more common typo — and that ordering IS the cost model, ' +
        'which is the honest size of most real ones.',
      '**Error productions put the recovery in the grammar.** Adding `statement → error ;` to a ' +
        'yacc grammar tells the generator to accept a broken statement and resynchronise at the ' +
        'semicolon. It is precise, it is maintained alongside the grammar, and it only covers ' +
        'the mistakes you thought of.',
      '**Cascade suppression is half the perceived quality.** One missing brace makes every ' +
        'following construct look wrong, and a parser that reports each one produces a wall of ' +
        'noise where the first line is the only useful one. The rule that works is a window: a ' +
        'second error within a few tokens of the first is counted and not reported. The demo ' +
        'makes the window a control so you can watch the diagnostic count change with it.',
      '**Incremental reparsing is what makes an editor feel instant.** After an edit, reuse the ' +
        'subtrees the edit did not touch and reparse only the affected span. Tree-sitter is the ' +
        'well-known implementation, and it is why syntax highlighting in a modern editor does ' +
        'not stutter on a large file.',
      '**A useful message has three parts: where, what was expected, and what to do.** The ' +
        'location comes from the token position, the expectation comes free from the parse ' +
        'table row, and the suggestion is the part you have to write. Most parsers ship the ' +
        'first, half of the second and none of the third.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — three strategies on one broken file',
        markup: root.RecoveryTemplate.render()
      },
      diagram: diagram(),
      insight: '**A parser that stops at the first error is unusable in an editor; recovery ' +
        'quality is what turns a parser into a language server, and it is the part that never ' +
        'appears in a parsing course.** Notice which numbers the demo moves. The parsing ' +
        'technique — LL, LR, PEG, Pratt — changes none of them; the recovery strategy changes ' +
        'all of them. That is a fair summary of where the engineering effort in a modern front ' +
        'end actually goes: the parser is a week and the diagnostics are a year. If you are ' +
        'choosing a parsing approach for a language people will edit, weight it by how easy ' +
        'recovery is to write, which is one more argument for hand-written recursive descent — ' +
        'you can put the recovery exactly where the language needs it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RecoveryTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function sourceFor(name) {
    if (name === 'three') return root.ErrorRecovery.threeErrors();
    if (name === 'clean') return root.ErrorRecovery.clean();
    return SOURCES[name];
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.ErrorRecovery.parse(sourceFor(parts[0]), parts[1],
      { window: Number(parts[2]) });
  });

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.ErrorRecovery.STRATEGIES.map(function (strategy) {
      const result = root.ErrorRecovery.parse(sourceFor(parts[0]), strategy,
        { window: Number(parts[1]) });

      return { strategy: strategy, errors: result.errors, suppressed: result.suppressed,
        survived: result.survived, repairs: result.repairs.length };
    });
  });

  function update() {
    const values = panel.values();
    const key = values['erc-source'] + '\n' + values['erc-strategy'] + '\n' +
      values['erc-window'];
    const state = runFor(key);

    paintMetrics(state);
    paintSource(values['erc-source'], state);
    paintDiagnostics(state);
    paintCompare(values['erc-source'] + '\n' + values['erc-window']);
    paintSurvivors(state);
    paintQuality();
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'erc-errors': { value: root.Format.exact(state.errors),
        note: state.stopped
          ? 'the parser gave up here, so everything after the first error is unexamined'
          : 'each one is a distinct position the parser could not continue from' },
      'erc-suppressed': { value: root.Format.exact(state.suppressed),
        note: state.suppressed
          ? 'errors within the window of a reported one, counted rather than shown'
          : 'nothing was close enough to a previous error to look like an echo' },
      'erc-survived': { value: root.Format.exact(state.survived),
        note: 'complete declarations still in the tree — what completion and go-to-definition ' +
          'would still have' },
      'erc-repairs': { value: root.Format.exact(state.repairs.length),
        note: state.repairs.length
          ? state.repairs.map(function (repair) {
            return repair.kind + ' ' + repair.token;
          }).join(', ')
          : 'this strategy applies none' }
    });
  }

  function paintSource(name, state) {
    const source = sourceFor(name);
    const positions = {};

    state.diagnostics.forEach(function (diagnostic) { positions[diagnostic.at] = true; });
    root.jQuery('#erc-source-view').html(source.split('\n').map(function (line, i) {
      return root.Helpers.escapeHtml((i + 1) + ': ' + line);
    }).join('<br>'));

    root.Helpers.setText('erc-source-note',
      'The three-error sample is the acceptance criterion made concrete: `let b 2 ;` is missing ' +
      'its `=`, `let c = ;` is missing its value, and `print + ;` starts an expression with an ' +
      'operator. Four statements around them are perfectly valid. The right answer is three ' +
      'diagnostics and four surviving declarations, and only one of the three strategies gets ' +
      'both — with repair getting five, because it reconstructs the statement the first error ' +
      'was in.');
  }

  function paintDiagnostics(state) {
    root.jQuery('#erc-diagnostics tbody').html(state.diagnostics.map(function (diagnostic) {
      return '<tr><td class="mono">' + diagnostic.at + '</td><td>' +
        root.Helpers.escapeHtml(diagnostic.message) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(diagnostic.expected) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(diagnostic.found) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td>no diagnostics</td>' +
      '<td class="mono">—</td><td class="mono">—</td></tr>');

    root.Helpers.setText('erc-diagnostics-note',
      'The expected column is free — it is whatever the parser was about to demand when it ' +
      'failed, which the parse table or the recursive-descent call site already knows. That is ' +
      'the cheapest quality improvement available to any parser and a surprising number of ' +
      'tools throw it away, reporting "syntax error" when they are holding the exact list of ' +
      'tokens that would have worked. The `found` column costs nothing either.');
  }

  function paintCompare(key) {
    root.jQuery('#erc-compare tbody').html(compareFor(key).map(function (row) {
      return '<tr><td class="mono">' + row.strategy + '</td><td class="mono">' + row.errors +
        '</td><td class="mono">' + row.suppressed + '</td><td class="mono">' + row.survived +
        '</td><td class="mono">' + row.repairs + '</td></tr>';
    }).join(''));

    root.Helpers.setText('erc-compare-note',
      'Read the first and fourth columns together. Stopping reports one error and keeps one ' +
      'declaration: everything after the first mistake is invisible, which in an editor means ' +
      'the file goes dark below the cursor. Panic mode reports all three and keeps four, losing ' +
      'only the statements the errors were in. Repair reports the same three and keeps five, ' +
      'because inserting the missing `=` reconstructs the statement rather than discarding it. ' +
      'That last declaration is the difference between "there is an error here" and "there is ' +
      'an error here, and `b` is still a variable you can rename".');
  }

  function paintSurvivors(state) {
    root.jQuery('#erc-survivors tbody').html(state.declarations.map(function (declaration) {
      return '<tr><td class="mono">' + declaration.kind + '</td><td class="mono">' +
        root.Helpers.escapeHtml(declaration.name || '—') + '</td><td class="mono">' +
        root.Helpers.escapeHtml(declaration.value) + '</td><td>' +
        (declaration.name ? 'completion, rename, go-to-definition'
          : 'expression type information') + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">none</td>' +
      '<td class="mono">—</td><td>nothing survived the error</td></tr>');

    root.Helpers.setText('erc-survivors-note',
      'This is the test that matters and the one that is usually not written. "The parser did ' +
      'not crash" is not a recovery test; "the file with three errors still yields the four ' +
      'declarations that are correct" is, because that is the property the editor experience ' +
      'depends on. Write it as an assertion on the tree, and a regression in recovery becomes a ' +
      'failing test rather than a bug report about completion being flaky.');
  }

  function paintQuality() {
    const rows = [
      { element: 'Location', bad: 'the line the parser gave up on',
        good: 'the token, with the enclosing construct named',
        where: 'the token position, kept through recovery' },
      { element: 'Expectation', bad: '"syntax error"',
        good: '"expected `;` or `else`"',
        where: 'the parse table row, or the recursive-descent call site — free either way' },
      { element: 'What was found', bad: 'omitted',
        good: '"found `}`"', where: 'the current token — also free' },
      { element: 'Suggestion', bad: 'none',
        good: '"insert `;` after the return value"',
        where: 'the repair the parser applied, reported instead of hidden' },
      { element: 'Count', bad: '47 errors from one missing brace',
        good: '1 error, and a note that 46 more were suppressed',
        where: 'the cascade window' },
      { element: 'Ordering', bad: 'source order, so the cause may be third',
        good: 'the first error first, and it is usually the cause',
        where: 'reporting in parse order and suppressing the echoes' }
    ];

    root.jQuery('#erc-quality tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.element + '</td><td>' +
        root.Helpers.escapeHtml(row.bad) + '</td><td>' +
        root.Helpers.escapeHtml(row.good) + '</td><td>' + row.where + '</td></tr>';
    }).join(''));

    root.Helpers.setText('erc-quality-note',
      'The fourth column is the argument. Three of these six cost nothing — the parser already ' +
      'has the position, the expected set and the current token, and throwing them away takes ' +
      'active effort. The other three are the work: a suggestion means reporting the repair you ' +
      'applied rather than silently applying it, suppression means tracking the last error ' +
      'position, and ordering means trusting the first diagnostic. None of it is research; all ' +
      'of it is the difference between a compiler people tolerate and one they like.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
