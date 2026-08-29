/**
 * Section: Batching, chunking and pipelines.
 *
 * Batch size is one dial with three readings: peak memory, time to first
 * result and total throughput. The curve shows the optimum, and it shows that
 * the optimum for one reading is not the optimum for another.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'batching-pipelines';
  const PER_ITEM_US = 0.4;
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'Batching amortises a fixed per-batch cost — a round trip, a transaction commit, a syscall — ' +
          'over the items in the batch. Larger batches spread that cost further and hold more data in ' +
          'memory while they do it.',
        'Three quantities move as you turn the dial. Total time falls with batch size and then ' +
          'flattens; peak memory rises linearly; time to first result rises linearly. There is no ' +
          'setting that is best for all three, so the choice is which one you are optimising.',
        'The model below is explicit about its assumptions: a per-item cost, a per-batch overhead, ' +
          'and one batch in flight per stage. Real pipelines add backpressure, which M57 covers.'
      ],
      demo: { title: 'Interactive demo — turn the batch-size dial', markup: root.BatchingPipelinesTemplate.render() },
      diagram: {
        title: 'Diagram — where the buffer sits',
        caption: 'The buffer between stages is the batch; its size is the whole trade.',
        definition: [
          'flowchart LR',
          '    S["source"] --> B1["batch buffer<br/>size N"] --> T1["stage 1"] --> B2["batch buffer"] --> T2["stage 2"] --> O["output"]',
          '    B1 -.->|"N large: fewer<br/>overheads,<br/>more memory, later<br/>first result"| T1',
          '    B1 -.->|"N = 1: instant first result,<br/>overhead on every item"| T1'
        ].join('\n')
      },
      insight: 'Time to first result and total throughput pull in opposite directions; choosing a ' +
        'batch size is choosing which one you care about. A pipeline with an unbounded batch is ' +
        'choosing throughput and an outage.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BatchingPipelinesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function model(items, stages, batch, overheadUs) {
    const batches = Math.ceil(items / batch);
    const workUs = items * stages * PER_ITEM_US;
    const overheadTotal = batches * stages * overheadUs;
    const profile = root.SpaceProfile.chunked(items, stages, batch);

    return {
      batch: batch,
      batches: batches,
      totalMs: (workUs + overheadTotal) / 1000,
      firstResultItems: batch * stages,
      peakBytes: profile.peakBytes
    };
  }

  function update(app) {
    const values = panel.values();
    const items = values['batch-items'];
    const stages = values['batch-stages'];
    const overhead = values['batch-overhead'];

    const current = model(items, stages, values['batch-size'], overhead);
    const sweep = sizes(items).map(function (size) { return model(items, stages, size, overhead); });
    const best = sweep.reduce(function (min, entry) { return entry.totalMs < min.totalMs ? entry : min; }, sweep[0]);

    root.MetricGrid.update({
      'batch-peak': {
        value: root.Format.bytes(current.peakBytes),
        note: 'two batches of ' + root.Format.exact(current.batch) + ' items in flight'
      },
      'batch-first': {
        value: root.Format.exact(current.firstResultItems) + ' items',
        note: 'streaming (batch = 1) would emit after ' + stages
      },
      'batch-total': {
        value: root.Format.duration(current.totalMs),
        note: root.Format.exact(current.batches) + ' batches × ' + stages + ' stages of overhead'
      },
      'batch-best': {
        value: root.Format.exact(best.batch),
        note: 'at ' + root.Format.duration(best.totalMs) + '; beyond it the overhead is already amortised'
      }
    });

    draw(app, sweep, current);
  }

  function sizes(items) {
    const out = [];
    for (let size = 1; size <= Math.min(items, 8192); size = Math.max(size + 1, Math.round(size * 1.6))) {
      out.push(size);
    }
    return out;
  }

  function draw(app, sweep, current) {
    chart = root.GrowthPlot.render(root.jQuery('#batch-chart')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      logX: true,
      logY: true,
      series: [
        { label: 'total time (ms)', points: sweep.map(function (e) { return { x: e.batch, y: Math.max(0.001, e.totalMs) }; }) },
        { label: 'peak memory (KB)', points: sweep.map(function (e) { return { x: e.batch, y: Math.max(0.001, e.peakBytes / 1024) }; }), dashed: true },
        { label: 'items before first result', points: sweep.map(function (e) { return { x: e.batch, y: Math.max(1, e.firstResultItems) }; }), dashed: true }
      ],
      markers: [{ x: current.batch, label: 'current', labelY: 12 }],
      xLabel: 'batch size (log)',
      yLabel: 'ms · KB · items (log)',
      legendHost: root.jQuery('#batch-legend')[0],
      summary: function () {
        return 'Total time falls and flattens as the batch grows, while peak memory and time to ' +
          'first result rise linearly with it.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
