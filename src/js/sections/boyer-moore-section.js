/**
 * Section: Boyer-Moore and skipping algorithms.
 *
 * The claim is sublinearity, and it is a measurement: on English at a pattern
 * length of 32 the matcher examines a fraction of a character per text
 * character, because a mismatch at the pattern's last position licenses a jump
 * of up to m. Every other matcher in this milestone is bounded below by one
 * comparison per text character; this one is not, and the length sweep is
 * where that becomes visible rather than assertable.
 *
 * The rules panel is the honest half. On natural language the bad-character
 * rule decides almost every shift and the good-suffix rule earns its
 * construction cost only on periodic patterns and small alphabets - which is
 * why Horspool, which drops the good-suffix table entirely, is within a few
 * per cent of the full algorithm on most real corpora.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'boyer-moore';
  let panel = null;
  let view = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (view) view(); });
  }

  function diagram() {
    return {
      title: 'Diagram — the two shift rules, and why the larger one wins',
      caption: 'On a mismatch, the bad-character rule slides the pattern so its rightmost copy of the ' +
        'offending text character lines up — or past the mismatch entirely if the character is absent, ' +
        'which is where the big jumps come from. The good-suffix rule slides so the matched suffix ' +
        'reappears. Both are safe, so the algorithm takes the larger, and neither can ever skip an ' +
        'occurrence.',
      definition: [
        'flowchart TD',
        '    M["mismatch at pattern position j<br/>against text character c"] --> B["bad character:<br/>slide so the rightmost c lines up"]',
        '    M --> G["good suffix:<br/>slide so the matched suffix reappears"]',
        '    B --> A["c absent from the pattern:<br/>slide past the mismatch entirely, up to m"]',
        '    G --> P["only a prefix survives:<br/>slide so that prefix lands on the suffix"]',
        '    A --> T["take the larger of the two;<br/>both are safe, so the larger is safe"]',
        '    P --> T'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Boyer-Moore compares the pattern **right to left** within each alignment, and that one ' +
          'change buys everything. A mismatch at the last position tells you about a text character ' +
          'you have not otherwise looked at, and if that character does not occur in the pattern at ' +
          'all, the pattern can slide past it completely — `m` positions at once, with `m − 1` text ' +
          'characters never examined.',
        '**The bad-character rule** slides so that the rightmost occurrence of the offending text ' +
          'character lines up with it, or past the mismatch entirely when the character is absent. ' +
          '**The good-suffix rule** slides so that the suffix already matched reappears, or so that ' +
          'a prefix of the pattern lands on the tail of it. Both are safe, so the algorithm takes ' +
          'the larger — and the demo records which one won each time, because on natural language ' +
          'the answer is almost always the first.',
        '**It gets faster as the pattern gets longer**, which is the opposite of every other matcher ' +
          'here. The length sweep below is the claim: Boyer-Moore\'s characters-per-text-character ' +
          'falls as the pattern grows while KMP\'s and the naive scan\'s stay flat at just above one. ' +
          'That is why a long search term feels instant and a one-character one does not.',
        '**Horspool and Sunday drop machinery on purpose.** Horspool keys the bad-character rule on ' +
          'the text character aligned with the pattern\'s last position, whatever the mismatch was: ' +
          'one table, no good-suffix pass. Sunday looks at the character just *past* the window, ' +
          'which can be shifted by up to `m + 1`. Both are shorter than full Boyer-Moore and neither ' +
          'is uniformly worse, which the corpus table shows by inverting the ranking twice.'
      ],
      demo: {
        title: 'Interactive demo — one alignment, the length sweep, and the two rules priced',
        markup: root.BoyerMooreTemplate.render()
      },
      diagram: diagram(),
      insight: 'Real `strstr` implementations are hybrids: a vectorised first-character scan for ' +
        'short patterns, Horspool or two-way for longer ones, and a linear-time fallback so an ' +
        'adversary cannot force the quadratic worst case. The reason is exactly the corpus table ' +
        'below — every one of these algorithms has an input on which it is the worst available ' +
        'choice, and a library cannot see its input in advance. When you are choosing one yourself, ' +
        'you can, and that is the advantage worth using.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BoyerMooreTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const corpusFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.MatchLab.corpus(parts[0], { size: Number(parts[1]) });
  });

  function patternOf(values) {
    const typed = String(values['bmr-pattern'] || '').trim();

    return typed.length > 0 ? typed : corpusFor(values['bmr-corpus'] + '|' + values['bmr-size']).pattern;
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);

    return root.MatchLab.compareMatchers(instance, { pattern: parts[2] });
  });

  const rulesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);

    return root.MatchLab.ruleSweep(instance, { pattern: parts[2] });
  });

  const lengthsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);

    return root.MatchLab.lengthSweep(instance, { lengths: [2, 4, 8, 16, 32], from: 400 });
  });

  const corporaFor = root.Helpers.memoise(function (key) {
    return root.MatchLab.CORPORA.map(function (name) {
      const instance = root.MatchLab.corpus(name, { size: Number(key) });
      const run = root.MatchLab.compareMatchers(instance, {});
      const pick = function (which) {
        return run.rows.filter(function (row) { return row.key === which; })[0];
      };

      return { name: name, instance: instance,
        bm: pick('boyer-moore'), horspool: pick('horspool'), sunday: pick('sunday'),
        agree: run.disagreements === 0 };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['bmr-corpus'] + '|' + values['bmr-size'] + '|' + patternOf(values);
    const run = runFor(key);
    const rules = rulesFor(key);

    paintMetrics(run, rules);
    paintAlignment(run, Number(values['bmr-offset']));
    paintLengths(lengthsFor(key), app);
    paintRules(rules);
    paintTable(run);
    paintCorpora(corporaFor(String(values['bmr-size'])));
  }

  function rowFor(run, key) {
    return run.rows.filter(function (row) { return row.key === key; })[0];
  }

  function paintMetrics(run, rules) {
    const bm = rowFor(run, 'boyer-moore');
    const both = rules[0];
    const rate = bm.report.comparisons / run.text.length;

    root.MetricGrid.update({
      'bmr-rate': { value: root.Format.fixed(rate, 3),
        note: rate < 1 ? 'sublinear — most of the text was never looked at'
          : 'above 1, so nothing was skipped on balance' },
      'bmr-shift': { value: root.Format.fixed(run.text.length / Math.max(1, bm.report.shifts), 2),
        note: root.Format.plural(bm.report.shifts, 'shift') + ' over ' +
          root.Format.exact(run.text.length) + ' characters; the pattern is ' +
          root.Format.exact(run.pattern.length) + ' long' },
      'bmr-decider': { value: root.Format.exact(both.badWins) + ' vs ' +
        root.Format.exact(both.goodWins),
      note: root.Format.exact(both.ties) + ' ties; the good-suffix table costs ' +
        root.Format.exact(bm.report.preprocessing) + ' preprocessing steps whichever way it goes' },
      'bmr-agree': { value: bm.agree ? 'yes' : 'NO',
        note: bm.agree ? root.Format.plural(run.occurrences, 'occurrence') + ', every one verified'
          : root.Format.exact(bm.missing) + ' missing and ' + root.Format.exact(bm.extra) + ' extra' }
    });
  }

  function paintAlignment(run, offset) {
    view = function () { drawAlignment(run, offset); };
    view();
  }

  function drawAlignment(run, offset) {
    const host = root.jQuery('#bmr-align')[0];

    if (!host) return;
    const text = run.text;
    const pattern = run.pattern;
    const at = Math.min(offset, Math.max(0, text.length - pattern.length));
    const marks = new Array(pattern.length).fill(null);
    let j = pattern.length - 1;
    let compared = 0;

    while (j >= 0) {
      const equal = text[at + j] === pattern[j];

      marks[j] = equal ? 'match' : 'mismatch';
      compared += 1;

      if (!equal) break;
      j -= 1;
    }
    root.AlignmentView.render(host, {
      rows: [
        { label: 'text', characters: text.slice(0, 60).split(''),
          marks: text.slice(0, 60).split('').map(function (unused, i) {
            return i >= at && i < at + pattern.length ? 'window' : null;
          }) },
        { label: 'pattern', offset: at, characters: pattern.split(''), marks: marks }
      ]
    });
    root.jQuery('#bmr-align-note').text('Comparison starts at the pattern\'s LAST character and ' +
      'moves left. This alignment examined ' + root.Format.plural(compared, 'character') +
      (j < 0 ? ' and matched the whole pattern.'
        : ' before mismatching at pattern position ' + root.Format.exact(j) + ' against text "' +
          root.AlignmentView.display(text[at + j]) + '".') +
      ' Everything to the left of the mismatch inside the window is text this alignment never ' +
      'looked at, and if the offending character occurs nowhere in the pattern the next alignment ' +
      'starts past it entirely.');
  }

  function paintLengths(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.occurrences) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.rates['boyer-moore'], 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.rates.kmp, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.rates.naive, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.rates['rabin-karp'], 3) + '</td></tr>';
    }).join('');

    root.jQuery('#bmr-lengths tbody').html(html);
    drawLengthChart(rows, app);
    const first = rows[0];
    const last = rows[rows.length - 1];

    root.jQuery('#bmr-lengths-note').text('Boyer-Moore goes from ' +
      root.Format.fixed(first.rates['boyer-moore'], 3) + ' characters examined per text character ' +
      'at length ' + root.Format.exact(first.length) + ' to ' +
      root.Format.fixed(last.rates['boyer-moore'], 3) + ' at length ' +
      root.Format.exact(last.length) + ', while KMP moves from ' +
      root.Format.fixed(first.rates.kmp, 3) + ' to ' + root.Format.fixed(last.rates.kmp, 3) +
      ' and the naive scan barely moves at all. That falling column is the section: no other ' +
      'matcher here can drop below one comparison per text character, because no other one skips ' +
      'text unread.');
  }

  function drawLengthChart(rows, app) {
    const host = root.jQuery('#bmr-chart')[0];

    if (!host) return;
    const series = ['boyer-moore', 'kmp', 'naive'].map(function (key) {
      return { label: key, points: rows.map(function (row) {
        return { x: row.length, y: row.rates[key] }; }) };
    });

    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 220,
      logX: true,
      series: series,
      xLabel: 'pattern length',
      yLabel: 'characters examined per text character',
      legendHost: root.jQuery('#bmr-legend')[0],
      summary: function () {
        return 'Work per text character against pattern length, on a logarithmic length axis.';
      }
    });
  }

  function paintRules(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.rules + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.alignments) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.alignments === 0 ? 0
          : row.comparisons / row.alignments, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.badWins) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.goodWins) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.ties) + '</td></tr>';
    }).join('');
    const both = rows[0];
    const bad = rows[1];
    const good = rows[2];

    root.jQuery('#bmr-rules tbody').html(html);
    root.jQuery('#bmr-rules-note').text('Both rules together cost ' +
      root.Format.exact(both.comparisons) + ' comparisons; the bad-character rule alone costs ' +
      root.Format.exact(bad.comparisons) + ' and the good-suffix rule alone ' +
      root.Format.exact(good.comparisons) + '. The decider columns say why: the bad-character rule ' +
      'won ' + root.Format.exact(both.badWins) + ' of the shifts and the good-suffix rule ' +
      root.Format.exact(both.goodWins) + '. On a large alphabet the good-suffix table is a ' +
      'construction cost that buys almost nothing, which is precisely the observation Horspool ' +
      'built an algorithm out of — and on a small alphabet or a periodic pattern the ratio ' +
      'reverses, which is why the full version still exists.');
  }

  function paintTable(run) {
    const table = root.BoyerMoore.badCharacterTable(run.pattern, {});
    const symbols = Object.keys(table).sort();
    const m = run.pattern.length;
    const rows = symbols.slice(0, 12).map(function (symbol) {
      return { cells: [root.AlignmentView.display(symbol), String(table[symbol]),
        String(Math.max(1, m - 1 - table[symbol])),
        'a mismatch at the last position against "' + root.AlignmentView.display(symbol) +
          '" slides by ' + Math.max(1, m - 1 - table[symbol])] };
    });

    rows.push({ cells: ['anything else', '—', String(m),
      'the character occurs nowhere in the pattern, so the whole window is skipped'] });
    root.MatrixView.render(root.jQuery('#bmr-table')[0], {
      columns: ['Character', 'Rightmost position in the pattern', 'Shift on a last-position mismatch',
        'What that means'],
      rows: rows
    });
    root.jQuery('#bmr-table-note').text('The last row is where the speed comes from. The pattern ' +
      'contains ' + root.Format.plural(symbols.length, 'distinct character') + ' out of an alphabet ' +
      'of ' + root.Format.exact(run.name === 'english' ? 26 : symbols.length) +
      '-plus, so most text characters are in no row above and license a full ' +
      root.Format.exact(m) + '-position jump. Shrink the alphabet and that stops being true, which ' +
      'is exactly what the DNA and binary rows of the last panel measure.');
  }

  function paintCorpora(rows) {
    const html = rows.map(function (row) {
      const best = [['Boyer-Moore', row.bm], ['Horspool', row.horspool], ['Sunday', row.sunday]]
        .sort(function (a, b) { return a[1].report.comparisons - b[1].report.comparisons; })[0];

      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.instance.alphabet.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bm.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.horspool.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.sunday.report.comparisons) + '</td>' +
        '<td>' + best[0] + '</td></tr>';
    }).join('');
    const winners = {};

    rows.forEach(function (row) {
      const best = [['Boyer-Moore', row.bm], ['Horspool', row.horspool], ['Sunday', row.sunday]]
        .sort(function (a, b) { return a[1].report.comparisons - b[1].report.comparisons; })[0][0];

      winners[best] = (winners[best] || 0) + 1;
    });
    root.jQuery('#bmr-corpora tbody').html(html);
    root.jQuery('#bmr-corpora-note').text('Three variants, ' +
      root.Format.exact(Object.keys(winners).length) + ' different winners across ' +
      root.Format.exact(rows.length) + ' corpora — ' +
      Object.keys(winners).map(function (name) {
        return name + ' on ' + root.Format.exact(winners[name]);
      }).join(', ') + '. Sunday looks one character further ahead and usually wins on a large ' +
      'alphabet; Horspool drops the good-suffix table and loses only where periodicity makes it ' +
      'earn its keep; full Boyer-Moore wins where the alphabet is small enough that the ' +
      'bad-character rule runs out of jumps. None of them dominates, and a library that must ' +
      'choose without seeing the input picks the one with the best worst case rather than the best ' +
      'average.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
