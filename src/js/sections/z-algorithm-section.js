/**
 * Section: the Z-algorithm and string periodicity.
 *
 * The Z-array is easier to get right than the border array and answers the
 * same questions, and the reason is visible in the case column: most positions
 * are answered by a mirror lookup with no character comparison at all, and the
 * only real work is extending past the right edge of the window. Because that
 * edge never moves left, the extensions total at most n over the whole run -
 * which is the same amortisation as Manacher's mirror in 15.7.
 *
 * The sentinel is the part that bites. Matching by concatenating
 * `pattern + $ + text` is correct only when `$` appears in neither, and
 * hard-coding a dollar sign produces a matcher that is wrong on any input
 * containing one. The module searches for a free character and the metric
 * shows which it picked.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'z-algorithm';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the three Z-box cases',
      caption: 'Keep the palindrome-free interval [l, r] that reaches furthest right and is known to ' +
        'equal a prefix. A position past r starts from nothing. A position inside r whose mirror is ' +
        'strictly shorter than the remaining box is answered exactly, with no comparison. A position ' +
        'inside r whose mirror reaches the edge is answered up to the edge and then extended — and ' +
        'that extension is the only work the algorithm ever does.',
      definition: [
        'flowchart TD',
        '    A["position i"] --> B{"i < r?"}',
        '    B -->|"no"| C["compare from scratch;<br/>every match extends r"]',
        '    B -->|"yes"| D{"z[i − l] < r − i?"}',
        '    D -->|"yes"| E["z[i] = z[i − l]<br/>exact, zero comparisons"]',
        '    D -->|"no"| F["z[i] = r − i, then extend past r"]',
        '    C --> G["r never moves left,<br/>so extensions total at most n"]',
        '    F --> G'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**`z[i]` is the length of the longest common prefix of the string and the suffix starting at ' +
        '`i`.** Computing it by definition is quadratic.',
      'Computing it in one pass takes an idea that is worth more than the array. Keep the interval ' +
        '`[l, r]` that reaches furthest right among all the intervals already known to equal a ' +
        'prefix, and *reuse it*.',
      '**A position inside that interval has a mirror.** If `i` lies in `[l, r]`, then the ' +
        'characters from `i` to `r` are the same as the characters from `i − l` onwards. And ' +
        '`z[i − l]` was computed already.',
      'When it is strictly shorter than the remaining box, the answer is exact and costs nothing at ' +
        'all. When it reaches the edge, the answer is at least the remaining box and the extension ' +
        'has to be measured.',
      'The case column below counts both.',
      '**The amortisation is the transferable part.** Every extension past `r` moves `r` right, and ' +
        '`r` never moves left, so the total extension work over the whole run is at most `n` however ' +
        'the string is shaped.',
      'That argument — never re-examine what an earlier structure already proved — is the same one ' +
        'behind Manacher\'s mirror in 15.7, and behind half a dozen other linear string algorithms.',
      '**Matching is a concatenation.** Build `pattern + sentinel + text`, take the Z-array, and ' +
        'every position with `z ≥ m` is an occurrence.',
      'The sentinel must appear in neither string, or a run inside the text can be credited to the ' +
        'pattern. A hard-coded `$` is a matcher that is wrong on any input containing a dollar sign. ' +
        'That is a real bug in real code, and the reason the metric below names the character it ' +
        'chose.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the three cases, the window, and the periodicity lemma',
        markup: root.ZAlgorithmTemplate.render()
      },
      diagram: diagram(),
      insight: 'If you have to write one of these from memory, write the Z-algorithm. The border ' +
        'array has an inner loop that walks a chain and an off-by-one at the start; the Z-array has ' +
        'one window and three cases you can name out loud. They answer the same questions, because a ' +
        'border array is recoverable from a Z-array in linear time and vice versa. So the choice is ' +
        'about which one you can get right at three in the morning, and it is not close.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ZAlgorithmTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  function stringOf(values) {
    const typed = String(values['zal-string'] || '').trim();

    return typed.length > 0 ? typed : 'aabxaabxcaabxaabxay';
  }

  function patternOf(values) {
    const typed = String(values['zal-pattern'] || '').trim();

    return typed.length > 0 ? typed : 'aabxaabxay';
  }

  const arrayFor = root.Helpers.memoise(function (text) {
    const report = root.ZAlgorithm.emptyReport();
    const run = root.ZAlgorithm.zArray(text, { report: report, trace: true });

    return { text: text, run: run, report: report,
      truth: root.ZAlgorithm.zByBruteForce(text) };
  });

  const scanFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = root.MatchLab.corpus(parts[0], { size: Number(parts[1]) });
    const pattern = parts[2];

    return { instance: instance, pattern: pattern,
      z: root.ZAlgorithm.search(instance.text, pattern, {}),
      naive: root.StringMatch.naive(instance.text, pattern, {}),
      kmp: root.Kmp.search(instance.text, pattern, {}) };
  });

  const periodsFor = root.Helpers.memoise(function (key) {
    const top = Number(key);
    const rows = [];

    for (let order = 4; order <= top; order += 1) {
      const word = root.ZAlgorithm.fibonacciWord(order);
      const proper = root.Kmp.periodsByBruteForce(word)
        .filter(function (p) { return p < word.length; });

      if (proper.length < 2) continue;
      rows.push({ word: word, order: order,
        check: root.ZAlgorithm.fineAndWilf(word, proper[0], proper[1]) });
    }
    return rows;
  });

  const TIGHT_PAIRS = [[2, 3], [3, 5], [5, 8], [8, 13], [4, 6], [6, 9]];

  const tightFor = root.Helpers.memoise(function () {
    return TIGHT_PAIRS.map(function (pair) {
      return root.ZAlgorithm.tightness(pair[0], pair[1]);
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const state = arrayFor(stringOf(values));
    const scan = scanFor(values['zal-corpus'] + '|' + values['zal-size'] + '|' + patternOf(values));

    paintMetrics(state, scan);
    paintTable(state);
    paintWindow(state, app);
    paintScan(scan);
    paintPeriods(periodsFor(String(values['zal-order'])), tightFor('fixed'));
  }

  function paintMetrics(state, scan) {
    const matches = state.run.z.every(function (value, i) { return value === state.truth[i]; });

    root.MetricGrid.update({
      'zal-inside': { value: root.Format.exact(state.report.insideWindow),
        note: 'of ' + root.Format.exact(state.text.length - 1) + ' positions; the other ' +
          root.Format.exact(state.report.pastWindow) + ' started past the window' },
      'zal-extensions': { value: root.Format.exact(state.report.extensions),
        note: 'and the bound is the string length, ' + root.Format.exact(state.text.length) +
          ', however the string is shaped' },
      'zal-oracle': { value: matches ? 'yes' : 'NO',
        note: 'checked against a definition-by-definition O(n²) computation' },
      'zal-sentinel': { value: 'code ' + root.Format.exact(scan.z.sentinel
        ? scan.z.sentinel.charCodeAt(0) : 0),
      note: 'searched for, not hard-coded — a fixed $ breaks on any text containing one' }
    });
  }

  function paintTable(state) {
    const limit = Math.min(state.text.length, 26);
    const rows = [];

    for (let i = 0; i < limit; i += 1) {
      const step = i === 0 ? null : state.run.trace[i - 1];

      rows.push({ cells: [String(i), state.text[i], String(state.run.z[i]),
        i === 0 ? 'the whole string, by definition' : step.kind,
        i === 0 ? '—' : String(step.extended),
        i === 0 ? '—' : '[' + step.left + ', ' + step.right + ']'] });
    }
    root.MatrixView.render(root.jQuery('#zal-table')[0], {
      columns: ['i', 'character', 'z[i]', 'case', 'characters compared', 'window after'], rows: rows
    });
    root.jQuery('#zal-table-note').text('The "case" column is the algorithm. ' +
      root.Format.exact(state.report.insideWindow) + ' of these positions were inside the current ' +
      'window and reused a mirror; ' + root.Format.exact(state.report.pastWindow) +
      ' started from nothing. Read the "characters compared" column down the table: it is zero at ' +
      'most positions, and the ones where it is not are exactly the positions that pushed the ' +
      'window right.');
  }

  function paintWindow(state, app) {
    const host = root.jQuery('#zal-chart')[0];
    const right = state.run.trace.map(function (step) { return { x: step.at, y: step.right }; });
    const extended = state.run.trace.map(function (step) { return { x: step.at, y: step.extended }; });

    if (host) {
      root.GrowthPlot.render(host, {
        lazyLib: app.lazyLib,
        height: 210,
        series: [
          { label: 'right edge of the window', points: right },
          { label: 'characters compared at this position', points: extended }
        ],
        xLabel: 'position',
        yLabel: 'index / comparisons',
        legendHost: root.jQuery('#zal-legend')[0],
        summary: function () {
          return 'The window edge against the comparisons made, position by position.';
        }
      });
    }
    root.jQuery('#zal-window-note').text('The rising line is the right edge of the window, and it ' +
      'never falls — that is the whole proof. Every comparison the algorithm makes either fails ' +
      '(at most once per position) or succeeds and moves the edge right, and the edge can move ' +
      'right at most ' + root.Format.exact(state.text.length) + ' times in total. So the ' +
      root.Format.exact(state.report.extensions) + ' successful comparisons here are bounded by the ' +
      'string length rather than by anything about the string, and the spiky line is the work ' +
      'distributed unevenly across positions while the total stays flat.');
  }

  function paintScan(scan) {
    const text = scan.instance.text;
    const truth = scan.naive.positions;
    const rows = [
      scanRow('Z, by concatenation', scan.z, text, root.StringMatch.agree(scan.z.positions, truth).agree),
      scanRow('KMP', scan.kmp, text, root.StringMatch.agree(scan.kmp.positions, truth).agree),
      scanRow('naive', scan.naive, text, true)
    ].join('');

    root.jQuery('#zal-scan tbody').html(rows);
    paintAlign(scan);
    root.jQuery('#zal-scan-note').text('The Z route costs ' +
      root.Format.exact(scan.z.report.comparisons) + ' comparisons against KMP\'s ' +
      root.Format.exact(scan.kmp.report.comparisons) + ' — the same asymptotics and a worse ' +
      'constant, because it builds an array over `pattern + sentinel + text` rather than over the ' +
      'pattern alone, so it touches ' + root.Format.exact(scan.pattern.length + 1) +
      ' extra positions and stores an array as long as the text. That is the trade: Z is the easier ' +
      'one to write and the more expensive one to run, and on a stream it is not available at all ' +
      'because the concatenation needs the whole text.');
  }

  function paintAlign(scan) {
    const host = root.jQuery('#zal-align')[0];

    if (!host) return;
    const pattern = scan.pattern;
    const window2 = pattern + (scan.z.sentinel || '$') + scan.instance.text.slice(0, 40);
    const marks = window2.split('').map(function (unused, i) {
      if (i < pattern.length) return 'window';
      return i === pattern.length ? 'mismatch' : null;
    });

    root.AlignmentView.render(host, {
      rows: [{ label: 'concatenated', characters: window2.split(''), marks: marks }],
      caption: 'pattern, then the sentinel, then the text — one Z-array over the whole thing'
    });
  }

  function scanRow(name, run, text, agree) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(run.positions.length) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.report.comparisons) + '</td>' +
      '<td class="mono">' + root.Format.fixed(run.report.comparisons / text.length, 2) + '</td>' +
      '<td>' + (agree ? 'yes' : 'NO') + '</td></tr>';
  }

  function paintPeriods(rows, tight) {
    const html = rows.map(function (row) {
      const check = row.check;

      return '<tr><td class="mono">' + (row.word.length > 24
        ? row.word.slice(0, 21) + '…' : row.word) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.word.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(check.p) + '</td>' +
        '<td class="mono">' + root.Format.exact(check.q) + '</td>' +
        '<td class="mono">' + root.Format.exact(check.bound) + '</td>' +
        '<td>' + (check.applies ? 'yes' : 'no — the bound exceeds ' +
          root.Format.exact(row.word.length)) + '</td>' +
        '<td>' + (check.gcdHolds ? 'yes' : 'no') + '</td></tr>';
    }).join('');
    const applies = rows.filter(function (row) { return row.check.applies; }).length;

    root.jQuery('#zal-periods tbody').html(html);
    paintTight(tight);
    root.jQuery('#zal-periods-note').text('Fine and Wilf: if a string of length n has periods p ' +
      'and q with p + q − gcd(p, q) ≤ n, then gcd(p, q) is a period too. On these Fibonacci words ' +
      'the two smallest proper periods put the bound OUTSIDE the length every time — it applies on ' +
      root.Format.exact(applies) + ' of ' + root.Format.exact(rows.length) + ' rows — and ' +
      'correspondingly gcd(p, q) = 1 is not a period of any of them. That is not a coincidence: ' +
      'the Fibonacci words are the extremal family, engineered so that their two shortest periods ' +
      'stay just clear of the bound, and they are what every periodicity implementation is tested ' +
      'against for exactly that reason.');
  }

  /** The bound is tight to the character, and the construction shows it. */
  function paintTight(rows) {
    const cells = rows.map(function (row) {
      return { cells: [root.Format.exact(row.p) + ' and ' + root.Format.exact(row.q),
        root.Format.exact(row.gcd), root.Format.exact(row.bound),
        root.Format.exact(row.atBound) + (row.forcedAtBound ? ' — forced' : ''),
        root.Format.exact(row.belowBound) + (row.freeBelowBound ? ' — still free' : '')] };
    });

    root.MatrixView.render(root.jQuery('#zal-tight')[0], {
      columns: ['Periods p, q', 'gcd', 'Bound p + q − gcd',
        'Independent symbols at the bound', 'One character shorter'],
      rows: cells
    });
    root.jQuery('#zal-tight-note').text('Forcing both periods on a string of length n identifies ' +
      'position i with i + p and with i + q; union-find over those identifications counts how many ' +
      'symbols are still free to choose. At exactly the bound the count collapses to gcd(p, q), ' +
      'which is to say gcd IS a period and no string escapes it. One character shorter there is ' +
      'always one more class than that, so a string exists with both periods and not the gcd. The ' +
      'bound is therefore tight to the character in every row, and that is a construction rather ' +
      'than a citation.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
