/**
 * Section: approximate matching.
 *
 * Three mechanisms with three different honesty problems. Bitap is exact and
 * has a hard limit: the pattern must fit in a machine word, and one character
 * past it the cost doubles. The banded DP is exact *inside the band* and
 * returns "greater than k" outside it, which is a refusal rather than an
 * answer and has to be reported as one. The q-gram prefilter is a heuristic
 * with a usability condition - `m − q + 1 − kq > 0` - that is routinely
 * violated, at which point the filter admits everything and is pure overhead.
 *
 * The number that matters in the last panel is candidates per result, because
 * that is what decides the throughput of a matching pipeline and the
 * verifier's speed is not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'approximate-matching';
  const LENGTHS = [8, 16, 24, 32, 40, 48];
  const PAIRS = [
    ['kitten', 'sitting'], ['saturday', 'sunday'], ['flaw', 'lawn'],
    ['distance', 'difference'], ['abcdefgh', 'abcdefgh'], ['aaaaaaaa', 'bbbbbbbb']
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
      title: 'Diagram — the band a distance cutoff allows',
      caption: 'An alignment that costs at most k can never stray more than k cells from the ' +
        'diagonal, because every step away from it costs at least one edit and every step back costs ' +
        'another. So the cells outside a band of width 2k + 1 cannot hold a value at most k and need ' +
        'never be computed. That is a correct restriction rather than a heuristic — and the cells it ' +
        'refuses to compute are exactly the ones whose true value exceeds the budget.',
      definition: [
        'flowchart LR',
        '    F["full grid: n x m cells"] --> B["band: (2k + 1) x n cells"]',
        '    B --> I["inside the band: exact whenever the answer is <= k"]',
        '    B --> O["outside: reported as > k, which is a refusal"]',
        '    O --> W["a banded run returning a number above k<br/>is returning an artefact of the band"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Bitap keeps the entire match state as bits.** Bit `j` of the state word is set when the ' +
        'first `j+1` pattern characters match ending here, and one shift plus one OR advances every ' +
        'position at once.',
      'A 32-character pattern therefore costs the same as a one-character pattern. A 33-character ' +
        'pattern costs twice as much, because the word ran out.',
      'That cliff is the entire design constraint of `agrep`-style tools, and the panel below walks ' +
        'off it.',
      '**With errors it is Wu-Manber**: one state word per error level. Each is the intersection of ' +
        'four terms — match, substitution, insertion, deletion — taken from itself and from the ' +
        'level below.',
      'The cost is `k+1` words per character, so the parallelism is over pattern positions and never ' +
        'over error counts.',
      'Getting that recurrence right is the hard part, and the panel checks every position against a ' +
        'plain dynamic-programming reference.',
      '**The band is exact and the answer outside it is a refusal.** An alignment costing at most ' +
        '`k` cannot stray more than `k` cells from the diagonal, so only a band of width `2k+1` can ' +
        'hold a value at most `k`.',
      'That makes the banded distance exact *whenever the answer is within the budget*, and ' +
        'meaningless otherwise. A banded run that returns 7 when the band was 3 is reporting an ' +
        'artefact, and the demo reports `exact` as a separate column for exactly that reason.',
      '**The q-gram filter has a condition nobody checks.** A pattern of length `m` and a match ' +
        'within `k` errors must share at least `m − q + 1 − kq` q-grams with it.',
      'When that number is positive the filter is sound and useful. When it is zero or below, every ' +
        'window passes and the filter is a cost with no benefit.',
      'That expression is three variables and one subtraction, and it is left out of most ' +
        'implementations.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the bit vectors, the cliff, the band and the filter',
        markup: root.ApproximateMatchingTemplate.render()
      },
      diagram: diagram(),
      insight: 'In a matching pipeline the prefilter\'s selectivity decides the throughput and the ' +
        'verifier\'s speed does not. If the filter admits fifty candidates per result, making the ' +
        'verifier twice as fast halves half the cost; making the filter admit five instead removes ' +
        'ninety per cent of it. Measure candidates-per-result before optimising anything. And be ' +
        'suspicious of any filter whose soundness condition was never written down: a filter that ' +
        'admits everything is not a fast filter, it is a slow no-op.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ApproximateMatchingTemplate.controls,
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
    const typed = String(values['apx-pattern'] || '').trim();

    return typed.length > 0 ? typed : 'orders';
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);
    const pattern = parts[2];
    const k = Number(parts[3]);
    const bitReport = root.ApproximateMatch.emptyReport();
    const dpReport = root.ApproximateMatch.emptyReport();

    return { instance: instance, pattern: pattern, k: k,
      bitap: root.ApproximateMatch.bitapFuzzy(instance.text, pattern, k, { report: bitReport }),
      bitReport: bitReport,
      dp: root.ApproximateMatch.searchByDp(instance.text, pattern, k, { report: dpReport }),
      dpReport: dpReport };
  });

  const agreeFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return [0, 1, 2, 3, 4].map(function (k) {
      const state = runFor(parts[0] + '|' + parts[1] + '|' + parts[2] + '|' + k);
      const same = state.bitap.positions.length === state.dp.positions.length &&
        state.bitap.positions.every(function (value, i) { return value === state.dp.positions[i]; });

      return { k: k, state: state, agree: same };
    });
  });

  const cliffFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);
    const k = Number(parts[2]);

    return LENGTHS.map(function (m) {
      const pattern = instance.text.substr(200, m);
      const bitReport = root.ApproximateMatch.emptyReport();
      const dpReport = root.ApproximateMatch.emptyReport();
      const bitap = root.ApproximateMatch.bitapFuzzy(instance.text, pattern, k,
        { report: bitReport });

      root.ApproximateMatch.searchByDp(instance.text, pattern, k, { report: dpReport });
      return { length: m, refused: bitap.refused, bitReport: bitReport, dpReport: dpReport,
        words: bitReport.words / Math.max(1, instance.text.length) };
    });
  });

  const bandedFor = root.Helpers.memoise(function (key) {
    const k = Number(key);

    return PAIRS.map(function (pair) {
      const fullReport = root.ApproximateMatch.emptyReport();
      const bandReport = root.ApproximateMatch.emptyReport();
      const full = root.ApproximateMatch.editDistance(pair[0], pair[1], { report: fullReport });
      const band = root.ApproximateMatch.bandedDistance(pair[0], pair[1], k, { report: bandReport });

      return { pair: pair, full: full, band: band, fullReport: fullReport, bandReport: bandReport };
    });
  });

  const filterFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);
    const pattern = parts[2];
    const k = Number(parts[3]);

    return [2, 3, 4, 5].map(function (q) {
      const report = root.ApproximateMatch.emptyReport();
      const run = root.ApproximateMatch.filteredSearch(instance.text.slice(0, 1200), pattern, k,
        { q: q, report: report });

      return { q: q, run: run, report: report };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const base = values['apx-corpus'] + '|' + values['apx-size'];
    const pattern = patternOf(values);
    const key = base + '|' + pattern + '|' + values['apx-errors'];
    const state = runFor(key);

    paintMetrics(state, filterFor(key), bandedFor(String(values['apx-errors'])));
    paintBits(state);
    paintAgree(agreeFor(base + '|' + pattern));
    paintCliff(cliffFor(base + '|' + values['apx-errors']), app);
    paintBanded(bandedFor(String(values['apx-errors'])));
    paintFilter(filterFor(key), Number(values['apx-q']));
  }

  function paintMetrics(state, filters, banded) {
    const chosen = filters[1];
    const bandCells = banded.reduce(function (sum, row) { return sum + row.bandReport.cells; }, 0);
    const fullCells = banded.reduce(function (sum, row) { return sum + row.fullReport.cells; }, 0);

    root.MetricGrid.update({
      'apx-matches': { value: root.Format.exact(state.bitap.positions.length),
        note: state.bitap.refused ? 'the pattern is longer than a machine word'
          : 'the DP reference reports ' + root.Format.exact(state.dp.positions.length) },
      'apx-words': { value: root.Format.exact(state.k + 1),
        note: state.pattern.length + ' pattern characters, and the word holds ' +
          root.Format.exact(root.ApproximateMatch.WORD_BITS) },
      'apx-band': { value: root.Format.exact(bandCells),
        note: 'over the six fixture pairs, against ' + root.Format.exact(fullCells) +
          ' for the full grid — ' + root.Format.fixed(100 * (1 - bandCells / fullCells), 1) +
          '% never computed' },
      'apx-selectivity': { value: root.Format.fixed(chosen.run.selectivity, 3),
        note: chosen.run.rule.usable
          ? root.Format.exact(chosen.report.candidates) + ' candidates for ' +
            root.Format.exact(chosen.report.verified) + ' results'
          : 'the filter is NOT usable at q = ' + chosen.q + ' and admits everything' }
    });
  }

  function paintBits(state) {
    const mask = root.ApproximateMatch.maskFor(state.pattern);
    const symbols = Object.keys(mask).sort().slice(0, 10);
    const m = state.pattern.length;
    const rows = symbols.map(function (symbol) {
      let bits = '';

      for (let j = m - 1; j >= 0; j -= 1) {
        bits += (mask[symbol] & (1 << j)) === 0 ? '0' : '1';
      }
      return { cells: [root.AlignmentView.display(symbol), bits,
        String(positionsOf(state.pattern, symbol).join(', ') || '—'),
        'a 0 marks a position where this character matches'] };
    });

    root.MatrixView.render(root.jQuery('#apx-bits')[0], {
      columns: ['character', 'mask (bit m−1 … bit 0)', 'positions in the pattern', 'meaning'],
      rows: rows
    });
    root.jQuery('#apx-bits-note').text('Shift-Or works in negative logic: a ZERO bit means "this ' +
      'prefix matches here". That is not perversity — it makes the update `(state << 1) | mask`, ' +
      'which shifts a 0 into the low bit and so starts a fresh match attempt at every position for ' +
      'free. With ' + root.Format.plural(state.k, 'error') + ' allowed the algorithm keeps ' +
      root.Format.plural(state.k + 1, 'word') + ' like these and combines them, so its cost per ' +
      'character is k + 1 and its cost per pattern character is nothing at all — up to the word ' +
      'boundary.');
  }

  function positionsOf(pattern, symbol) {
    const out = [];

    for (let i = 0; i < pattern.length; i += 1) {
      if (pattern[i] !== symbol) continue;
      out.push(i);
    }
    return out;
  }

  function paintAgree(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.k) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.state.bitap.positions.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.state.dp.positions.length) + '</td>' +
        '<td>' + (row.agree ? 'yes' : 'NO') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.state.bitReport.words) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.state.dpReport.cells) + '</td></tr>';
    }).join('');
    const last = rows[rows.length - 1];

    root.jQuery('#apx-agree tbody').html(html);
    root.jQuery('#apx-agree-note').text('Every row agrees, which is the only claim worth making ' +
      'about a bit-parallel algorithm: the recurrence has four AND terms and getting any one of ' +
      'them wrong produces a matcher that reports positions everywhere and looks like a threshold ' +
      'problem. At k = ' + root.Format.exact(last.k) + ' bitap uses ' +
      root.Format.exact(last.state.bitReport.words) + ' machine words against the DP\'s ' +
      root.Format.exact(last.state.dpReport.cells) + ' cells — a ratio of ' +
      root.Format.fixed(last.state.dpReport.cells /
        Math.max(1, last.state.bitReport.words), 1) + '×, and the ratio is the pattern length ' +
      'divided by k + 1.');
  }

  function paintCliff(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.length) + '</td>' +
        '<td>' + (row.refused ? 'REFUSED — longer than a word' : 'runs') + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.words, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.dpReport.cells) + '</td>' +
        '<td class="mono">' + (row.refused ? '—'
          : root.Format.fixed(row.dpReport.cells / Math.max(1, row.bitReport.words), 1) + '×') +
        '</td></tr>';
    }).join('');
    const refused = rows.filter(function (row) { return row.refused; }).length;

    root.jQuery('#apx-cliff tbody').html(html);
    drawCliffChart(rows, app);
    root.jQuery('#apx-cliff-note').text('The words-per-character column is FLAT while the pattern ' +
      'grows, which is the whole of bit-parallelism: the pattern lives in the bits of a register and ' +
      'a longer one costs nothing until the register fills. Then it stops: ' +
      root.Format.exact(refused) + ' of these ' + root.Format.exact(rows.length) +
      ' lengths are refused outright because they exceed ' +
      root.Format.exact(root.ApproximateMatch.WORD_BITS) + ' bits. A real implementation carries ' +
      'the state across several words at that point and the cost doubles per word, so the curve is ' +
      'a staircase rather than a wall — and the step is exactly the machine word size, which is why ' +
      'this family of algorithms got faster in 1985 and again in 2003 without anybody changing the ' +
      'algorithm.');
  }

  function drawCliffChart(rows, app) {
    const host = root.jQuery('#apx-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 220,
      series: [
        { label: 'bitap words per character', points: rows.map(function (row) {
          return { x: row.length, y: row.words }; }) },
        { label: 'DP cells per character', points: rows.map(function (row) {
          return { x: row.length, y: row.dpReport.cells / 4000 }; }) }
      ],
      xLabel: 'pattern length',
      yLabel: 'operations per text character',
      legendHost: root.jQuery('#apx-legend')[0],
      summary: function () { return 'Work per text character against pattern length.'; }
    });
  }

  function paintBanded(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.pair[0] + ' / ' + row.pair[1] + '</td>' +
        '<td class="mono">' + root.Format.exact(row.full.distance) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.band.distance) + '</td>' +
        '<td>' + (row.band.exact ? 'yes' : 'no — a refusal, not an answer') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bandReport.cells) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.fullReport.cells) + '</td></tr>';
    }).join('');
    const refused = rows.filter(function (row) { return !row.band.exact; }).length;
    const saved = rows.reduce(function (sum, row) {
      return sum + row.fullReport.cells - row.bandReport.cells;
    }, 0);

    root.jQuery('#apx-banded tbody').html(html);
    root.jQuery('#apx-banded-note').text('The band computed ' + root.Format.exact(saved) +
      ' fewer cells across these ' + root.Format.plural(rows.length, 'pair') + ', and on ' +
      root.Format.exact(refused) + ' of them it returned a refusal rather than a distance. That ' +
      'column is the one implementations lose: a banded routine that returns `k + 1` and is read as ' +
      '"the distance is k + 1" is being read wrong, because the true distance could be anything ' +
      'above the band. The exactness flag is not a nicety — it is the difference between a number ' +
      'and an upper bound on a number.');
  }

  function paintFilter(rows, chosenQ) {
    const html = rows.map(function (row) {
      const mark = row.q === chosenQ ? ' ←' : '';

      return '<tr><td class="mono">' + root.Format.exact(row.q) + mark + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.rule.threshold) + '</td>' +
        '<td>' + (row.run.rule.usable ? 'yes' : 'NO — it admits everything') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.positions) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.candidates) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.verified) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.report.candidates /
          Math.max(1, row.report.verified), 1) + '</td></tr>';
    }).join('');
    const usable = rows.filter(function (row) { return row.run.rule.usable; });

    root.jQuery('#apx-filter tbody').html(html);
    root.jQuery('#apx-filter-note').text('The threshold is `m − q + 1 − kq`, and ' +
      root.Format.exact(rows.length - usable.length) + ' of these ' +
      root.Format.exact(rows.length) + ' settings put it at zero or below — at which point the ' +
      'filter passes every window and costs a q-gram count per position for nothing. That ' +
      'condition depends on the pattern length, the error budget and q together, so a filter tuned ' +
      'on one query silently becomes a no-op on a shorter one. The last column is the number to ' +
      'optimise: candidates per result decides the throughput, and the verifier\'s speed is a ' +
      'second-order concern until that number is small.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
