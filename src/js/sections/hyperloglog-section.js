/**
 * Section: HyperLogLog and cardinality estimation.
 *
 * Three panels carry the section. The tracking chart shows the estimate
 * following the exact distinct count inside the ±σ band the sketch claims for
 * itself. The merge panel shows that combining per-shard sketches gives
 * *exactly* the sketch of the whole stream - the property every analytics
 * system is really buying. And the correction panel shows the raw harmonic
 * estimator being wrong by 1 388% at small cardinalities, which is why the
 * algorithm has a correction at all.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hyperloglog';
  let panel = null;
  let charts = [];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      charts.forEach(function (chart) { if (chart) chart.redraw(); });
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Hash a key and count the leading zeros. Under a uniform hash, a value with ρ leading ' +
          'zeros turns up about once every 2^ρ distinct values. So the longest such run seen so ' +
          'far is a rough estimate of the count — and a terrible one, because it is one ' +
          'observation. HyperLogLog fixes the variance by using the first p bits of the hash to ' +
          'choose one of m = 2^p registers. It then averages their 2^M[j] harmonically, which is ' +
          'the mean a single overlarge register cannot drag around.',
        'The standard error is 1.04/√m and it does not depend on the cardinality. At p = 12 that ' +
          'is 4 096 registers, 1.63% error and 3 072 bytes packed at six bits each — for a count ' +
          'that may run to billions. The exact answer for 21 619 distinct keys needs a hash set ' +
          'holding every one of them. The sketch is the same 3 072 bytes whether the answer is a ' +
          'thousand or a trillion.',
        'The property that matters in production is the merge. Two sketches combine by taking the ' +
          'register-wise maximum. The result is not an approximation of the union — it *is* the ' +
          'sketch the whole stream would have produced, register for register. So per-shard ' +
          'sketches roll up into a global count with no re-scan and no coordination. That is why ' +
          'every analytics system ships one, and why adding shard estimates together instead is ' +
          'off by 70%.'
      ],
      demo: { title: 'Interactive demo — tracking, merging and correcting', markup: root.HyperloglogTemplate.render() },
      diagram: {
        title: 'Diagram — from one hash to one register update',
        caption: 'The first p bits choose the register; the rest supply the leading-zero count. A ' +
          'register only ever moves up, which is what makes the merge a maximum.',
        definition: [
          'flowchart LR',
          '    K["key"] --> H["32-bit hash"]',
          '    H --> P["first p bits<br/>→ register index j"]',
          '    H --> R["remaining 32 − p bits"]',
          '    R --> Z["ρ = leading zeros + 1"]',
          '    P --> M["M[j] ← max(M[j], ρ)"]',
          '    Z --> M',
          '    M --> E["estimate = α·m² / Σ 2^−M[j]"]',
          '    M --> C{"any register<br/>still zero?"}',
          '    C -->|yes| L["linear counting:<br/>m · ln(m / zeros)"]',
          '    C -->|no| E'
        ].join('\n')
      },
      insight: 'Mergeability is the property that matters in production. Per-shard sketches ' +
        'combine into a global count with no re-scan, which is why every analytics system ships ' +
        'one. The corollary is the mistake. Adding the per-shard *estimates* together counts every ' +
        'key that appears in two shards twice, and on a stream split four ways that is a 70% ' +
        'over-count. The sketches merge; the numbers do not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HyperloglogTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function streamFor(values) {
    return root.StreamLab.generate({
      kind: values['hll-kind'],
      length: values['hll-length'],
      keys: values['hll-keys'],
      skew: 1.1,
      seed: 5
    });
  }

  function update(app) {
    const values = panel.values();
    const precision = values['hll-precision'];
    const stream = streamFor(values);
    const track = root.SketchLab.cardinalityTrack({
      items: stream.items, precision: precision, seed: 3
    });
    const merge = root.SketchLab.mergeCheck({
      items: stream.items, shards: values['hll-shards'], precision: precision
    });
    const sweep = root.SketchLab.precisionSweep({
      items: stream.items, precisions: [8, 10, 12, 14, 16], seed: 3
    });
    const correction = root.SketchLab.correctionSweep({ precision: precision, seed: 3 });

    root.MetricGrid.update({
      'hll-estimate': {
        value: root.Format.exact(track.estimate),
        note: track.sketch.isSparse() ? 'still in the sparse representation' : 'dense: one byte per register'
      },
      'hll-truth': {
        value: root.Format.exact(track.distinct),
        note: 'from ' + root.Format.exact(stream.length) + ' items'
      },
      'hll-error': {
        value: root.Format.percent(track.relativeError, 2),
        note: root.Format.fixed(Math.abs(track.relativeError) / track.sigma, 2) + 'σ, where σ = ' +
          root.Format.percent(track.sigma, 2)
      },
      'hll-memory': {
        value: root.Format.bytes(track.sketch.packedBytes()),
        note: 'a Set of the keys would hold ' + root.Format.exact(track.distinct) + ' strings'
      }
    });

    paintPrecision(sweep, precision);
    paintMerge(merge, values['hll-shards']);
    paintCorrection(correction, precision);
    charts = [drawTrack(app, track, stream), drawRegisters(app, track)];
  }

  function paintPrecision(sweep, precision) {
    const rows = sweep.map(function (row) {
      const current = row.precision === precision;
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.precision + '</td>' +
        '<td class="mono">' + root.Format.exact(row.registers) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.sigma, 2) + '</td>' +
        '<td class="mono">' + root.Format.bytes(row.packedBytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.estimate) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.relative, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.sigmas, 2) + 'σ</td></tr>';
    }).join('');

    root.jQuery('#hll-precision-table tbody').html(rows);
    root.jQuery('#hll-precision-note').text('Memory quadruples for every halving of σ, because σ goes ' +
      'as 1/√m. That is the whole cost model: there is no cardinality in it, so the same table applies ' +
      'whether the stream holds a thousand distinct keys or a billion.');
  }

  function paintMerge(merge, shards) {
    root.jQuery('#hll-merge').text([
      'shards:                          ' + shards,
      'per-shard estimates:             ' + merge.shards.map(function (value) {
        return root.Format.exact(value);
      }).join(', '),
      '',
      'adding the estimates together:   ' + root.Format.exact(merge.shardSum) +
        '   ← wrong by ' + root.Format.percent((merge.shardSum - merge.truth) / merge.truth, 1),
      'merging the sketches:            ' + root.Format.exact(merge.merged),
      'sketch of the whole stream:      ' + root.Format.exact(merge.whole),
      'exact distinct count:            ' + root.Format.exact(merge.truth),
      '',
      'merged registers identical to the whole-stream sketch: ' + (merge.identical ? 'yes' : 'NO')
    ].join('\n'));

    root.jQuery('#hll-merge-note').text('The last line is an equality, not a tolerance. A register ' +
      'holds a maximum and the maximum of two maxima is the maximum of the union, so the merge is ' +
      'exact for every seed and every stream. Adding the per-shard estimates is the mistake this ' +
      'panel exists to price: a key seen in three shards is counted three times.');
  }

  function paintCorrection(correction, precision) {
    const lines = correction.map(function (row) {
      return ('n = ' + root.Format.exact(row.n)).padEnd(16) +
        ('n/m = ' + root.Format.fixed(row.multiple, 2)).padEnd(13) +
        ('zeros ' + root.Format.exact(row.zeros)).padEnd(13) +
        'raw ' + root.Format.percent(row.rawError, 2).padStart(10) +
        '   corrected ' + root.Format.percent(row.correctedError, 2).padStart(8) +
        (row.usedLinearCounting ? '   (linear counting)' : '');
    });

    root.jQuery('#hll-correction').text(lines.join('\n'));
    root.jQuery('#hll-correction-note').text('At p = ' + precision + ' the raw harmonic estimator is ' +
      'useless below the register count — most registers are still zero and αm²/Σ2^−M[j] has nothing ' +
      'to divide by — so the algorithm counts the zero registers instead. Between about 2.5m and 4m ' +
      'neither rule is good: both read 2.5% to 5.0% high, which is more than 3σ. That band is exactly ' +
      'what HLL++\'s empirical bias table is for, and this implementation does not carry those tables ' +
      'and so does not claim their accuracy.');
  }

  function drawTrack(app, track, stream) {
    const chart = root.ErrorBandView.render(root.jQuery('#hll-track-chart')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      points: track.points,
      legendHost: root.jQuery('#hll-track-legend')[0],
      truthLabel: 'exact distinct count',
      estimateLabel: 'HyperLogLog estimate',
      bandLabel: '±σ = ±' + root.Format.percent(track.sigma, 2),
      xLabel: 'items seen',
      yLabel: 'distinct keys',
      summary: function () {
        return 'The estimate tracks the exact distinct count inside a band of ±' +
          root.Format.percent(track.sigma, 2) + ' over ' + root.Format.exact(stream.length) + ' items.';
      }
    });

    const outside = track.points.filter(function (point) {
      return Math.abs(point.error) > point.bound;
    }).length;
    root.jQuery('#hll-track-note').text(outside + ' of ' + track.points.length +
      ' sampled points fall outside the ±σ band. About a third should: σ is one standard deviation, ' +
      'not a guarantee, and a band that nothing ever left would mean the sketch was carrying more ' +
      'memory than it needed.');
    return chart;
  }

  function drawRegisters(app, track) {
    const values = track.histogram.map(function (count, rank) {
      return { label: String(rank), value: count };
    });

    const chart = root.ErrorBandView.bars(root.jQuery('#hll-registers-chart')[0], {
      lazyLib: app.lazyLib,
      height: 220,
      values: values,
      xLabel: 'leading-zero count held by the register (ρ)',
      yLabel: 'registers',
      summary: function () {
        return 'The register histogram: a geometric shape whose position on the axis is the ' +
          'logarithm of the cardinality.';
      }
    });

    root.jQuery('#hll-registers-note').text('The shape is the same at every cardinality; only its ' +
      'position moves, one step right per doubling. That is the estimator in one picture — the count ' +
      'is read from *where* the histogram sits, not from how tall it is, which is why the memory does ' +
      'not grow with the answer.');
    return chart;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
