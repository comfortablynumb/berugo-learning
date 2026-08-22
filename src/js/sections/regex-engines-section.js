/**
 * Section: regular expression engines.
 *
 * Two engines, one parser, one screen. The backtracking engine's step count on
 * `(a+)+b` quadruples every time the input grows by two characters - 1 024 at
 * 8, 16 384 at 12, 262 144 at 16, 1 048 576 at 18, and past the two-million
 * step budget at 20 - while the Thompson simulation goes 62, 94, 126, 142,
 * 158. That is exponential against linear, measured on the same pattern and
 * the same input, and it is the whole argument for RE2 and for Go's `regexp`.
 *
 * The trade is stated rather than hidden: the state-set engine here supports
 * no capture groups and no backreferences, because a set of positions does not
 * remember which path it took to get there.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'regex-engines';
  /* A regex pattern can contain '|', so the usual pipe-separated memoise key
     splits the pattern in half and every alternation silently becomes a parse
     error reported as "0 steps, safe". */
  const SEP = String.fromCharCode(1);
  const LENGTHS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  const PATTERNS = [
    { pattern: '(a+)+b', note: 'the classic — nested quantifiers over the same character' },
    { pattern: '(a|a)*b', note: 'the same exponential, with the ambiguity written out' },
    { pattern: '(a*)*b', note: 'a star inside a star' },
    { pattern: 'a*b', note: 'one quantifier, unambiguous' },
    { pattern: '(ab)*c', note: 'a quantified group over two characters' },
    { pattern: '(a|b)*abb', note: 'the textbook Thompson example' }
  ];
  const FIXTURES = [
    ['abc', 'abc'], ['abc', 'abd'], ['a*', ''], ['a*', 'aaa'], ['a|b', 'b'],
    ['(a|b)*abb', 'aababb'], ['(a|b)*abb', 'aabab'], ['a.c', 'axc'],
    ['a+b', 'aaab'], ['a+b', 'b'], ['(ab)+', 'ababab'], ['a?b', 'b']
  ];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the Thompson construction for (a|b)*abb',
      caption: 'Every node of the parse tree becomes a fragment with one entry and dangling exits, ' +
        'and the fragments compose. A split state has two epsilon successors and consumes no ' +
        'character — that is where the non-determinism lives, and simulating the machine means ' +
        'carrying both successors in the state set rather than choosing one and returning later.',
      definition: [
        'flowchart LR',
        '    S0(("start")) --> SP{{"split"}}',
        '    SP -->|"ε"| A1["a"]',
        '    SP -->|"ε"| B1["b"]',
        '    A1 --> SP',
        '    B1 --> SP',
        '    SP -->|"ε"| A2["a"]',
        '    A2 --> B2["b"]',
        '    B2 --> B3["b"]',
        '    B3 --> ACC(("accept"))'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Almost every language ships a **backtracking** regex engine: it tries one alternative and, ' +
          'on failure, returns and tries the next. That is what makes capture groups and ' +
          'backreferences possible, and it is what makes `(a+)+b` against a string of `a`s take ' +
          'exponential time — the number of ways to split the `a`s between the inner and outer plus ' +
          'is exponential, and the engine tries all of them before concluding there is no `b`.',
        '**That is a denial-of-service primitive**, and it usually arrives as a configuration change ' +
          'rather than as code: a validation pattern in a form, a log filter in a dashboard, a route ' +
          'matcher taking a user-supplied prefix. ReDoS is a recognised vulnerability class with CVE ' +
          'numbers attached, and the input that triggers it is often forty characters long.',
        '**Thompson\'s simulation carries a SET of states** and advances all of them one character at ' +
          'a time. There is nothing to backtrack to because every alternative is already in the set, ' +
          'so the cost is `O(states × length)` — linear in the input for a fixed pattern, with the ' +
          'state count bounded by the pattern length. The panel below plots both engines on the same ' +
          'pattern and input, and one curve is a straight line.',
        '**The trade is real and this section does not hide it.** A set of positions does not ' +
          'remember which path it took, so the state-set engine supports no capture groups and no ' +
          'backreferences. RE2 makes exactly that trade — and adds a lazily-built DFA cache on top ' +
          '— which is why it powers services that accept patterns from users and why it refuses ' +
          'features that PCRE offers.'
      ],
      demo: {
        title: 'Interactive demo — the two engines, the two curves, and which patterns are dangerous',
        markup: root.RegexEnginesTemplate.render()
      },
      diagram: diagram(),
      insight: 'A regex from user input on a backtracking engine is a denial-of-service primitive, ' +
        'and the two defences are different in kind. Use a linear-time engine — RE2, Go\'s `regexp`, ' +
        'Rust\'s `regex` — and the class of attack disappears along with backreferences. Keep the ' +
        'backtracking engine and you need a step budget, a timeout, or a static check for nested ' +
        'quantifiers over overlapping character classes. What you must not do is review the pattern ' +
        'by eye: `(a+)+b` and `a+b` differ by two characters and by a factor of four million.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RegexEnginesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  function patternOf(values) {
    const typed = String(values['rgx-pattern'] || '').trim();

    return typed.length > 0 ? typed : '(a+)+b';
  }

  function inputOf(family, length) {
    if (family === 'aaab') return 'a'.repeat(Math.max(0, length - 1)) + 'b';

    if (family === 'mixed') {
      let out = '';

      for (let i = 0; i < length; i += 1) out += i % 3 === 2 ? 'b' : 'a';
      return out;
    }
    return 'a'.repeat(length);
  }

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split(SEP);

    try {
      return root.RegexEngine.compare(parts[0], inputOf(parts[1], Number(parts[2])),
        { budget: Number(parts[3]) * 1000 });
    } catch (error) {
      return { pattern: parts[0], error: error.message, backtrackSteps: 0, nfaSteps: 0,
        length: Number(parts[2]), agree: null };
    }
  });

  const growthFor = root.Helpers.memoise(function (key) {
    const parts = key.split(SEP);

    return LENGTHS.map(function (length) {
      return compareFor(parts[0] + SEP + parts[1] + SEP + length + SEP + parts[2]);
    });
  });

  const patternsFor = root.Helpers.memoise(function (key) {
    const budget = Number(key);

    return PATTERNS.map(function (entry) {
      const small = compareFor(entry.pattern + SEP + 'aaa' + SEP + '12' + SEP + budget);
      const large = compareFor(entry.pattern + SEP + 'aaa' + SEP + '20' + SEP + budget);

      return { pattern: entry.pattern, note: entry.note, small: small, large: large };
    });
  });

  const fixturesFor = root.Helpers.memoise(function () {
    return FIXTURES.map(function (pair) {
      return { pattern: pair[0], input: pair[1],
        run: root.RegexEngine.compare(pair[0], pair[1], { budget: 200000 }) };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const pattern = patternOf(values);
    const key = pattern + SEP + values['rgx-input'] + SEP + values['rgx-length'] +
      SEP + values['rgx-budget'];
    const growthKey = pattern + SEP + values['rgx-input'] + SEP + values['rgx-budget'];
    const state = compareFor(key);

    paintMetrics(state, growthFor(growthKey));
    paintStates(pattern);
    paintGrowth(growthFor(growthKey), app);
    paintPatterns(patternsFor(String(values['rgx-budget'])));
    paintFixtures(fixturesFor('fixed'));
  }

  function paintMetrics(state, growth) {
    const finished = growth.filter(function (row) { return !row.exhausted && !row.error; });
    const last = finished[finished.length - 1];
    const previous = finished[finished.length - 3];
    const factor = previous && last && previous.backtrackSteps > 0
      ? last.backtrackSteps / previous.backtrackSteps : 0;

    root.MetricGrid.update({
      'rgx-back': { value: state.error ? 'parse error'
        : (state.exhausted ? 'budget exhausted' : root.Format.exact(state.backtrackSteps)),
      note: state.error ? state.error
        : 'input length ' + root.Format.exact(state.length) },
      'rgx-nfa': { value: state.error ? '—' : root.Format.exact(state.nfaSteps),
        note: state.error ? 'the pattern did not parse'
          : root.Format.plural(state.nfaStates, 'NFA state') + ', set peak ' +
            root.Format.exact(state.setSizePeak) },
      'rgx-ratio': { value: state.error || state.nfaSteps === 0 ? '—'
        : root.Format.fixed(state.backtrackSteps / state.nfaSteps, 1) + '×',
      note: factor > 1.5
        ? 'and it multiplies by ' + root.Format.fixed(factor, 1) +
          ' for every four extra input characters'
        : 'and it stays roughly flat as the input grows' },
      'rgx-agree': { value: state.agree === null ? 'not comparable' : (state.agree ? 'yes' : 'NO'),
        note: state.agree === null
          ? 'the backtracking engine ran out of budget, so there is nothing to compare'
          : 'both engines return ' + (state.nfaMatched ? 'a match' : 'no match') }
    });
  }

  function paintStates(pattern) {
    let program = null;

    try {
      program = root.RegexEngine.compile(root.RegexEngine.parse(pattern, {}), {});
    } catch (error) {
      root.MatrixView.render(root.jQuery('#rgx-states')[0], {
        columns: ['state', 'kind', 'on', 'goes to'],
        rows: [{ cells: ['—', 'parse error', error.message, '—'] }]
      });
      root.jQuery('#rgx-states-note').text('The pattern did not parse: ' + error.message +
        '. The subset here is concatenation, alternation, star, plus, optional, parentheses, dot ' +
        'and literals — chosen so that BOTH engines support all of it, which is what makes the ' +
        'comparison honest.');
      return;
    }
    const rows = program.states.map(function (state, id) {
      return { cells: [String(id), state.kind,
        state.kind === 'char' ? root.AlignmentView.display(state.value)
          : (state.kind === 'any' ? 'any character' : '—'),
        state.kind === 'split' ? state.a + ' and ' + state.b
          : (state.next === undefined ? '—' : String(state.next))] };
    }).slice(0, 14);

    root.MatrixView.render(root.jQuery('#rgx-states')[0], {
      columns: ['state', 'kind', 'on', 'goes to'], rows: rows
    });
    root.jQuery('#rgx-states-note').text(root.Format.plural(program.states.length, 'state') +
      ' for this pattern. The split states are the non-determinism: they consume no character and ' +
      'have two successors, so a backtracking engine has to choose one and remember the other, ' +
      'while the state-set simulation simply keeps both. The state count is bounded by the pattern ' +
      'length, which is why the simulation\'s per-character cost is bounded by the PATTERN and ' +
      'never by the input.');
  }

  function paintGrowth(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.length) + '</td>' +
        '<td class="mono">' + (row.exhausted ? 'budget exhausted'
          : root.Format.exact(row.backtrackSteps)) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.nfaSteps) + '</td>' +
        '<td class="mono">' + (row.exhausted || row.nfaSteps === 0 ? '—'
          : root.Format.fixed(row.backtrackSteps / row.nfaSteps, 1) + '×') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.setSizePeak) + '</td>' +
        '<td>' + (row.agree === null ? '—' : (row.agree ? 'yes' : 'NO')) + '</td></tr>';
    }).join('');
    const finished = rows.filter(function (row) { return !row.exhausted && !row.error; });
    const first = finished[0];
    const last = finished[finished.length - 1];

    root.jQuery('#rgx-growth tbody').html(html);
    drawGrowthChart(rows, app);
    root.jQuery('#rgx-growth-note').text(finished.length < 2
      ? 'The backtracking engine exhausted its budget on almost every row, which is itself the ' +
        'result: a pattern of six characters against an input of twenty made a general-purpose ' +
        'engine give up. The Thompson column finished every row.'
      : 'From length ' + root.Format.exact(first.length) + ' to ' +
        root.Format.exact(last.length) + ' the backtracking engine goes from ' +
        root.Format.exact(first.backtrackSteps) + ' steps to ' +
        root.Format.exact(last.backtrackSteps) + ' — a factor of ' +
        root.Format.exact(Math.round(last.backtrackSteps / Math.max(1, first.backtrackSteps))) +
        ' — while the Thompson simulation goes from ' + root.Format.exact(first.nfaSteps) +
        ' to ' + root.Format.exact(last.nfaSteps) + ', a factor of ' +
        root.Format.fixed(last.nfaSteps / Math.max(1, first.nfaSteps), 1) + '. The state-set peak ' +
        'column explains why: it is ' + root.Format.exact(last.setSizePeak) +
        ' and it does not move, because it is bounded by the state count, which is bounded by the ' +
        'pattern.');
  }

  function drawGrowthChart(rows, app) {
    const host = root.jQuery('#rgx-chart')[0];

    if (!host) return;
    const finished = rows.filter(function (row) { return !row.exhausted && !row.error; });

    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      logY: true,
      height: 230,
      series: [
        { label: 'backtracking steps', points: finished.map(function (row) {
          return { x: row.length, y: Math.max(1, row.backtrackSteps) }; }) },
        { label: 'Thompson steps', points: rows.map(function (row) {
          return { x: row.length, y: Math.max(1, row.nfaSteps) }; }) }
      ],
      xLabel: 'input length',
      yLabel: 'steps (logarithmic)',
      legendHost: root.jQuery('#rgx-legend')[0],
      summary: function () {
        return 'Steps against input length for both engines, on a logarithmic step axis.';
      }
    });
  }

  function paintPatterns(rows) {
    const html = rows.map(function (row) {
      const growth = row.small.backtrackSteps > 0 && !row.large.exhausted
        ? row.large.backtrackSteps / row.small.backtrackSteps : null;

      return '<tr><td class="mono">' + row.pattern + '</td>' +
        '<td class="mono">' + (row.small.exhausted ? 'exhausted'
          : root.Format.exact(row.small.backtrackSteps)) + '</td>' +
        '<td class="mono">' + (row.large.exhausted ? 'exhausted'
          : root.Format.exact(row.large.backtrackSteps)) + '</td>' +
        '<td class="mono">' + (growth === null ? 'unbounded'
          : root.Format.fixed(growth, 1) + '×') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.large.nfaSteps) + '</td>' +
        '<td>' + verdictFor(row, growth) + '</td></tr>';
    }).join('');
    const dangerous = rows.filter(function (row) {
      return row.large.exhausted || (row.small.backtrackSteps > 0 &&
        row.large.backtrackSteps / row.small.backtrackSteps > 4);
    }).length;

    root.jQuery('#rgx-patterns tbody').html(html);
    root.jQuery('#rgx-patterns-note').text(root.Format.exact(dangerous) + ' of these ' +
      root.Format.exact(rows.length) + ' patterns blow up and the rest do not, and the difference ' +
      'is not length or complexity — it is whether a quantifier is nested inside another over the ' +
      'SAME characters. `a*b` and `(a*)*b` differ by three characters and by everything. The ' +
      'Thompson column is flat across every row, because the simulation does not care: ambiguity ' +
      'costs it nothing, since every alternative is already in the set.');
  }

  function verdictFor(row, growth) {
    if (row.large.exhausted) return 'catastrophic — budget exhausted';

    if (growth !== null && growth > 4) return 'exponential';
    return 'safe';
  }

  function paintFixtures(rows) {
    const cells = rows.map(function (entry) {
      return { cells: [entry.pattern, entry.input === '' ? '(empty)' : entry.input,
        entry.run.backtrackMatched ? 'match' : 'no match',
        entry.run.nfaMatched ? 'match' : 'no match',
        entry.run.agree ? 'agree' : 'DISAGREE'] };
    });

    root.MatrixView.render(root.jQuery('#rgx-fixtures')[0], {
      columns: ['pattern', 'input', 'backtracking', 'Thompson', 'verdict'], rows: cells
    });
    const disagree = rows.filter(function (entry) { return entry.run.agree === false; }).length;

    root.jQuery('#rgx-fixtures-note').text(root.Format.exact(disagree) + ' of ' +
      root.Format.exact(rows.length) + ' fixtures disagree. That is the check the whole section ' +
      'rests on: a linear-time engine is only worth having if it computes the same language as the ' +
      'engine it replaces, and "faster" is meaningless until "same answer" is established. Note ' +
      'what is NOT in this table — capture groups and backreferences — because the state-set ' +
      'engine cannot express them, and that omission is the price rather than an oversight.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
