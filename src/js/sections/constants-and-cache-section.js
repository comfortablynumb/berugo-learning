/**
 * Section: Constants, cache and the failure of asymptotics.
 *
 * The crossover is measured here, not quoted: same seeded inputs, counted
 * comparisons on one axis, median wall-clock on the other. The two disagree,
 * and the gap between them is exactly what the asymptotic notation drops.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'constants-and-cache';
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
        '**Insertion sort is Θ(n²) and merge sort is Θ(n log n), and for small n insertion sort ' +
          'wins anyway.** The reason is everything the notation throws away: a tiny inner loop, ' +
          'sequential access, no allocation, no recursion.',
        'Measure it. The chart plots counted comparisons and measured medians for both algorithms ' +
          'over the same seeded inputs. The two crossovers land in different places, and that is ' +
          'the point. Operation counts do not predict time when the constants differ this much.',
        'This is why real library sorts are hybrids: merge or quicksort down to a cutoff, then ' +
          'insertion sort. Set the cutoff below and watch the measured curve move.'
      ],
      demo: { title: 'Interactive demo — find the crossover', markup: root.ConstantsAndCacheTemplate.render() },
      diagram: {
        title: 'Diagram — the hybrid dispatch every library sort uses',
        caption: 'The cutoff is a measured constant, not a theoretical one.',
        definition: [
          'flowchart TD',
          '    A["sort(range)"] --> B{"length <= cutoff?"}',
          '    B -->|yes| C["insertion sort<br/>tiny constant, no allocation"]',
          '    B -->|no| D["split, recurse, merge<br/>n log n but heavier per element"]',
          '    D --> A'
        ].join('\n')
      },
      insight: 'The same asymptotic class can differ by 50× in practice, and a worse class can ' +
        'win below the crossover. Ranking algorithms by exponent is a first filter, never a ' +
        'decision. The decision needs the measurement this section makes.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ConstantsAndCacheTemplate.controls,
      onChange: function (id) { if (id === 'cross-run') measure(app); }
    });

    measure(app);
  }

  function sizesUpTo(max) {
    const sizes = [];
    for (let n = 8; n <= max; n = Math.round(n * 1.6)) sizes.push(n);
    if (sizes[sizes.length - 1] !== max) sizes.push(max);
    return sizes;
  }

  function measure(app) {
    const values = panel.values();
    panel.disable('cross-run', true);

    const harness = root.BenchHarness.createHarness({ runs: values['cross-runs'], warmup: 2 });
    const rows = root.CrossoverLab.sweep({
      harness: harness,
      rng: root.Random.seeded(20260816),
      makeOps: function () { return root.Ops.createOps({ limit: 0 }); },
      sizes: sizesUpTo(values['cross-max']),
      cutoff: values['cross-cutoff']
    });

    const byOps = root.CrossoverLab.crossoverOf(rows, function (row, key) { return row[key].ops.cmp || 0; });
    const byTime = root.CrossoverLab.crossoverOf(rows);
    const largest = rows[rows.length - 1];

    root.MetricGrid.update({
      'cross-ops': {
        value: byOps === null ? 'none in range' : 'n = ' + byOps,
        note: 'counted comparisons, exact and machine-independent'
      },
      'cross-time': {
        value: byTime === null ? 'none in range' : 'n = ' + byTime,
        note: 'median of ' + values['cross-runs'] + ' runs, this machine only'
      },
      'cross-gap': {
        value: (byOps === null || byTime === null) ? '—' : Math.abs(byTime - byOps) + ' elements',
        note: byTime && byOps && byTime > byOps
          ? 'merge sort counts fewer comparisons well before it actually gets faster'
          : 'the two measures broadly agree here'
      },
      'cross-hybrid': {
        value: root.Format.duration(largest.merge.medianMs),
        note: 'merge at n = ' + largest.n + ' with cutoff ' + values['cross-cutoff'] +
          ' · insertion ' + root.Format.duration(largest.insertion.medianMs)
      }
    });

    panel.disable('cross-run', false);
    draw(app, rows);
  }

  function draw(app, rows) {
    const scaleTime = 1;
    chart = root.GrowthPlot.render(root.jQuery('#cross-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      series: [
        { label: 'insertion — comparisons', points: rows.map(function (r) { return { x: r.n, y: Math.max(1, r.insertion.ops.cmp || 1) }; }) },
        { label: 'merge — comparisons', points: rows.map(function (r) { return { x: r.n, y: Math.max(1, r.merge.ops.cmp || 1) }; }) },
        { label: 'insertion — median ms', points: rows.map(function (r) { return { x: r.n, y: Math.max(1e-4, r.insertion.medianMs * scaleTime) }; }), dashed: true },
        { label: 'merge — median ms', points: rows.map(function (r) { return { x: r.n, y: Math.max(1e-4, r.merge.medianMs * scaleTime) }; }), dashed: true }
      ],
      xLabel: 'n',
      yLabel: 'comparisons and ms (log)',
      legendHost: root.jQuery('#cross-legend')[0],
      summary: function () {
        return 'Counted comparisons and measured medians for insertion sort and merge sort across ' +
          rows.length + ' sizes up to n = ' + rows[rows.length - 1].n + ', log scale.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
