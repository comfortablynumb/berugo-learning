/**
 * Section: the matching problem and the naive algorithm.
 *
 * The naive matcher is here as the oracle, not the straw man. Every other
 * matcher in this milestone is checked against its occurrence list, and on
 * English its comparison count is within a few per cent of one per text
 * character - which is the reason standard libraries ship it with a filter and
 * escalate only for pathological input.
 *
 * The filter panel is the section's most useful result and it is a negative
 * one: filtering on the first character removes NO character comparisons at
 * all, because the check it performs is the comparison the inner loop would
 * have made first. What it removes is inner-loop entries - 3 998 down to 191
 * on English - and that matters because a specialised byte scan does sixteen
 * per instruction where an interpreted loop does one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'naive-matching';
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
      title: 'Diagram — the four families, and what each one avoids',
      caption: 'Every matcher after this one buys its speed by not looking at something. Prefix-based ' +
        'matchers avoid re-examining text they have already read; suffix-based ones avoid reading ' +
        'text at all; hashing avoids comparing characters until a fingerprint says it is worth it; ' +
        'and an automaton avoids the decision entirely by precomputing it.',
      definition: [
        'flowchart TD',
        '    Q["exact matching"] --> P["prefix-based<br/>KMP, Z"]',
        '    Q --> S["suffix-based<br/>Boyer-Moore, Horspool, Sunday"]',
        '    Q --> H["hashing<br/>Rabin-Karp"]',
        '    Q --> A["automaton<br/>KMP table, Aho-Corasick"]',
        '    P --> P1["never re-reads the text;<br/>works on a stream"]',
        '    S --> S1["skips text unread;<br/>faster as the pattern grows"]',
        '    H --> H1["one comparison per window,<br/>until a fingerprint hits"]',
        '    A --> A1["one table lookup per character,<br/>paid for in alphabet x states"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Exact matching asks for every position where a pattern occurs in a text** — *every* one, ' +
        'including overlapping occurrences, which is the first place a hand-rolled matcher goes ' +
        'wrong.',
      'The naive algorithm tries each of the `n − m + 1` alignments and compares left to right until ' +
        'a mismatch. Its worst case is `n·m` and its typical case on natural language is close to ' +
        '`n`.',
      'The distance between those two facts is what the rest of this milestone is about.',
      '**The currency here is character comparisons.** Not milliseconds, which depend on a JIT and a ' +
        'cache; not iterations, which are not comparable between a left-to-right and a ' +
        'right-to-left matcher.',
      'Comparisons are what every algorithm in this milestone is trying to avoid, and counting them ' +
        'is what makes "faster" a measurement rather than a claim.',
      '**The adversarial input is `aaa…aab` in `aaa…a`.** Every alignment agrees on all but the ' +
        'last character, so the inner loop runs to completion every time and finds nothing.',
      'That is the input the `O(nm)` bound is about. On it the naive scan does twelve times the work ' +
        'it does on English text of the same length, while every skipping matcher does a fraction ' +
        'of it.',
      '**A first-character filter is the standard library\'s answer**, and what it saves is not what ' +
        'people think.',
      'The filter compares the same character the inner loop would have compared first, so the ' +
        'comparison count does not move at all.',
      'What moves is the number of inner-loop *entries*. That matters because `memchr` is a ' +
        'vectorised byte scan that does sixteen characters per instruction, while a general inner ' +
        'loop does one.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — one alignment, the comparison profile, and seven corpora',
        markup: root.NaiveMatchingTemplate.render()
      },
      diagram: diagram(),
      insight: 'The reason `indexOf` is not KMP is that KMP is slower on the inputs `indexOf` ' +
        'actually sees. A tuned naive scan with a vectorised first-character filter beats every ' +
        'algorithm in this milestone on short patterns over natural language. The sophisticated ' +
        'matchers exist for the cases it loses on: very long patterns, tiny alphabets, many patterns ' +
        'at once, and adversarial input. Knowing which of those you have is the whole decision, and ' +
        'it is a question about your data rather than about the algorithms.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.NaiveMatchingTemplate.controls,
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
    const typed = String(values['nm-pattern'] || '').trim();
    const instance = corpusFor(values['nm-corpus'] + '|' + values['nm-size']);

    return typed.length > 0 ? typed : instance.pattern;
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);
    const pattern = parts[2];

    return { instance: instance, pattern: pattern,
      plain: root.StringMatch.naive(instance.text, pattern, {}),
      filtered: root.StringMatch.naive(instance.text, pattern, { filter: true }) };
  });

  const profileFor = root.Helpers.memoise(function (key) {
    const state = runFor(key);
    const text = state.instance.text;
    const pattern = state.pattern;
    const points = [];
    const limit = Math.min(text.length - pattern.length + 1, 400);

    for (let start = 0; start < limit; start += 1) {
      let depth = 0;

      while (depth < pattern.length && text[start + depth] === pattern[depth]) depth += 1;
      points.push({ x: start, y: depth + 1 });
    }
    return points;
  });

  const corporaFor = root.Helpers.memoise(function (key) {
    return root.MatchLab.CORPORA.map(function (name) {
      const instance = root.MatchLab.corpus(name, { size: Number(key) });
      const run = root.StringMatch.naive(instance.text, instance.pattern, { filter: true });

      return { name: name, instance: instance, run: run };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['nm-corpus'] + '|' + values['nm-size'] + '|' + patternOf(values);
    const state = runFor(key);

    paintMetrics(state);
    paintAlignment(state, Number(values['nm-offset']));
    paintProfile(profileFor(key), state, app);
    paintCorpora(corporaFor(String(values['nm-size'])));
    paintFilter(state);
    paintFamilies();
  }

  function paintMetrics(state) {
    const text = state.instance.text;
    const worst = (text.length - state.pattern.length + 1) * state.pattern.length;
    const comparisons = state.plain.report.comparisons;

    root.MetricGrid.update({
      'nm-occurrences': { value: root.Format.exact(state.plain.positions.length),
        note: 'of ' + root.Format.exact(state.plain.report.alignments) + ' alignments tried, ' +
          'pattern length ' + root.Format.exact(state.pattern.length) },
      'nm-comparisons': { value: root.Format.fixed(comparisons / text.length, 2),
        note: root.Format.exact(comparisons) + ' over ' + root.Format.exact(text.length) +
          ' characters' },
      'nm-entered': { value: root.Format.exact(state.filtered.report.entered),
        note: 'against ' + root.Format.exact(state.plain.report.entered) +
          ' without the filter — a ' +
          root.Format.fixed(state.plain.report.entered /
            Math.max(1, state.filtered.report.entered), 1) + '× reduction' },
      'nm-worst': { value: root.Format.fixed(100 * comparisons / Math.max(1, worst), 1) + '%',
        note: 'the bound is ' + root.Format.exact(worst) + ' comparisons' }
    });
  }

  function paintAlignment(state, offset) {
    view = function () { drawAlignment(state, offset); };
    view();
  }

  function drawAlignment(state, offset) {
    const host = root.jQuery('#nm-align')[0];

    if (!host) return;
    const text = state.instance.text;
    const pattern = state.pattern;
    const at = Math.min(offset, Math.max(0, text.length - pattern.length));
    const compared = [];

    for (let i = 0; i < pattern.length; i += 1) {
      const equal = text[at + i] === pattern[i];

      compared.push({ at: i, equal: equal });

      if (!equal) break;
    }
    const window2 = root.AlignmentView.alignment(text.slice(0, 60), pattern,
      { offset: at, compared: compared });

    root.AlignmentView.render(host, { rows: window2.rows, width: 60 });
    root.jQuery('#nm-align-note').text('Alignment ' + root.Format.exact(at) + ' of ' +
      root.Format.exact(text.length - pattern.length) + '. The inner loop compared ' +
      root.Format.plural(compared.length, 'character') + ' before it ' +
      (compared[compared.length - 1] && compared[compared.length - 1].equal
        ? 'ran out of pattern — this is an occurrence.'
        : 'hit a mismatch and gave up.') +
      ' The naive matcher now slides by exactly one and starts again, throwing away everything it ' +
      'just learned. Every algorithm after this one keeps some of it.');
  }

  function paintProfile(points, state, app) {
    const host = root.jQuery('#nm-chart')[0];
    const total = points.reduce(function (sum, point) { return sum + point.y; }, 0);
    const peak = points.reduce(function (best, point) { return Math.max(best, point.y); }, 0);

    if (host) {
      root.GrowthPlot.render(host, {
        lazyLib: app.lazyLib,
        height: 200,
        series: [{ label: 'characters compared at this alignment', points: points }],
        xLabel: 'alignment',
        yLabel: 'comparisons',
        legendHost: root.jQuery('#nm-legend')[0],
        summary: function () {
          return 'Characters compared at each of the first ' + points.length + ' alignments.';
        }
      });
    }
    root.jQuery('#nm-profile-note').text('The first ' + root.Format.exact(points.length) +
      ' alignments, costing ' + root.Format.fixed(total / Math.max(1, points.length), 2) +
      ' comparisons each on average and ' + root.Format.exact(peak) + ' at the worst. On a natural ' +
      'alphabet almost every alignment fails on its first character, so the average sits just above ' +
      '1 and the profile is a flat line with occasional spikes. On the adversarial corpus every ' +
      'alignment runs to the full pattern length and the line is flat at the top — which is the ' +
      'difference between O(n) in practice and O(nm) in theory, drawn.');
  }

  function paintCorpora(rows) {
    const html = rows.map(function (row) {
      const run = row.run;

      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.instance.alphabet.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.positions.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.report.comparisons /
          Math.max(1, row.instance.text.length), 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.entered) + '</td></tr>';
    }).join('');
    const english = rows.filter(function (row) { return row.name === 'english'; })[0];
    const adversarial = rows.filter(function (row) { return row.name === 'adversarial'; })[0];

    root.jQuery('#nm-corpora tbody').html(html);
    root.jQuery('#nm-corpora-note').text('The per-character column is the one to read. On English ' +
      'it is ' + root.Format.fixed(english.run.report.comparisons /
        english.instance.text.length, 2) + ' — the naive scan is essentially linear, because ' +
      root.Format.fixed(100 * (1 - english.run.report.entered /
        english.run.report.alignments), 1) + '% of alignments fail on their first character. On the ' +
      'adversarial corpus it is ' + root.Format.fixed(adversarial.run.report.comparisons /
        adversarial.instance.text.length, 2) + ', which is the pattern length, which is the O(nm) ' +
      'bound arriving in full. Nothing about the algorithm changed between those two rows.');
  }

  function paintFilter(state) {
    const rows = [
      filterRow('naive', state.plain.report),
      filterRow('naive with a first-character filter', state.filtered.report)
    ].join('');

    root.jQuery('#nm-filter tbody').html(rows);
    root.jQuery('#nm-filter-note').text('The comparison column is IDENTICAL, and that is the ' +
      'finding. The filter compares `text[i]` against `pattern[0]`, which is exactly the comparison ' +
      'the inner loop would have made first — so no character comparison is saved by it, ever. What ' +
      'falls is the inner-loop entry count, from ' +
      root.Format.exact(state.plain.report.entered) + ' to ' +
      root.Format.exact(state.filtered.report.entered) + ', and that is worth having because the ' +
      'filter\'s scan is a `memchr` that examines sixteen bytes per instruction while a general ' +
      'inner loop examines one. The saving is real and it is not in this table\'s units, which is ' +
      'the honest way to report it.');
  }

  function filterRow(name, report) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(report.alignments) + '</td>' +
      '<td class="mono">' + root.Format.exact(report.entered) + '</td>' +
      '<td class="mono">' + root.Format.exact(report.skipped) + '</td>' +
      '<td class="mono">' + root.Format.exact(report.comparisons) + '</td></tr>';
  }

  function paintFamilies() {
    root.MatrixView.render(root.jQuery('#nm-families')[0], {
      columns: ['Family', 'What it avoids', 'Wins when', 'Loses when'],
      rows: [
        { cells: ['prefix-based (KMP, Z)', 'ever re-reading a text character',
          'the text is a stream that cannot be rewound', 'the alphabet is large and skips are available'] },
        { cells: ['suffix-based (Boyer-Moore)', 'reading most of the text at all',
          'the pattern is long and the alphabet is large', 'the alphabet is tiny or the pattern matches everywhere'] },
        { cells: ['hashing (Rabin-Karp)', 'comparing characters until a fingerprint hits',
          'many patterns of one length, or chunking', 'an adversary picks the text'] },
        { cells: ['automaton (KMP table, Aho-Corasick)', 'the decision, by precomputing it',
          'the same pattern set runs many times', 'the alphabet makes the table too large'] }
      ]
    });
    root.jQuery('#nm-families-note').text('Four ways to not do work, and each one is a bet about ' +
      'the input. The last column is the part the complexity table leaves out: every one of these ' +
      'algorithms has a corpus in the panel above on which it is the worst choice available, and ' +
      'the following sections measure each of them on all seven.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
