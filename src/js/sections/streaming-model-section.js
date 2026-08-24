/**
 * Section: the streaming model.
 *
 * The demo enforces the budget rather than reporting it. An exact distinct
 * count needs one entry per distinct key, so the set is KILLED the moment it
 * passes the byte limit — after a few hundred items out of hundreds of
 * thousands — and reports where it died rather than an answer it had no room
 * to compute. That is the whole model in one behaviour: past a space bound the
 * exact answer is not slow, it is unavailable.
 *
 * The other half is the list of questions that have no one-pass answer at all.
 * "Which keys appeared exactly once" cannot be answered approximately by a
 * sketch that over-counts, and no amount of engineering changes that. Knowing
 * which requirements are provably impossible is what stops them being accepted
 * in a design review.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'streaming-model';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the model’s two constraints, and what each one forbids',
      caption: 'The stream arrives once, in an order nobody chose, and the algorithm holds ' +
        'sub-linear space. Those two constraints together forbid a great deal: any exact answer ' +
        'that can depend on every item — the distinct count, the exact median, the set of ' +
        'singletons — needs space proportional to the input, so it is out. What remains is ' +
        'approximation with a stated error, and the useful discipline is knowing which side of ' +
        'the line a requirement falls on before agreeing to it. A cash-register stream only ' +
        'adds; a turnstile stream also subtracts, and several sketches that work on the first ' +
        'silently do not work on the second, which is a distinction worth asking about.',
      definition: [
        'flowchart LR',
        '    S["items arrive one at a time<br/>in an order nobody chose"] --> A["the algorithm"]',
        '    A --> M["sub-linear space<br/>— no room for the input"]',
        '    A --> P["one pass<br/>— no going back"]',
        '    M --> F1["exact distinct count: impossible"]',
        '    M --> F2["exact median: impossible in one pass"]',
        '    M --> F3["the set of keys seen exactly once: impossible"]',
        '    M --> OK1["approximate distinct count: HyperLogLog"]',
        '    M --> OK2["approximate quantiles: KLL, t-digest"]',
        '    M --> OK3["approximate frequencies: count-min"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The streaming model is one pass and sub-linear space, and both halves do work.** One ' +
        'pass means the data is gone once it has been seen; sub-linear space means there is no ' +
        'room to keep it. Together they rule out any exact answer that can depend on every item ' +
        'in the stream, which is more questions than people expect.',
      '**An exact distinct count needs one entry per distinct value, so past a budget it is not ' +
        'slow — it is impossible.** The demo runs it against a hard byte limit and kills it at ' +
        'the item where it passes, which is usually a few hundred items into a stream of ' +
        'hundreds of thousands. That is the model refusing rather than degrading.',
      '**HyperLogLog answers the same question in bytes that do not grow with the stream.** Its ' +
        'relative error is about 1.04/√m for m registers, so the accuracy is bought in a ' +
        'currency you choose in advance. The demo runs four precisions and reports the measured ' +
        'error against the predicted one for each.',
      '**A measured error above its own prediction is not automatically a bug.** The predicted ' +
        'figure is a standard error, so individual runs land either side of it, and HyperLogLog ' +
        'additionally has a known bias band between about 2.5m and 4m distinct values where the ' +
        'raw estimator reads high. The demo shows a row inside that band, and the honest reading ' +
        'is the band rather than the single number.',
      '**Quantile error is a RANK error, not a value error.** Asking for the 99th percentile and ' +
        'getting the value at rank 0.9897 is a rank error of 0.0003; the VALUE could be far from ' +
        'the true p99 on a heavy-tailed distribution and the sketch would still be within its ' +
        'guarantee. Every bound in this family is stated over ranks, and comparing sketches by ' +
        'value error compares the wrong thing.',
      '**Some questions have no approximate answer either, and that is the useful half.** ' +
        '"Which keys appeared exactly once" cannot be answered by a sketch that over-counts, ' +
        'because over-counting turns a one into a two and there is no way to tell. Neither can ' +
        '"the largest gap between consecutive values" without sorting.',
      '**Two passes change the picture completely.** An exact median is impossible in one pass ' +
        'with sub-linear space and straightforward in two — count into buckets, then rescan the ' +
        'bucket that contains the median. Whether the data can be read twice is therefore a ' +
        'design question worth asking before reaching for a sketch.',
      '**Cash-register and turnstile streams are different models.** A cash-register stream only ' +
        'adds; a turnstile stream also subtracts. Count-min survives subtraction and count-sketch ' +
        'is designed for it; HyperLogLog does not survive it at all, because a register records ' +
        'a maximum and a maximum cannot be undone.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — an exact structure killed by a budget, and sketches inside it',
        markup: root.StreamingModelTemplate.render()
      },
      diagram: diagram(),
      insight: '**Knowing which questions are provably impossible in one pass ends a whole class ' +
        'of requirement before it is written down.** "Report the exact number of unique users" ' +
        'over an unbounded stream is not a hard engineering problem, it is a space bound, and the ' +
        'only honest replies are "approximately, with this error", "exactly, with storage ' +
        'proportional to the users", or "exactly, in two passes over retained data". Which of ' +
        'those three the product actually needs is usually a five-minute conversation, and it ' +
        'is a conversation that cannot happen at all if the impossibility is not on the table. ' +
        'The one to watch for is a requirement that quietly needs the SET rather than the ' +
        'COUNT — deduplication, exactly-once, "who was affected" — because those need the space ' +
        'and no sketch will save them.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.StreamingModelTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const distinctFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ModelLab.distinctStudy({ budget: Number(parts[0]), length: Number(parts[1]),
      universe: Number(parts[2]) });
  });

  const quantileFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ModelLab.quantileStudy({ budget: Number(parts[0]), length: Number(parts[1]),
      universe: Number(parts[2]) });
  });

  function update(app) {
    const values = panel.values();
    const key = values['stm-budget'] + '|' + values['stm-length'] + '|' + values['stm-universe'];
    const distinct = distinctFor(key);
    const quantiles = quantileFor(key);

    paintMetrics(distinct, quantiles);
    paintChart(app, distinct);
    paintDistinct(distinct);
    paintQuantiles(quantiles);
    paintImpossible();
  }

  function bestSketch(distinct) {
    const inside = distinct.sketches.filter(function (row) { return row.withinBudget; });
    if (inside.length === 0) return null;
    return inside.reduce(function (winner, row) {
      return row.error < winner.error ? row : winner;
    }, inside[0]);
  }

  function paintMetrics(distinct, quantiles) {
    const best = bestSketch(distinct);
    const inside = quantiles.rows.filter(function (row) { return row.withinBudget; });
    const bestQ = inside.length ? inside.reduce(function (winner, row) {
      return row.worstRankError < winner.worstRankError ? row : winner;
    }, inside[0]) : null;

    root.MetricGrid.update({
      'stm-exact': { value: distinct.exact.killed
        ? 'killed at item ' + root.Format.exact(distinct.exact.at)
        : root.Format.exact(distinct.exact.answer),
        note: distinct.exact.killed
          ? root.Format.exact(distinct.exact.bytes) + ' bytes against a budget of ' +
            root.Format.exact(distinct.budget)
          : 'it fitted: ' + root.Format.exact(distinct.exact.bytes) + ' bytes' },
      'stm-truth': { value: root.Format.exact(distinct.truth),
        note: 'over a stream of ' + root.Format.exact(distinct.length) + ' items' },
      'stm-sketch': { value: best === null ? 'none fits'
        : root.Format.percent(best.error, 2),
        note: best === null ? 'raise the budget'
          : best.kind + ' at ' + root.Format.exact(best.bytes) + ' bytes, answering ' +
            root.Format.exact(Math.round(best.answer)) },
      'stm-quantile': { value: bestQ === null ? 'none fits'
        : root.Format.percent(bestQ.worstRankError, 3),
        note: bestQ === null ? 'raise the budget'
          : bestQ.kind + ' at ' + root.Format.exact(bestQ.bytes) + ' bytes' }
    });
  }

  function paintChart(app, distinct) {
    const host = root.jQuery('#stm-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logX: true, logY: true, yMin: 0.0001,
      xLabel: 'bytes held (log scale)', yLabel: 'relative error (log scale)',
      markers: [{ x: distinct.budget, label: 'the budget' }],
      series: [
        { label: 'measured error', points: distinct.sketches.map(function (row) {
          return { x: Math.max(1, row.bytes), y: Math.max(0.0001, row.error) };
        }) },
        { label: 'predicted 1.04/√m', dashed: true,
          points: distinct.sketches.map(function (row) {
            return { x: Math.max(1, row.bytes), y: row.predictedError };
          }) }
      ]
    });

    root.Helpers.setText('stm-chart-note',
      'Accuracy bought with space, on a logarithmic pair of axes, so the roughly straight line ' +
      'is the square-root law: quadrupling the registers halves the error. The marked line is ' +
      'the budget, and everything to the right of it does not fit. The exact structure is not ' +
      'on this plot at all — it needs ' + root.Format.exact(distinct.truth * 24) +
      ' bytes for ' + root.Format.exact(distinct.truth) + ' distinct values, which is off the ' +
      'right-hand edge, and its error would be zero. That trade is the whole model: a bounded ' +
      'error for unbounded space, taken deliberately rather than discovered in production.');
  }

  function paintDistinct(distinct) {
    const rows = [{ kind: distinct.exact.kind, bytes: distinct.exact.bytes,
      withinBudget: !distinct.exact.killed,
      answer: distinct.exact.answer, error: distinct.exact.killed ? null : 0,
      predictedError: 0, note: distinct.exact.reason }].concat(distinct.sketches);

    root.jQuery('#stm-distinct tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.kind + '</td><td class="mono">' +
        root.Format.exact(row.bytes) + '</td><td class="mono">' +
        (row.withinBudget ? 'yes' : 'no — killed') + '</td><td class="mono">' +
        (row.answer === null ? 'none' : root.Format.exact(Math.round(row.answer))) +
        '</td><td class="mono">' +
        (row.error === null ? '—' : root.Format.percent(row.error, 2)) + '</td><td class="mono">' +
        (row.predictedError ? root.Format.percent(row.predictedError, 2) : '—') + '</td></tr>';
    }).join(''));

    const biased = distinct.sketches.filter(function (row) {
      return row.error > row.predictedError * 2;
    });
    root.Helpers.setText('stm-distinct-note',
      'The first row is the exact answer and it does not exist: ' +
      (distinct.exact.killed ? distinct.exact.reason
        : 'at this budget it fitted, which is worth noticing — the model only bites when the ' +
          'distinct count is large relative to the space') +
      '. The sketch rows buy accuracy with registers at 1.04/√m, and the last column is that ' +
      'prediction. ' + (biased.length
        ? root.Format.exact(biased.length) + ' row(s) measure more than twice the predicted ' +
          'error, and the reason is documented rather than a defect: HyperLogLog’s raw ' +
          'estimator reads high between about 2.5m and 4m distinct values, and the correction ' +
          'for that band is not implemented here.'
        : 'Every row is inside twice its prediction, which is what a standard error means over ' +
          'a handful of samples.'));
  }

  function paintQuantiles(quantiles) {
    root.jQuery('#stm-quantiles tbody').html(quantiles.rows.map(function (row) {
      const cells = row.errors.map(function (entry) {
        return '<td class="mono">' + root.Format.fixed(entry.rank, 4) + '</td>';
      }).join('');
      return '<tr><td class="mono">' + row.kind + '</td><td class="mono">' +
        root.Format.exact(row.bytes) + (row.withinBudget ? '' : ' — over budget') + '</td>' +
        cells + '<td class="mono">' + root.Format.percent(row.worstRankError, 3) + '</td></tr>';
    }).join(''));

    const best = quantiles.rows.reduce(function (winner, row) {
      return row.worstRankError < winner.worstRankError ? row : winner;
    }, quantiles.rows[0]);
    root.Helpers.setText('stm-quantiles-note',
      'Every number in the middle columns is a RANK, and a perfect answer would read 0.5000, ' +
      '0.9000 and 0.9900 exactly. The exact structure would need ' +
      root.Format.exact(quantiles.exactBytes) + ' bytes — it keeps every value — against a ' +
      'budget of ' + root.Format.exact(quantiles.budget) + '. ' + best.kind + ' is the most ' +
      'accurate at ' + root.Format.exact(best.bytes) + ' bytes with a worst rank error of ' +
      root.Format.percent(best.worstRankError, 3) + '. Note which sketch wins where: a ' +
      'reservoir is uniform, so it is equally wrong everywhere, and t-digest deliberately keeps ' +
      'more resolution at the tails — which is why it is the one to reach for when the ' +
      'requirement is a p99 rather than a median.');
  }

  function paintImpossible() {
    const rows = root.ModelLab.impossibilityTable();

    root.jQuery('#stm-impossible tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.question + '</td><td>' + row.exact + '</td><td>' +
        row.approximate + '</td><td class="mono">' + (row.possible ? 'yes' : 'NO') +
        '</td></tr>';
    }).join(''));

    const impossible = rows.filter(function (row) { return !row.possible; });
    root.Helpers.setText('stm-impossible-note',
      'The last two rows are the ones worth carrying into a design review. ' +
      root.Format.exact(impossible.length) + ' of ' + root.Format.exact(rows.length) +
      ' questions here have no one-pass answer even approximately, and the reason is structural ' +
      'rather than a gap in the literature: a sketch that over-counts cannot certify a count of ' +
      'exactly one, and a maximum gap cannot be found without an ordering. When a requirement ' +
      'lands in that half, the negotiation is about the requirement — retain the data, take two ' +
      'passes, or accept a different question — and not about the implementation.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
