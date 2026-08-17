/**
 * Section: Benchmarking methodology.
 *
 * Every protection can be switched off here, and switching one off makes the
 * reported number better. That is the lesson: the most common benchmarking bug
 * is measuring nothing at all, and it always produces impressive results.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'benchmarking';
  // Large enough that one run is several milliseconds: performance.now() is
  // clamped to ~100 µs in browsers, so a smaller workload would quantise.
  const WORKLOAD_SIZE = 400000;
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
        'A timing is a measurement, and a measurement without a protocol is an anecdote. The ' +
          'protocol has four parts: warm up so you are not timing compilation, repeat so you have a ' +
          'distribution, consume the result so the work cannot be deleted, and report a median with ' +
          'its spread and its run count.',
        'Each part is a switch below. Turn one off and the reported number improves — which is ' +
          'exactly why published microbenchmarks are so often wrong. The table at the bottom runs ' +
          'the same workload under four configurations so the sizes of those lies are visible.',
        'The most dangerous configuration is the one with no sink: the engine can prove the result ' +
          'is unused and remove the loop, and you end up reporting the cost of nothing.'
      ],
      demo: { title: 'Interactive demo — break the measurement on purpose', markup: root.BenchmarkingTemplate.render() },
      diagram: {
        title: 'Diagram — a measurement that can be defended',
        caption: 'Every arrow here exists because skipping it changes the number.',
        definition: [
          'flowchart TD',
          '    A["fix the input (seeded)"] --> B["warm up: discard k runs"]',
          '    B --> C["measure n runs"]',
          '    C --> D["consume each result"]',
          '    D --> E["trim outliers"]',
          '    E --> F["report median, MAD, n"]',
          '    F --> G{"MAD > 25% of median?"}',
          '    G -->|yes| H["say so — the median is hiding a bimodal distribution"]',
          '    G -->|no| I["comparable result"]'
        ].join('\n')
      },
      insight: 'The most common benchmarking bug is measuring nothing at all, and it always ' +
        'produces impressively fast numbers. If a result is suspiciously good, check the sink ' +
        'before you check the algorithm.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BenchmarkingTemplate.controls,
      onChange: function (id) { if (id === 'bench-run') measure(app); }
    });

    measure(app);
  }

  /** A workload with a real result, so a sink actually has something to hold. */
  function workload(values) {
    let checksum = 0;
    for (let i = 0; i < values.length; i += 1) {
      checksum = (checksum + Math.imul(values[i] ^ (checksum >>> 3), 0x9e3779b1)) | 0;
    }
    return checksum;
  }

  function makeInput() {
    const rng = root.Random.seeded(4242);
    return rng.ints(WORKLOAD_SIZE, 1e6);
  }

  function runWith(settings, input) {
    const harness = root.BenchHarness.createHarness(settings);
    return harness.run({ task: workload, input: input });
  }

  function measure(app) {
    const values = panel.values();
    const input = makeInput();
    panel.disable('bench-run', true);

    const honest = runWith({ warmup: 5, runs: 21, trim: 0.2, sink: true }, input);
    const chosen = runWith({
      warmup: values['bench-warmup'],
      runs: values['bench-runs'],
      trim: values['bench-trim'],
      sink: values['bench-sink']
    }, input);

    const mean = chosen.samples.reduce(function (sum, value) { return sum + value; }, 0) / chosen.samples.length;

    root.MetricGrid.update({
      'bench-median': { value: root.Format.duration(chosen.medianMs), note: 'median of ' + chosen.runs + ' runs, ' + chosen.warmup + ' warm-up' },
      'bench-mad': {
        value: root.Format.duration(chosen.madMs),
        note: chosen.medianMs ? root.Format.percent(chosen.madMs / chosen.medianMs, 1) + ' of the median' : '—'
      },
      'bench-range': { value: root.Format.duration(chosen.minMs) + ' … ' + root.Format.duration(chosen.maxMs), note: chosen.trimmed + ' samples trimmed' },
      'bench-mean': {
        value: root.Format.duration(mean),
        note: Math.abs(mean - chosen.medianMs) / (chosen.medianMs || 1) > 0.1
          ? 'the mean is well off the median — outliers are moving it'
          : 'close to the median here'
      },
      'bench-vs': {
        value: root.Format.ratio(honest.medianMs, chosen.medianMs) + ' faster',
        note: 'honest protocol reports ' + root.Format.duration(honest.medianMs)
      },
      'bench-warnings': {
        value: chosen.suspicious.length ? String(chosen.suspicious.length) : 'none',
        note: chosen.suspicious[0] || 'this configuration is defensible'
      }
    });

    paintComparison(input, honest);
    panel.disable('bench-run', false);
    draw(app, chosen, honest);
  }

  function paintComparison(input, honest) {
    const configs = [
      { label: 'honest protocol', settings: { warmup: 5, runs: 21, trim: 0.2, sink: true }, hides: 'nothing — this is the baseline' },
      { label: 'no warm-up', settings: { warmup: 0, runs: 21, trim: 0.2, sink: true }, hides: 'includes compilation and cold caches, so it looks slower' },
      { label: 'single run', settings: { warmup: 5, runs: 1, trim: 0, sink: true }, hides: 'no distribution: this is one sample dressed as a result' },
      { label: 'no sink', settings: { warmup: 5, runs: 21, trim: 0.2, sink: false }, hides: 'the work may have been optimised away entirely' }
    ];

    const rows = configs.map(function (config) {
      const result = runWith(config.settings, input);
      return '<tr><td>' + config.label + '</td>' +
        '<td class="mono">' + root.Format.duration(result.medianMs) + ' (n=' + result.runs + ')</td>' +
        '<td class="mono">' + root.Format.ratio(honest.medianMs, result.medianMs) + '</td>' +
        '<td class="note">' + config.hides + '</td></tr>';
    }).join('');

    root.jQuery('#bench-compare tbody').html(rows);
  }

  function draw(app, chosen, honest) {
    const samples = chosen.samples.map(function (value, index) { return { x: index + 1, y: Math.max(value, 1e-4) }; });

    chart = root.GrowthPlot.render(root.jQuery('#bench-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        { label: 'sample', points: samples, dots: true },
        { label: 'reported median', points: [{ x: 1, y: chosen.medianMs }, { x: samples.length, y: chosen.medianMs }], dashed: true },
        { label: 'honest median', points: [{ x: 1, y: honest.medianMs }, { x: samples.length, y: honest.medianMs }], dashed: true }
      ],
      xLabel: 'run',
      yLabel: 'ms',
      yMin: 0,
      legendHost: root.jQuery('#bench-legend')[0],
      summary: function () {
        return chosen.samples.length + ' samples in run order, with the reported median and the ' +
          'median from the honest protocol drawn as lines.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
