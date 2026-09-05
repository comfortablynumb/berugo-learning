/**
 * Section: count-min and count-sketch.
 *
 * The scatter is the section. Every key in the stream is one point, truth on
 * the x axis and estimate on the y; the solid line is y = x and the dashed one
 * is y = x + ε·N. Count-min's cloud sits entirely between them, which is the
 * one-sided guarantee made visible. Switch the estimator to count-sketch and
 * the cloud straddles the y = x line instead - tighter on average and now
 * capable of being *below* the truth, which is the whole design decision.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'count-min-sketch';
  const COLUMNS = [
    { id: 'plain', label: 'count-min', safe: 'rate limiting, shedding, alerting' },
    { id: 'conservative', label: 'count-min, conservative update', safe: 'the same, and tighter' },
    { id: 'signed', label: 'count-sketch (median of signed cells)', safe: 'anything that wants an unbiased estimate' }
  ];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A count-min sketch is a d×w matrix of counters and d hash functions. An increment adds to ' +
          'one cell in every row; a query reads those d cells and takes the smallest. Every cell ' +
          'the key touches holds its true count plus whatever other keys landed there. So the ' +
          'minimum is the least-contaminated of d estimates, and it is never below the truth, ' +
          'because contamination only ever adds.',
        'The guarantee is stated for w = ⌈e/ε⌉ and d = ⌈ln(1/δ)⌉: the estimate exceeds the truth ' +
          'by more than ε·N with probability at most δ. At w = 512 and d = 5 over a 200 000-item ' +
          'Zipf stream that bound is 1 062. The worst error measured over all 21 619 distinct keys ' +
          'is 363 — comfortably inside it, with zero keys under-counted. Conservative update, ' +
          'which raises only the cells currently at the minimum, cuts the mean absolute error from ' +
          '97.9 to 54.2 and keeps the never-under property.',
        'Count-sketch changes one thing: each row also has a ±1 hash, the update is multiplied by ' +
          'it, and the query takes the median rather than the minimum. Collisions now cancel in ' +
          'expectation instead of accumulating, so the estimator is unbiased and its mean absolute ' +
          'error is lower again — 32.1 here. It also under-counts 10 727 of the 21 619 keys. That ' +
          'is not a bug, and it is exactly the property that makes it unusable where count-min was ' +
          'chosen for its one-sidedness.'
      ],
      demo: { title: 'Interactive demo — the scatter, the bound and the heavy hitters', markup: root.CountMinSketchTemplate.render() },
      diagram: {
        title: 'Diagram — one increment, d cells, and the minimum at query time',
        caption: 'Row 2\'s cell also holds "beta" and row 4\'s also holds "delta". Row 1 was clean, so ' +
          'the minimum is the truth. Any row being clean is enough.',
        definition: [
          'flowchart LR',
          '    K["count(\'alpha\')"] --> H1["h1 → row 1, col 37"]',
          '    K --> H2["h2 → row 2, col 12"]',
          '    K --> H3["h3 → row 3, col 91"]',
          '    H1 --> C1["cell = 41<br/>(alpha only)"]',
          '    H2 --> C2["cell = 58<br/>(alpha + beta)"]',
          '    H3 --> C3["cell = 47<br/>(alpha + delta)"]',
          '    C1 --> M["estimate = min(41, 58, 47) = 41"]',
          '    C2 --> M',
          '    C3 --> M',
          '    M --> T["true count = 41"]'
        ].join('\n')
      },
      insight: 'Count-min never under-counts, so it is safe for rate limiting and unsafe for billing. ' +
        'Knowing which direction the error points is the whole design decision. It survives the ' +
        'switch to count-sketch only if somebody notices that "more accurate on average" bought ' +
        'accuracy by giving up the direction. Write down which way the error may go before ' +
        'choosing the sketch, not after.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CountMinSketchTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* Switching the estimator redraws the same measurement from a different
     column, so it must not re-run the stream. */
  const measured = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const stream = root.StreamLab.generate({
      kind: 'zipf', length: parts[0], keys: 50000, skew: parts[1] / 100, seed: 5
    });
    return {
      scatter: root.SketchLab.frequencyScatter({
        stream: stream, width: parts[2], depth: parts[3], seed: 3
      }),
      heavy: root.SketchLab.heavyHitterCompare({
        stream: stream, fraction: 0.005, counters: 400, width: parts[2], depth: parts[3], seed: 3
      })
    };
  });

  function update(app) {
    const values = panel.values();
    const state = measured([
      values['cms-length'], values['cms-skew'], values['cms-width'], values['cms-depth']
    ].join('|'));
    const scatter = state.scatter;
    const heavy = state.heavy;
    const column = values['cms-column'];
    const summary = scatter.summary[column];

    root.MetricGrid.update({
      'cms-bound': {
        value: root.Format.exact(scatter.bound),
        note: 'ε = ' + root.Format.fixed(scatter.epsilon * 1000, 3) + '/1000, N = ' +
          root.Format.exact(scatter.total)
      },
      'cms-worst': {
        value: root.Format.exact(summary.worst),
        note: 'mean absolute error ' + root.Format.fixed(summary.meanAbs, 1) + ' over ' +
          root.Format.exact(scatter.points.length) + ' keys'
      },
      'cms-under': {
        value: root.Format.exact(summary.underCounts),
        note: column === 'signed' ? 'expected: the estimator is unbiased, not one-sided' : 'must be zero'
      },
      'cms-bytes': {
        value: root.Format.bytes(scatter.bytes),
        note: 'an exact map would hold ' + root.Format.exact(scatter.points.length) + ' keys and counts'
      }
    });

    paintEstimators(scatter);
    paintHeavy(heavy);
    paintGuarantee(scatter, column);
    draw(app, scatter, column);
  }

  function paintEstimators(scatter) {
    const rows = COLUMNS.map(function (column) {
      const row = scatter.summary[column.id];
      return '<tr><td>' + column.label + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.meanAbs, 1) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.worst) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.underCounts) + '</td>' +
        '<td>' + column.safe + '</td></tr>';
    }).join('');

    root.jQuery('#cms-estimators tbody').html(rows);
    root.jQuery('#cms-estimators-note').text('Read the last two columns together. Count-sketch has the ' +
      'lowest mean absolute error of the three and is the only one that can report less than the ' +
      'truth. "More accurate" and "safe to subtract from a quota" are different properties, and the ' +
      'table is arranged so that choosing one without the other is visible.');
  }

  function paintHeavy(heavy) {
    const rows = heavy.truth.slice(0, 6).map(function (row, index) {
      const reported = heavy.countMin.rows[index];
      return '  ' + String(row.key).padEnd(12) + 'true ' + root.Format.exact(row.count).padStart(8) +
        '   count-min ' + (reported ? root.Format.exact(reported.estimate).padStart(8) : '—');
    });

    root.jQuery('#cms-heavy').text([
      'threshold: ' + root.Format.exact(heavy.threshold) + ' occurrences (0.5% of the stream)',
      'keys genuinely above it: ' + heavy.truth.length,
      '',
      'count-min + candidate heap: ' + heavy.countMin.reported + ' reported, recall ' +
        root.Format.percent(heavy.countMin.recall, 1) + ', precision ' +
        root.Format.percent(heavy.countMin.precision, 1) + ', ' + root.Format.bytes(heavy.countMinBytes),
      'space-saving, 400 counters:  ' + heavy.spaceSaving.reported + ' reported, recall ' +
        root.Format.percent(heavy.spaceSaving.recall, 1) + ', precision ' +
        root.Format.percent(heavy.spaceSaving.precision, 1) + ', ' + root.Format.bytes(heavy.spaceSavingBytes),
      '',
      'the six heaviest keys:',
      rows.join('\n')
    ].join('\n'));

    root.jQuery('#cms-heavy-note').text('The sketch cannot enumerate anything — it has no keys in it. ' +
      'A heavy-hitter query needs a candidate set kept alongside, and that set is the part whose ' +
      'memory grows with the answer. Space-saving, which is 7.8, keeps only the candidates and gets ' +
      'the same answer for less; the count-min row is here to show what the sketch does and does not ' +
      'contribute.');
  }

  function paintGuarantee(scatter, column) {
    const summary = scatter.summary[column];
    const violations = scatter.points.filter(function (point) {
      return point[column] - point.truth > scatter.bound;
    }).length;

    root.jQuery('#cms-guarantee').text([
      'estimator:                    ' + column,
      'distinct keys checked:        ' + root.Format.exact(scatter.points.length),
      'stream length N:              ' + root.Format.exact(scatter.total),
      'ε = e/w:                      ' + scatter.epsilon.toExponential(3),
      'δ = e^−d:                     ' + scatter.delta.toExponential(3),
      'additive bound ε·N:           ' + root.Format.exact(scatter.bound),
      'count-sketch bound ε₂·‖f‖₂:   ' + root.Format.exact(scatter.l2Bound),
      '',
      'keys whose estimate exceeded the count-min bound: ' + root.Format.exact(violations),
      'keys estimated below the truth:                   ' + root.Format.exact(summary.underCounts)
    ].join('\n'));

    root.jQuery('#cms-guarantee-note').text('δ is a per-key failure probability, so over tens of ' +
      'thousands of keys a handful of violations is the guarantee working as stated rather than ' +
      'failing. Count-sketch is measured against a different bound entirely — relative to the ' +
      'L2 norm rather than the L1 — which is why it beats count-min on a heavy-tailed stream at ' +
      'the same width.');
  }

  function draw(app, scatter, column) {
    const points = scatter.points.map(function (point) {
      return { truth: point.truth, estimate: point[column] };
    });

    chart = root.ErrorBandView.scatter(root.jQuery('#cms-scatter-chart')[0], {
      lazyLib: app.lazyLib,
      height: 300,
      points: points,
      bound: column === 'signed' ? scatter.l2Bound : scatter.bound,
      logX: true,
      logY: true,
      legendHost: root.jQuery('#cms-scatter-legend')[0],
      xLabel: 'true count',
      yLabel: 'estimated count',
      boundLabel: column === 'signed' ? 'ε₂·‖f‖₂ above the truth' : 'ε·N above the truth',
      summary: function () {
        return 'Per-key estimate against truth for the ' + column + ' estimator; the solid line is ' +
          'the exact answer and the dashed line is the guaranteed ceiling.';
      }
    });

    const drawn = root.ErrorBandView.sampleFor(points).length;
    const sampled = drawn < points.length
      ? ' Drawn: ' + root.Format.exact(drawn) + ' of ' + root.Format.exact(points.length) +
        ' keys — every one of the heaviest is here and the tail is a fixed stride, because one ' +
        'circle per key is twenty thousand SVG elements.'
      : '';

    root.jQuery('#cms-scatter-note').text((column === 'signed'
      ? 'The cloud straddles the y = x line: count-sketch is unbiased, so about half the keys read low. ' +
        'Nothing here is a bug and nothing here is safe to subtract from a quota.'
      : 'Every point sits on or above the y = x line and below the dashed ceiling. Above the line is ' +
        'the definition of the sketch; below the ceiling is the guarantee. The cloud is widest at the ' +
        'left because the error is additive — the same ±' + root.Format.exact(scatter.bound) +
        ' matters to a key seen ten times and not to one seen a hundred thousand.') + sampled);
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
