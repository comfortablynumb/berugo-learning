/**
 * Section: automata in production.
 *
 * Two measurements, both of them things a CI job could run. The scanner
 * reports every maximal-munch decision including the shorter matches it passed
 * over, so `>>=` coming back as one token rather than three is visible rather
 * than asserted. And the ReDoS analyser is checked against a set of patterns
 * with known verdicts, then the flagged ones are actually attacked: a
 * backtracking matcher and an NFA simulation both run on the generated string
 * and their step counts are compared.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'automata-in-production';
  const REPEATS = [4, 8, 12, 16];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a statechart with a nested region and a history state',
      caption: 'A statechart is a finite automaton with three additions that make large ones ' +
        'writable. Hierarchy: a transition drawn on the parent applies to every child, so ' +
        '"cancel returns to idle" is one arrow instead of one per state. Orthogonal regions: ' +
        'two independent machines run side by side rather than multiplying into a product, which ' +
        'is what stops three booleans becoming eight states. History: re-entering a region ' +
        'resumes where it left off rather than restarting. None of it adds power — a statechart ' +
        'flattens to an ordinary automaton — and all of it adds writability.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> Idle',
        '    Idle --> Working : start',
        '    state Working {',
        '      [*] --> Loading',
        '      Loading --> Ready : loaded',
        '      Ready --> Saving : save',
        '      Saving --> Ready : saved',
        '    }',
        '    Working --> Idle : cancel',
        '    Working --> Suspended : suspend',
        '    Suspended --> Working : resume (history)'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A lexer is a set of automata run in lockstep plus two rules.** Maximal munch takes the ' +
        'longest match at each position; priority breaks ties by declaration order. Everything ' +
        'else about tokenising is bookkeeping.',
      '**Maximal munch means scanning PAST a match that already succeeded.** `>>` matches after ' +
        'two characters and `>>=` after three, so a scanner that stops at the first success ' +
        'produces the wrong tokens. The demo lists the shorter matches it passed over at every ' +
        'position.',
      '**Priority is why `if` is a keyword and not an identifier.** Both rules match the same ' +
        'text with the same length, and the earlier declaration wins. Reordering the rule list ' +
        'silently changes the language, which is why generated lexers put keywords first by ' +
        'construction.',
      '**A rule that matches the empty string loops forever.** The scanner treats a zero-length ' +
        'match as an error rather than consuming it, which is the failure mode of a rule list ' +
        'written with `a*` where `a+` was meant.',
      '**Protocol state machines and UI statecharts are the same object.** TCP\'s connection ' +
        'states, an OAuth flow and a form wizard are all finite automata; statecharts add ' +
        'hierarchy, orthogonal regions and history so that large ones stay writable without ' +
        'adding any power.',
      '**Table-driven or code-generated is a real trade.** A transition table is data — small, ' +
        'inspectable, changeable at runtime — and a generated switch is faster and lets the ' +
        'compiler check exhaustiveness. Lexer generators choose tables; hand-written protocol ' +
        'code usually chooses switches.',
      '**ReDoS is a structural property, so it can be a CI check.** Two shapes cause it: a ' +
        'repetition whose body is itself a repetition, and a repetition over alternatives that ' +
        'overlap. The demo detects both and is checked against nine patterns with known ' +
        'verdicts, including one that LOOKS dangerous and is not.',
      '**And the blow-up is measured, not described.** For a flagged pattern the demo generates ' +
        'an attack string and runs both a backtracking matcher and an NFA simulation on it, ' +
        'counting steps. The simulation stays linear while the backtracker goes exponential, ' +
        'which is the whole argument for RE2-style engines.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — tokenise a line, then flag and attack a pattern',
        markup: root.ProductionTemplate.render()
      },
      diagram: diagram(),
      insight: '**The ReDoS analysis is mechanical: a star over an ambiguous sub-expression is ' +
        'the structure to search for, and it can be a CI check rather than an incident.** That ' +
        'is unusual for a security property. Most of them need a threat model, a judgement call ' +
        'and a reviewer who already knows the failure; this one is a graph search over the ' +
        'pattern you already have in your repository. The demo runs it over nine patterns and ' +
        'gets nine right answers, including one that looks dangerous and is not — and then ' +
        'proves the flagged ones by generating a string that measurably explodes a backtracking ' +
        'matcher while the simulation walks past it in linear time.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ProductionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const scannerFor = root.Helpers.memoise(function () {
    return root.LexerGen.build(root.LexerGen.sampleRules());
  });

  const scanFor = root.Helpers.memoise(function (source) {
    return root.LexerGen.scan(scannerFor(''), source);
  });

  const analyseFor = root.Helpers.memoise(function (pattern) {
    const report = root.RedosAnalysis.ambiguity(pattern);

    return { report: report, rows: root.RedosAnalysis.blowUp(pattern, REPEATS),
      attack: root.RedosAnalysis.attackString(report, 8) };
  });

  const samplesFor = root.Helpers.memoise(function () {
    return root.RedosAnalysis.samples().map(function (entry) {
      const report = root.RedosAnalysis.ambiguity(entry.pattern);

      return { pattern: entry.pattern, label: entry.label, expected: entry.expected,
        flagged: report.vulnerable,
        kind: report.findings.length ? report.findings[0].kind : 'none',
        detail: report.findings.length ? report.findings[0].detail : 'no ambiguous structure' };
    });
  });

  function update() {
    const values = panel.values();
    const scan = scanFor(values['prd-source']);
    const analysis = analyseFor(values['prd-pattern']);

    paintMetrics(scan, analysis);
    paintSummary(scan, analysis, values);
    paintScan(scan);
    paintPriority();
    paintAnalyser();
    paintBlowUp(analysis);
  }

  function longestOvertakes(scan) {
    return scan.decisions.filter(function (decision) {
      return decision.attempts.length > 1;
    }).length;
  }

  function paintMetrics(scan, analysis) {
    const worst = analysis.rows[analysis.rows.length - 1];

    root.MetricGrid.update({
      'prd-tokens': { value: root.Format.exact(scan.tokens.length),
        note: scan.ok ? 'from ' + root.Format.exact(scan.decisions.length) +
          ' scanning decisions, whitespace skipped'
          : 'the scan failed at position ' + root.Format.exact(scan.errorAt) },
      'prd-longest': { value: root.Format.exact(longestOvertakes(scan)) + ' of ' +
        root.Format.exact(scan.decisions.length),
      note: 'positions where a shorter match already succeeded and was passed over' },
      'prd-redos': { value: analysis.report.vulnerable ? 'flagged' : 'clean',
        note: analysis.report.vulnerable
          ? analysis.report.findings[0].detail
          : 'no repetition over an ambiguous body, and no nested quantifier' },
      'prd-ratio': { value: worst && worst.ratio
        ? root.Format.fixed(worst.ratio, 1) + '×' : '1.0×',
      note: worst && worst.backtrack
        ? root.Format.exact(worst.backtrack) + ' against ' +
          root.Format.exact(worst.simulation) + ' steps at ' +
          root.Format.exact(worst.repeats) + ' repeats'
        : 'nothing to attack — the pattern is unambiguous' }
    });
  }

  function paintSummary(scan, analysis, values) {
    root.jQuery('#prd-summary').html(
      '<div class="mono" style="font-size:.85rem">' +
      (scan.tokens.length
        ? scan.tokens.map(function (token) {
          return token.type + '(' + root.Helpers.escapeHtml(token.text) + ')';
        }).join(' ')
        : 'no tokens') + '</div>' +
      '<div class="mono" style="font-size:.85rem;margin-top:.5rem">' +
      (analysis.attack
        ? 'attack: "' + root.Helpers.escapeHtml(analysis.attack.text) + '" (' +
          root.Format.exact(analysis.attack.text.length) + ' characters)'
        : 'no attack string — ' + values['prd-pattern'] + ' is unambiguous') + '</div>');

    root.Helpers.setText('prd-summary-note',
      'The tokens came from ' + root.Format.exact(scan.decisions.length) +
      ' maximal-munch decisions over ' + root.Format.exact(values['prd-source'].length) +
      ' characters. ' +
      (analysis.attack
        ? 'The attack string below it was generated from the pattern\'s structure: a prefix that ' +
          'reaches the ambiguous state, the ambiguous word repeated ' +
          root.Format.exact(analysis.attack.repeats) + ' times, and a tail the pattern cannot ' +
          'match — the failing tail is what forces the matcher to try every path before giving ' +
          'up. A string that MATCHES stops at the first success and is harmless.'
        : 'No attack string exists for this pattern, because the analyser found no state with ' +
          'two runs back to itself and no repetition nested inside another.'));
  }

  function paintScan(scan) {
    root.jQuery('#prd-scan tbody').html(scan.decisions.slice(0, 12).map(function (decision) {
      const passed = decision.attempts.slice(0, -1).map(function (attempt) {
        return attempt.rule + ' "' + attempt.text + '"';
      }).join(', ');

      return '<tr><td class="mono">' + decision.at + '</td><td class="mono">' +
        decision.chosen + '</td><td class="mono">"' +
        root.Helpers.escapeHtml(decision.text) + '"</td><td class="mono">' +
        (passed || '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('prd-scan-note',
      'The last column is maximal munch in action: at those positions a rule had already ' +
      'matched and the scanner kept going. `>>=` shows `shift ">>"` there, which is the token a ' +
      'first-success scanner would have emitted, followed by an `assign` — three tokens where ' +
      'the language has one. The rule is not "try the rules in order until one matches", it is ' +
      '"advance every rule in lockstep, remember the last accepting length, and stop when they ' +
      'have all died".');
  }

  function paintPriority() {
    const samples = ['if', 'in', 'int', 'intx', 'x', '>>', '>>=', '>='];
    const rows = root.LexerGen.shadowing(scannerFor(''), samples);

    root.jQuery('#prd-priority tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">"' + row.text + '"</td><td class="mono">' +
        row.matchedBy.join(', ') + '</td><td class="mono">' + row.chosen + '</td><td>' +
        (row.shadowed ? 'declared first among ' + row.matchedBy.length + ' matches'
          : 'only one rule matches it') + '</td></tr>';
    }).join(''));

    const shadowed = rows.filter(function (row) { return row.shadowed; }).length;

    root.Helpers.setText('prd-priority-note',
      root.Format.exact(shadowed) + ' of these ' + root.Format.exact(rows.length) +
      ' strings are matched by more than one rule, and every one of them is a keyword that the ' +
      'identifier rule also accepts. Moving the identifier rule above the keywords would ' +
      'silently turn `if` into an identifier and the grammar would then fail somewhere else ' +
      'entirely — which is why a generated lexer derives priority from declaration order and ' +
      'why keyword tables are the alternative when the rule list gets long.');
  }

  function paintAnalyser() {
    const rows = samplesFor('');

    root.jQuery('#prd-analyser tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.pattern) + '</td><td>' +
        row.label + '</td><td class="mono">' + (row.flagged ? 'yes' : 'no') +
        '</td><td class="mono">' + (row.expected ? 'yes' : 'no') + '</td><td>' +
        row.detail + '</td></tr>';
    }).join(''));

    const correct = rows.filter(function (row) { return row.flagged === row.expected; }).length;

    root.Helpers.setText('prd-analyser-note',
      root.Format.exact(correct) + ' of ' + root.Format.exact(rows.length) +
      ' verdicts match. Two rules do the work and they catch different things: an OVERLAP is ' +
      'found by searching the position automaton for a state with two runs back to itself, and ' +
      'a NESTING is found on the syntax tree, because `(a*)*` and `a*` have identical position ' +
      'automata and only the shape tells them apart. The row worth pausing on is `(a|ab)*c`, ' +
      'which looks like overlapping alternatives and is not — no string has two parses, so it ' +
      'is not flagged, and a detector that flagged it would be crying wolf on a safe pattern.');
  }

  function paintBlowUp(analysis) {
    root.jQuery('#prd-blowup tbody').html(analysis.rows.map(function (row) {
      return '<tr><td class="mono">' + row.repeats + '</td><td class="mono">' +
        root.Format.exact(row.length) + '</td><td class="mono">' +
        root.Format.exact(row.backtrack) + (row.overflow ? ' (capped)' : '') +
        '</td><td class="mono">' + root.Format.exact(row.simulation) +
        '</td><td class="mono">' + (row.ratio ? root.Format.fixed(row.ratio, 1) + '×' : '—') +
        '</td></tr>';
    }).join(''));

    const last = analysis.rows[analysis.rows.length - 1];

    root.Helpers.setText('prd-blowup-note', analysis.report.vulnerable
      ? 'Four repeat counts, and the two columns diverge: the simulation grows linearly with the ' +
        'input while the backtracker roughly multiplies by a constant per repeat. At ' +
        root.Format.exact(last.repeats) + ' repeats the input is ' +
        root.Format.exact(last.length) + ' characters and the backtracker takes ' +
        root.Format.exact(last.backtrack) + ' steps against ' +
        root.Format.exact(last.simulation) + ' — a factor of ' +
        root.Format.fixed(last.ratio, 1) + '. Rows marked "capped" hit the step limit, so the ' +
        'true number is larger and the ratio understates the problem. Both matchers return the ' +
        'same answer; only the time differs.'
      : 'The pattern is unambiguous, so there is no attack string to generate and the table is ' +
        'the degenerate case. That is the point of running the analyser first: the expensive ' +
        'measurement is only worth making on patterns whose structure already says it will find ' +
        'something.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
