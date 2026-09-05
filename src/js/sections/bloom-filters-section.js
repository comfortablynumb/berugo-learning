/**
 * Section: Bloom filters.
 *
 * The demo is a sizing calculator wired to a filter that is then deliberately
 * overfilled. Two things have to come out of it. First, the formula works: at
 * the n it was sized for, the measured rate lands on the predicted curve.
 * Second, and the reason the section exists, nothing changes at the moment the
 * filter passes that n. The error keeps climbing along the same curve, the
 * filter reports nothing, and at twice the n a 1% filter is a 16% filter.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bloom-filters';
  const TARGETS = [0.1, 0.03, 0.01, 0.001];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function diagram() {
    return {
        title: 'Diagram — one key setting k bits, and a false positive made of three others',
        caption: '"apple" set bits 2, 5 and 9. "durian" was never inserted, but bits 1, 5 and 9 are ' +
          'set by three different keys between them, so the filter reports it present.',
        definition: [
          'flowchart LR',
          '    A["apple"] --> H1["h1 = 2"]',
          '    A --> H2["h2 = 5"]',
          '    A --> H3["h3 = 9"]',
          '    H1 --> B2["bit 2 = 1"]',
          '    H2 --> B5["bit 5 = 1"]',
          '    H3 --> B9["bit 9 = 1"]',
          '    C["banana"] --> B1["bit 1 = 1"]',
          '    D["cherry"] --> B5',
          '    E["durian (never inserted)"] --> Q1["h1 = 1"]',
          '    E --> Q2["h2 = 5"]',
          '    E --> Q3["h3 = 9"]',
          '    Q1 --> B1',
          '    Q2 --> B5',
          '    Q3 --> B9',
          '    B1 --> F["all three set → reports present"]',
          '    B5 --> F',
          '    B9 --> F'
        ].join('\n')
      };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A Bloom filter is a bit array and k hash functions. Adding a key sets the k bits its hashes ' +
          'point at; asking about a key tests those k bits and answers "no" the moment one of them is ' +
          'clear. A clear bit is proof of absence, so there are no false negatives ever. A set bit is ' +
          'not proof of presence, because some other key may have set it, so a yes is only ever ' +
          '"probably".',
        'The sizing is two formulas and both are in the demo. For n keys at a target error p, ' +
          'm = −n ln p / (ln 2)² bits and k = (m/n) ln 2 hashes. At p = 1% that is 9.59 bits per ' +
          'key and 7 hashes, whatever the keys are and however long they are. The achieved error ' +
          'is (1 − e^(−kn/m))^k, and the measured rate over 20 000 absent keys lands on it: ' +
          '1.010% against a predicted 1.004%.',
        'The failure mode is not the false-positive rate. It is n. The curve does not stop at the ' +
          'n you sized for, and the filter has no idea it has passed it. At 1.5n the same filter ' +
          'measures 5.82% and at 2n it measures 16.05%, having promised 1%. There is no signal, ' +
          'no counter that crosses a line, and no way to shrink it back. The only repair is to ' +
          'build a new one, which means knowing the count you were not tracking.'
      ],
      demo: { title: 'Interactive demo — size it, fill it, then overfill it', markup: root.BloomFiltersTemplate.render() },
      diagram: diagram(),
      insight: 'The number to monitor is not the false-positive rate, which you cannot measure in ' +
        'production without the exact answer you built the filter to avoid. It is the insert count ' +
        'against the n you sized for. Export that counter, alert on it, and the filter never ' +
        'surprises you. Leave it out and the first symptom is a downstream system doing twenty ' +
        'times the work it was doing last month.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BloomFiltersTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function shapeFor(values) {
    const n = values['blf-n'];
    const target = Number(values['blf-p']);
    const optimal = root.BloomFilter.optimalParams({ n: n, p: target });
    const chosen = values['blf-k'] === 'optimal' ? optimal.k : Number(values['blf-k']);
    return { n: n, target: target, m: optimal.m, k: chosen, optimalK: optimal.k, bitsPerKey: optimal.bitsPerKey };
  }

  function update(app) {
    const values = panel.values();
    const shape = shapeFor(values);
    const inserted = Math.max(1, Math.round(shape.n * values['blf-fill'] / 100));
    const sweep = root.FilterLab.bloomSweep({
      n: shape.n, p: shape.target, seed: 11, steps: 16,
      probes: 10000, overfill: 2.5, k: shape.k
    });
    const measured = measureAt(shape, inserted);

    root.MetricGrid.update({
      'blf-bits': {
        value: root.Format.fixed(shape.m / shape.n, 2),
        note: root.Format.bytes(shape.m / 8) + ' for ' + root.Format.exact(shape.n) + ' keys'
      },
      'blf-hashes': {
        value: String(shape.k),
        note: shape.k === shape.optimalK ? 'the optimum for this m/n' : 'the optimum here is ' + shape.optimalK
      },
      'blf-predicted': {
        value: root.Format.percent(measured.predicted, 3),
        note: 'at ' + root.Format.exact(inserted) + ' keys inserted'
      },
      'blf-measured': {
        value: root.Format.percent(measured.rate, 3),
        note: root.Format.exact(measured.hits) + ' of ' + root.Format.exact(measured.probes) + ' absent keys'
      }
    });

    paintSizing(shape);
    paintOverfill(shape, sweep);
    paintNegatives(measured);
    draw(app, sweep, shape, inserted);
  }

  /** Builds a filter of the chosen shape at the chosen fill and probes it. */
  function measureAt(shape, inserted) {
    const filter = root.BloomFilter.create({ m: shape.m, k: shape.k, seed: 11 });
    for (let i = 0; i < inserted; i += 1) filter.add('key-' + i);

    const absent = root.StreamLab.absentKeys({ count: 20000 });
    const measured = root.StreamLab.measureFpr({ filter: filter, absent: absent });
    const present = [];
    for (let i = 0; i < Math.min(inserted, 5000); i += 1) present.push('key-' + i);

    return {
      rate: measured.rate,
      hits: measured.hits,
      probes: measured.probes,
      predicted: root.BloomFilter.fprFor({ m: shape.m, k: shape.k, n: inserted }),
      fill: filter.fill(),
      falseNegatives: root.StreamLab.falseNegatives({ filter: filter, present: present }),
      checked: present.length,
      estimatedCount: filter.estimatedCount()
    };
  }

  function paintSizing(shape) {
    const rows = TARGETS.map(function (target) {
      const params = root.BloomFilter.optimalParams({ n: shape.n, p: target });
      const current = Math.abs(target - shape.target) < 1e-9;
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + root.Format.percent(target, target < 0.01 ? 2 : 0) + '</td>' +
        '<td class="mono">' + root.Format.fixed(params.bitsPerKey, 2) + '</td>' +
        '<td class="mono">' + params.k + '</td>' +
        '<td class="mono">' + root.Format.bytes(params.m / 8) + '</td>' +
        '<td class="mono">' + root.Format.percent(params.predictedFpr, 3) + '</td></tr>';
    }).join('');

    root.jQuery('#blf-sizing tbody').html(rows);
    root.jQuery('#blf-sizing-note').text('Bits per key depends only on the target error — never on the ' +
      'key length, because only the hash of a key is ever stored. Ten times the error costs 4.79 bits ' +
      'per key; a thousandth costs 14.38. The last column differs from the target because k is an ' +
      'integer and the formula\'s answer is not.');
  }

  function paintOverfill(shape, sweep) {
    const lines = sweep.points
      .filter(function (point, index) { return index % 2 === 0 || point.n >= shape.n; })
      .slice(0, 14)
      .map(function (point) {
        return String(root.Format.exact(point.n)).padStart(8) + ' keys' +
          '   fill ' + root.Format.percent(point.fill, 1).padStart(6) +
          '   predicted ' + root.Format.percent(point.predicted, 3).padStart(8) +
          '   measured ' + root.Format.percent(point.measured, 3).padStart(8) +
          (point.overCapacity ? '   ← past the n it was sized for' : '');
      });

    root.jQuery('#blf-overfill').text(lines.join('\n'));
    root.jQuery('#blf-overfill-note').text('The predicted and measured columns agree the whole way ' +
      'down, including well past the sizing point. That is the problem: the model keeps working, so ' +
      'there is no discontinuity to detect. Only the insert counter knows.');
  }

  function paintNegatives(measured) {
    root.jQuery('#blf-negatives').text([
      'keys checked for false negatives: ' + root.Format.exact(measured.checked),
      'false negatives found:            ' + measured.falseNegatives,
      'bits set:                         ' + root.Format.percent(measured.fill, 1) + ' of the array',
      'count estimated from the bits:    ' + root.Format.exact(measured.estimatedCount) +
        '  (−m/k · ln(1 − fill), the filter\'s own guess at how full it is)'
    ].join('\n'));
  }

  function draw(app, sweep, shape, inserted) {
    const points = sweep.points.map(function (point) {
      return { n: point.n, truth: point.predicted, estimate: point.measured, bound: point.predicted * 0.15 };
    });

    chart = root.ErrorBandView.render(root.jQuery('#blf-chart-host')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      points: points,
      legendHost: root.jQuery('#blf-legend')[0],
      truthLabel: 'predicted (1 − e^(−kn/m))^k',
      estimateLabel: 'measured against absent keys',
      bandLabel: '±15% of the prediction',
      xLabel: 'keys inserted',
      yLabel: 'false-positive rate',
      yFormat: function (value) { return (value * 100).toFixed(1) + '%'; },
      summary: function () {
        return 'False-positive rate against keys inserted for a filter sized for ' +
          root.Format.exact(shape.n) + ' keys at ' + root.Format.percent(shape.target, 1) +
          '; the measured curve follows the prediction past the sizing point without any break.';
      }
    });

    root.jQuery('#blf-chart-note').text('The filter was sized for ' + root.Format.exact(shape.n) +
      ' keys and currently holds ' + root.Format.exact(inserted) + '. Both curves are drawn to 2.5n ' +
      'so the region past the sizing point is visible — and it looks exactly like the region before it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
