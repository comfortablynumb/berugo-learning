/**
 * Section: counting, blocked and scalable Bloom filters.
 *
 * Three separate repairs to three separate complaints about the plain filter,
 * and each one costs something specific. Counting buys deletion with four
 * times the memory. Blocked buys one cache line per query with a fifth more
 * error at the same size. Scalable buys "you do not have to know n" with a
 * chain that must all be consulted on a miss.
 *
 * The demo runs one key set and one probe set through all four so the columns
 * are comparable, which is the whole reason the harness owns the workload.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bloom-variants';
  /* The probe count the worked example quotes, so the demo shows those figures. */
  const PROBES = 50000;
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
        'A counting filter replaces each bit with a small counter, so a removal can decrement instead ' +
          'of being impossible. Four bits per cell is the usual choice and it costs exactly four times ' +
          'the memory: 95 851 bytes against 23 963 for the same m and k. The counters are not there to ' +
          'count — nobody reads them — they are there so that removing one key does not clear a cell ' +
          'another key is relying on.',
        'A blocked filter puts all k bits of a key inside one aligned block, so a query touches one ' +
          'cache line rather than k scattered ones: 1.00 lines against 6.95 measured. It is not free. ' +
          'Block occupancy varies, the overloaded blocks contribute more false positives than the ' +
          'empty ones save, and at 512-bit blocks the measured error is 1.21× the standard filter\'s ' +
          'at identical m and k. Smaller blocks make that worse fast — 2.56× at 64 bits.',
        'A scalable filter is a chain. When the newest layer reaches the capacity it was sized for, a ' +
          'larger one with a tighter target error is added in front of it, and the errors form a ' +
          'geometric series so the whole chain stays under the target however many layers appear. The ' +
          'cost is on the miss path: a "no" has to consult every layer, so the query cost grows with ' +
          'the number of times your original estimate was wrong.'
      ],
      demo: { title: 'Interactive demo — four filters, one workload', markup: root.BloomVariantsTemplate.render() },
      diagram: {
        title: 'Diagram — a scalable filter\'s layer chain',
        caption: 'Each layer is larger and aims lower. A query walks the chain until something says ' +
          'yes; a miss walks all of it.',
        definition: [
          'flowchart LR',
          '    Q["query"] --> L0',
          '    L0["layer 0<br/>2 000 keys<br/>p = 0.005"] -->|miss| L1',
          '    L1["layer 1<br/>4 000 keys<br/>p = 0.0025"] -->|miss| L2',
          '    L2["layer 2<br/>8 000 keys<br/>p = 0.00125"] -->|miss| L3',
          '    L3["layer 3<br/>16 000 keys<br/>p = 0.000625"] -->|miss| N["absent"]',
          '    L0 -->|hit| Y["probably present"]',
          '    L1 -->|hit| Y',
          '    L2 -->|hit| Y',
          '    L3 -->|hit| Y'
        ].join('\n')
      },
      insight: 'A blocked filter trades a little accuracy for one memory access instead of k. At a ' +
        'query rate where the filter is the hot loop that is the whole difference, and the 21% more ' +
        'false positives cost nothing if the thing behind the filter is cheap. Work out which side of ' +
        'that you are on before choosing: if the miss path is a disk read, buy the accuracy; if it is ' +
        'an in-memory map, buy the cache line.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BloomVariantsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* The two sweeps depend only on n, p and the layer count, and they cost two
     seconds. Recomputing them because the learner moved the counter-width
     slider is the difference between a demo and a stall. */
  const sweeps = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[0]);
    const target = Number(parts[1]);
    return {
      comparison: root.FilterLab.compareVariants({
        n: n, p: target, seed: 7, probes: PROBES, layers: Number(parts[2])
      }),
      blocks: root.FilterLab.blockSweep({ n: n, p: target, seed: 7, probes: PROBES })
    };
  });

  function update(app) {
    const values = panel.values();
    const n = values['bvr-n'];
    const target = Number(values['bvr-p']);
    const measured = sweeps(n + '|' + target + '|' + values['bvr-layers']);
    const comparison = measured.comparison;
    const blocks = measured.blocks;
    const churn = root.FilterLab.countingChurn({
      n: n, p: target, seed: 7,
      counterBits: Number(values['bvr-counter']), repeats: values['bvr-repeats']
    });

    const standard = comparison.rows[0];
    const counting = comparison.rows[1];
    const blocked = comparison.rows[2];
    const scalable = comparison.rows[3];

    root.MetricGrid.update({
      'bvr-memory': {
        value: root.Format.fixed(counting.bytes / standard.bytes, 2) + '×',
        note: root.Format.bytes(counting.bytes) + ' against ' + root.Format.bytes(standard.bytes)
      },
      'bvr-lines': {
        value: root.Format.fixed(blocked.linesPerQuery, 2) + ' / ' + root.Format.fixed(standard.linesPerQuery, 2),
        note: 'blocked / standard, 64-byte lines'
      },
      'bvr-inflation': {
        value: root.Format.fixed(blocked.measured / standard.measured, 2) + '×',
        note: root.Format.percent(blocked.measured, 3) + ' against ' + root.Format.percent(standard.measured, 3)
      },
      'bvr-layercount': {
        value: String(comparison.scalable.layerCount()),
        note: 'sized for ' + root.Format.exact(Math.round(n / values['bvr-layers'])) + ' of ' +
          root.Format.exact(n) + ' keys'
      }
    });

    paintVariants(comparison, scalable);
    paintCounting(churn);
    paintLayers(comparison);
    draw(app, blocks);
  }

  function paintVariants(comparison, scalable) {
    const rows = comparison.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.bytes(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bitsPerKey, 2) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.predicted, 3) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.measured, 3) + '</td>' +
        '<td class="mono">' + row.falseNegatives + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.linesPerQuery, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#bvr-variants tbody').html(rows);
    root.jQuery('#bvr-variants-note').text('The false-negative column is zero in every row and has to ' +
      'be: none of these four can lose a key it was given. The scalable row costs ' +
      root.Format.fixed(scalable.linesPerQuery, 2) + ' lines per query because a miss consults every ' +
      'layer — which is the price of not having known n.');
  }

  function paintCounting(churn) {
    root.jQuery('#bvr-counting').text([
      'counter width:              ' + churn.counterBits + ' bits, so a counter stops at ' + churn.ceiling,
      'each key inserted:          ' + churn.repeats + ' time' + (churn.repeats === 1 ? '' : 's'),
      'highest counter reached:    ' + churn.maxCounter,
      'cells stuck at the ceiling: ' + root.Format.exact(churn.saturated) + ' of ' + root.Format.exact(churn.cells),
      'increments that were lost:  ' + root.Format.exact(churn.overflows),
      '',
      'after removing each of ' + root.Format.exact(churn.removedCount) + ' keys once:',
      '  still reported present:   ' + root.Format.exact(churn.removedStillPresent),
      '  false negatives:          ' + churn.falseNegatives + '  (must be 0)',
      '  memory:                   ' + root.Format.bytes(churn.bytes) + ' against ' +
        root.Format.bytes(churn.standardBytes) + ' for the standard filter'
    ].join('\n'));

    root.jQuery('#bvr-counting-note').text('Raise the repeat count and watch the saturated-cell line ' +
      'move. A cell that reached the ceiling is never decremented again — decrementing it could take ' +
      'it below the true count and produce a false negative — so those cells are set for the rest of ' +
      'the filter\'s life, and the error rate drifts towards that of a filter nothing was ever removed from.');
  }

  function paintLayers(comparison) {
    const rows = comparison.scalable.layers().map(function (layer, index) {
      return '<tr><td class="mono">' + index + '</td>' +
        '<td class="mono">' + root.Format.exact(layer.capacity) + '</td>' +
        '<td class="mono">' + root.Format.exact(layer.count) + '</td>' +
        '<td class="mono">' + root.Format.percent(layer.target, 4) + '</td>' +
        '<td class="mono">' + root.Format.exact(layer.bits) + '</td>' +
        '<td class="mono">' + layer.k + '</td></tr>';
    }).join('');

    root.jQuery('#bvr-layers-table tbody').html(rows);
    root.jQuery('#bvr-layers-note').text('The target column halves at every layer, so the sum of the ' +
      'layer errors converges: p·(1 − r)·(1 + r + r² + …) = p whatever the chain length. The bits ' +
      'column doubles at the same time, which is why the chain costs more than one correctly sized ' +
      'filter would have — ' + root.Format.bytes(comparison.rows[3].bytes) + ' against ' +
      root.Format.bytes(comparison.rows[0].bytes) + '.');
  }

  function draw(app, blocks) {
    chart = root.ErrorBandView.curve(root.jQuery('#bvr-block-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logX: true,
      legendHost: root.jQuery('#bvr-block-legend')[0],
      xLabel: 'block size (bits)',
      yLabel: 'measured false-positive rate',
      yFormat: function (value) { return (value * 100).toFixed(1) + '%'; },
      series: [
        {
          label: 'blocked, measured',
          points: blocks.rows.map(function (row) { return { x: row.blockBits, y: row.measured }; })
        },
        {
          label: 'standard filter, same m and k',
          dashed: true,
          points: blocks.rows.map(function (row) { return { x: row.blockBits, y: blocks.standard.measured }; })
        }
      ],
      markers: [{ x: 512, label: 'one 64-byte cache line' }],
      summary: function () {
        return 'Measured false-positive rate against block size; the standard filter is the flat ' +
          'dashed line, and the blocked filter meets it only once the block is large enough to ' +
          'cost several cache lines.';
      }
    });

    const line = blocks.rows.filter(function (row) { return row.blockBits === 512; })[0];
    root.jQuery('#bvr-block-note').text('At 512 bits — one cache line — the blocked filter measures ' +
      root.Format.percent(line.measured, 3) + ' against the standard filter\'s ' +
      root.Format.percent(blocks.standard.measured, 3) + ', an inflation of ' +
      root.Format.fixed(line.inflation, 2) + '×, and touches ' + root.Format.fixed(line.linesPerQuery, 2) +
      ' lines per query against ' + root.Format.fixed(blocks.standard.linesPerQuery, 2) + '. ' +
      'The two curves meet only when a block is eight lines wide, at which point the whole idea has ' +
      'been given back.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
