/**
 * Section: Space complexity and working set.
 *
 * The same pipeline written three ways, with an accounting allocator recording
 * the peak. Streaming's peak does not depend on n at all, which is the point
 * that time-complexity-only analysis never makes.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'space-complexity';
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
        '**Space is usually the constraint that actually bites, and it is the one ' +
          'interview-style algorithm practice ignores.** The number that matters is the peak: the ' +
          'most live bytes at any instant, not the total ever allocated.',
        'Three shapes of the same pipeline: materialise every stage, process in chunks, or stream ' +
          'one item through. Their time complexity is identical. Their peak memory is Θ(n·stages), ' +
          'Θ(chunk), and Θ(1) respectively.',
        'Time to first result moves the opposite way, which is the real trade: streaming produces ' +
          'output immediately, materialising produces nothing until the last stage finishes.'
      ],
      demo: { title: 'Interactive demo — peak memory of three shapes', markup: root.SpaceComplexityTemplate.render() },
      diagram: {
        title: 'Diagram — where the memory goes',
        caption: 'Same work, same order, three very different peaks.',
        definition: [
          'flowchart LR',
          '    subgraph M["materialised — peak Θ(n · stages)"]',
          '        M1["all items"] --> M2["all items"] --> M3["all items"]',
          '    end',
          '    subgraph C["chunked — peak Θ(chunk)"]',
          '        C1["chunk"] --> C2["chunk"] --> C3["chunk"]',
          '    end',
          '    subgraph S["streaming — peak Θ(1)"]',
          '        S1["item"] --> S2["item"] --> S3["item"]',
          '    end'
        ].join('\n')
      },
      insight: 'Time to first result and total throughput pull in opposite directions, and the ' +
        'batch size is where you choose between them. A pipeline with no bound on its intermediate ' +
        'state is not a fast pipeline, it is an outage waiting for a large input.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SpaceComplexityTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const n = values['space-n'];
    const stages = values['space-stages'];
    const chunk = values['space-chunk'];
    const results = root.SpaceProfile.compare(n, stages, chunk);
    const peaks = {};
    results.forEach(function (result) { peaks[result.shape] = result.peakBytes; });

    const stack = root.SpaceProfile.recursionDepth({ depth: Math.ceil(Math.log2(Math.max(2, n))) });

    root.MetricGrid.update({
      'space-materialised': { value: root.Format.bytes(peaks.materialised), note: stages + ' stages × ' + root.Format.exact(n) + ' items live at once' },
      'space-chunked': { value: root.Format.bytes(peaks.chunked), note: 'two chunks of ' + chunk + ' in flight' },
      'space-streaming': { value: root.Format.bytes(peaks.streaming), note: 'independent of n — this is the whole point' },
      'space-ratio': { value: root.Format.ratio(peaks.materialised, peaks.streaming), note: 'peak saved by streaming' },
      'space-latency': {
        value: 'materialised ' + (stages * n) + ' · streaming ' + stages,
        note: 'stage-completions before the first output appears'
      },
      'space-stack': {
        value: root.Format.bytes(stack.peakBytes),
        note: 'depth ' + stack.depth + ' × ' + stack.frameBytes + " bytes — a recursive traversal's hidden cost"
      }
    });

    draw(app, stages, chunk);
  }

  function draw(app, stages, chunk) {
    const sizes = [];
    for (let n = 500; n <= 50000; n += 2500) sizes.push(n);

    const series = ['materialised', 'chunked', 'streaming'].map(function (shape) {
      return {
        label: shape + ' peak',
        points: sizes.map(function (n) {
          const result = root.SpaceProfile[shape](n, stages, chunk);
          return { x: n, y: Math.max(1, result.peakBytes) };
        })
      };
    });

    chart = root.GrowthPlot.render(root.jQuery('#space-chart')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      logY: true,
      series: series,
      xLabel: 'items',
      yLabel: 'peak bytes (log)',
      legendHost: root.jQuery('#space-legend')[0],
      summary: function () {
        return 'Peak live bytes against input size for the three pipeline shapes at ' + stages +
          ' stages and chunk size ' + chunk + '. The streaming line is flat.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
