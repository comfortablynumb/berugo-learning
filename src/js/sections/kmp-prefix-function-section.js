/**
 * Section: KMP and the prefix function.
 *
 * The claim this section makes is that the prefix function is worth more than
 * the matcher built on it. Period detection, string powers, occurrence
 * counting of every prefix and the minimal-rotation question all fall out of
 * one linear array, and the panels compute all four from the same run rather
 * than describing them.
 *
 * The matcher's own distinctive property - that the text index never
 * decreases - is a column rather than a sentence: `backup` counts text
 * positions re-read, and it is 0 on every corpus, which is what makes KMP the
 * matcher you can point at a stream.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'kmp-prefix-function';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a border, and the link that follows it',
      caption: 'A border of a string is a proper prefix that is also a suffix. On a mismatch the ' +
        'pattern slides so that its longest border lines up with the text already matched, because ' +
        'that is the longest overlap the text is known to support — and knowing it means no text ' +
        'character is ever examined twice.',
      definition: [
        'flowchart LR',
        '    S["pattern: a b a b c a b a b"] --> B["longest border of the whole pattern: abab, length 4"]',
        '    B --> M["mismatch after 9 matched characters"]',
        '    M --> F["slide by 9 − 4 = 5;<br/>the first 4 are already known to match"]',
        '    F --> N["the text index does not move at all"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A border of a string is a proper prefix that is also a suffix.** The **prefix function** — ' +
        'the border array, the failure function; three names for one thing — records the longest ' +
        'border of every prefix of the pattern.',
      'It is computed in one left-to-right pass whose inner loop looks quadratic and is not. The ' +
        'border length rises by at most one per position, so across the whole run it can fall at ' +
        'most n times.',
      '**The matcher never moves backwards in the text.** On a mismatch after k matched characters ' +
        'it sets k to the border of the matched prefix, and tries again *at the same text position*. ' +
        'The border is the longest overlap the text is already known to support.',
      'The text index only ever increases. That is why KMP is the matcher you can point at a socket, ' +
        'and why the demo reports a "text positions re-read" column that is always zero.',
      '**The array answers questions that have nothing to do with searching.** `n − border[n−1]` is ' +
        'the smallest period of the string, and the string is an exact power exactly when that ' +
        'period divides n.',
      'Counting backwards along the border chain gives the number of occurrences of every prefix ' +
        'inside the pattern. Both are two lines on top of an array you computed for another reason.',
      '**The automaton view** turns the fallback loop into a table: `next[state][symbol]` with every ' +
        'failure already resolved, so matching is one lookup per character with no inner loop at all.',
      'It costs `|alphabet| × (m+1)` cells, and the last panel measures both halves — the ' +
        'comparisons saved and the cells paid. On a Unicode alphabet the table is the reason nobody ' +
        'ships this.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the border array, the scan, and four things it answers',
        markup: root.KmpPrefixFunctionTemplate.render()
      },
      diagram: diagram(),
      insight: 'Under time pressure, implement the prefix function and not KMP. The array is eight ' +
        'lines and hard to get wrong; the matcher on top of it is four more. And once you have the ' +
        'array, four more questions are one or two lines each. Is this string a repetition of ' +
        'something shorter? What is its smallest period? How many times does each prefix occur? ' +
        'What is the minimal rotation? That is a much better return than one matcher, and it is why ' +
        'the prefix function shows up in problems that never mention searching.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.KmpPrefixFunctionTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  const WORDS = {
    fibonacci: [3, 4, 5, 6, 7, 8],
    powers: ['abcabc', 'abcabcabc', 'abcabcabcabc', 'aaaaaa', 'abab', 'xyxyxyxy'],
    nearly: ['abcabcabd', 'abcabcabcd', 'aaaaab', 'ababab', 'ababac', 'xyxyxyxz']
  };

  function patternOf(values) {
    const typed = String(values['kpf-pattern'] || '').trim();

    return typed.length > 0 ? typed : 'ababcabab';
  }

  const borderFor = root.Helpers.memoise(function (pattern) {
    const report = root.Kmp.emptyReport();

    return { pattern: pattern, border: root.Kmp.prefixFunction(pattern, { report: report }),
      report: report, period: root.Kmp.period(pattern),
      occurrences: root.Kmp.prefixOccurrences(pattern) };
  });

  const scanFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = root.MatchLab.corpus(parts[0], { size: Number(parts[1]) });
    const pattern = parts[2];

    return { instance: instance, pattern: pattern,
      kmp: root.Kmp.search(instance.text, pattern, {}),
      naive: root.StringMatch.naive(instance.text, pattern, {}) };
  });

  const periodsFor = root.Helpers.memoise(function (key) {
    const family = WORDS[key] || WORDS.fibonacci;

    return family.map(function (entry) {
      const word = key === 'fibonacci' ? root.ZAlgorithm.fibonacciWord(entry) : entry;
      const report = root.Kmp.emptyReport();

      root.Kmp.prefixFunction(word, { report: report });
      return { word: word, period: root.Kmp.period(word), report: report };
    });
  });

  const automatonFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const pattern = parts[1];

    return ['english', 'dna', 'binary'].map(function (name) {
      const instance = root.MatchLab.corpus(name, { size: Number(parts[0]) });
      const table = root.Kmp.automaton(pattern, instance.alphabet, {});
      const byTable = root.Kmp.searchByAutomaton(instance.text, pattern, table, {});
      const byArray = root.Kmp.search(instance.text, pattern, {});

      return { name: name, instance: instance, table: table,
        tableRun: byTable, arrayRun: byArray,
        agree: byTable.positions.length === byArray.positions.length };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const pattern = patternOf(values);
    const borders = borderFor(pattern);
    const scan = scanFor(values['kpf-corpus'] + '|' + values['kpf-size'] + '|' + pattern);

    paintMetrics(borders, scan);
    paintBorderTable(borders);
    paintAlignment(borders);
    paintScan(scan);
    paintUses(borders);
    paintPeriods(periodsFor(values['kpf-word']));
    paintAutomaton(automatonFor(values['kpf-size'] + '|' + pattern));
  }

  function paintMetrics(borders, scan) {
    const text = scan.instance.text;
    const last = borders.border[borders.border.length - 1] || 0;

    root.MetricGrid.update({
      'kpf-border': { value: root.Format.exact(last),
        note: last === 0 ? 'the pattern shares no prefix with its own suffix'
          : '"' + borders.pattern.slice(0, last) + '" is both a prefix and a suffix' },
      'kpf-period': { value: root.Format.exact(borders.period.period),
        note: borders.period.exact
          ? 'and it divides the length, so the pattern is ' +
            root.Format.exact(borders.period.repetitions) + ' copies of it'
          : 'which does not divide the length of ' + root.Format.exact(borders.pattern.length) },
      'kpf-comparisons': { value: root.Format.fixed(scan.kmp.report.comparisons / text.length, 2),
        note: root.Format.exact(scan.kmp.report.comparisons) + ' against the naive scan\'s ' +
          root.Format.exact(scan.naive.report.comparisons) },
      'kpf-backup': { value: '0',
        note: 'the text index only ever increases, which is what makes this a stream matcher' }
    });
  }

  function paintBorderTable(borders) {
    const pattern = borders.pattern;
    const limit = Math.min(pattern.length, 24);
    const rows = [];

    for (let i = 0; i < limit; i += 1) {
      const length = borders.border[i];

      rows.push({ cells: [String(i), pattern[i], String(length),
        length === 0 ? '—' : '"' + pattern.slice(0, length) + '"',
        length === 0 ? 'no proper prefix is also a suffix here'
          : 'prefix "' + pattern.slice(0, length) + '" = suffix of "' +
            pattern.slice(0, i + 1) + '"'] });
    }
    root.MatrixView.render(root.jQuery('#kpf-array')[0], {
      columns: ['i', 'character', 'border[i]', 'the border', 'what that means'], rows: rows
    });
    root.jQuery('#kpf-array-note').text('The array took ' +
      root.Format.exact(borders.report.preprocessing) + ' steps for a pattern of ' +
      root.Format.plural(pattern.length, 'character') + '. The inner loop that walks the border ' +
      'chain looks quadratic and is not: the border length rises by at most one per position, so ' +
      'across the whole run it can fall at most ' + root.Format.exact(pattern.length) +
      ' times in total. That is the same amortisation argument as a dynamic array\'s doubling, and ' +
      'it is the only subtle thing in the algorithm.');
  }

  function paintAlignment(borders) {
    const pattern = borders.pattern;
    const length = borders.border[borders.border.length - 1] || 0;
    const marks = pattern.split('').map(function (unused, i) {
      if (i < length) return 'match';
      return i >= pattern.length - length ? 'match' : null;
    });

    root.AlignmentView.render(root.jQuery('#kpf-align')[0], {
      rows: [
        { label: 'pattern', characters: pattern.split(''), marks: marks },
        { label: 'prefix', characters: pattern.slice(0, length).split(''),
          marks: new Array(length).fill('window') },
        { label: 'suffix', offset: pattern.length - length,
          characters: pattern.slice(pattern.length - length).split(''),
          marks: new Array(length).fill('window') }
      ]
    });
    root.jQuery('#kpf-align-note').text(length === 0
      ? 'This pattern has no border at all, so a mismatch anywhere restarts the pattern from ' +
        'scratch — which is the case where KMP does exactly the same work as the naive scan and ' +
        'the border array is pure overhead.'
      : 'The two highlighted runs are the same ' + root.Format.plural(length, 'character') +
        '. That overlap is what a shift is allowed to preserve: after matching all ' +
        root.Format.exact(pattern.length) + ' characters and failing, the pattern slides by ' +
        root.Format.exact(pattern.length - length) + ' and the first ' + root.Format.exact(length) +
        ' characters are already known to match, so the comparison resumes rather than restarting.');
  }

  function paintScan(scan) {
    const text = scan.instance.text;
    const agree = root.StringMatch.agree(scan.kmp.positions, scan.naive.positions).agree;
    const rows = [
      scanRow('KMP', scan.kmp, text, agree),
      scanRow('naive', scan.naive, text, true)
    ].join('');

    root.jQuery('#kpf-scan tbody').html(rows);
    root.jQuery('#kpf-scan-note').text('KMP costs ' +
      root.Format.fixed(scan.kmp.report.comparisons / text.length, 2) +
      ' comparisons per character against the naive scan\'s ' +
      root.Format.fixed(scan.naive.report.comparisons / text.length, 2) + '. On English that ' +
      'difference is small enough to be swamped by the border array\'s ' +
      root.Format.plural(scan.kmp.report.preprocessing, 'preprocessing step') +
      '; on the adversarial corpus it is the difference between linear and quadratic. Both rows ' +
      'find the same occurrences, which is the column that has to be checked before the others ' +
      'mean anything.');
  }

  function scanRow(name, run, text, agree) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(run.positions.length) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.comparisons) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.report.comparisons / text.length, 2) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.preprocessing) + '</td>' +
      '<td>' + (agree ? 'yes' : 'NO') + '</td></tr>';
  }

  function paintUses(borders) {
    const pattern = borders.pattern;
    const period = borders.period;
    const counts = borders.occurrences;
    const rows = [
      { cells: ['smallest period', root.Format.exact(period.period),
        'n − border[n−1] = ' + root.Format.exact(pattern.length) + ' − ' +
          root.Format.exact(period.border),
        period.exact ? 'divides n, so the string is a power' : 'does not divide n'] },
      { cells: ['is it an exact power?', period.exact ? 'yes' : 'no',
        period.exact ? root.Format.exact(period.repetitions) + ' copies of "' +
          pattern.slice(0, period.period) + '"' : 'the period runs off the end',
        'one comparison on the array'] },
      { cells: ['occurrences of the whole pattern in itself',
        root.Format.exact(counts[counts.length - 1]),
        'counting backwards along the border chain', 'always at least 1'] },
      { cells: ['occurrences of the first character',
        root.Format.exact(counts[0]), 'the same chain, read at length 1',
        'the border array answers all n prefixes at once'] }
    ];

    root.MatrixView.render(root.jQuery('#kpf-uses')[0], {
      columns: ['Question', 'Answer', 'How', 'Note'], rows: rows
    });
    root.jQuery('#kpf-uses-note').text('None of these four is a search. They all read one array ' +
      'that was computed for a matcher, and each costs one or two lines on top of it — which is the ' +
      'argument for learning the prefix function rather than KMP. The period is the most useful: ' +
      '"is this string a repetition of something shorter" is a question that arrives in ' +
      'compression, in cycle detection and in rotation problems, and it is a subtraction.');
  }

  function paintPeriods(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.MatrixView.display(row.word.length > 28
        ? row.word.slice(0, 25) + '…' : row.word) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.word.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.period.border) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.period.period) + '</td>' +
        '<td>' + (row.period.exact ? root.Format.exact(row.period.repetitions) + ' copies' : 'no') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.preprocessing) + '</td></tr>';
    }).join('');
    const exact = rows.filter(function (row) { return row.period.exact; }).length;

    root.jQuery('#kpf-periods tbody').html(html);
    root.jQuery('#kpf-periods-note').text(root.Format.exact(exact) + ' of ' +
      root.Format.exact(rows.length) + ' of these are exact powers. The Fibonacci words are the ' +
      'family to remember: they have long borders and no exact period at all, which makes them the ' +
      'worst case for several string algorithms and the standard test for a border-array ' +
      'implementation. Change one character of an exact power and the period jumps to the full ' +
      'length — periodicity is not a robust property, and that is why "nearly periodic" needs the ' +
      'approximate machinery of 15.8 rather than this array.');
  }

  function paintAutomaton(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.instance.alphabet.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.table.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.table.cells) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.arrayRun.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.tableRun.report.comparisons) + '</td></tr>';
    }).join('');
    const dna = rows.filter(function (row) { return row.name === 'dna'; })[0];
    const english = rows.filter(function (row) { return row.name === 'english'; })[0];

    root.jQuery('#kpf-automaton tbody').html(html);
    root.jQuery('#kpf-automaton-note').text('The table version does exactly one lookup per text ' +
      'character — ' + root.Format.exact(dna.tableRun.report.comparisons) + ' on DNA against the ' +
      'border array\'s ' + root.Format.exact(dna.arrayRun.report.comparisons) + ' — and it pays ' +
      root.Format.exact(dna.table.cells) + ' cells for a four-letter alphabet against ' +
      root.Format.exact(english.table.cells) + ' for English\'s ' +
      root.Format.exact(english.instance.alphabet.length) + '. That ratio is the whole argument: ' +
      'the table is free on DNA and unaffordable on Unicode, and every production matcher that ' +
      'builds one is working over bytes for exactly this reason.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
