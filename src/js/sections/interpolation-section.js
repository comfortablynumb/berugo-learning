/**
 * Section: interpolation and approximation.
 *
 * Runge's phenomenon is the demonstration, because it is the one result here
 * that contradicts an assumption almost everybody holds: that more data points
 * make a fit better. On 1/(1 + 25x²) with equally spaced nodes the error goes
 * from 4.4e-1 at five nodes to 2.6e+2 at twenty-five - three orders of
 * magnitude WORSE for five times the data. Moving the same number of nodes to
 * the Chebyshev positions takes it to 8.2e-3 instead.
 *
 * The overshoot table is the second half, and it is the one that matters in
 * production: both splines pass exactly through every data point, and only one
 * of them stays inside the range of the data. If the quantity is a probability
 * or a price, "interpolates the data exactly" is not enough.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'interpolation';
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
      title: 'Diagram — three ways to draw a curve through points, and what each one costs',
      caption: 'The choice is between one high-degree polynomial and many low-degree pieces, and ' +
        'between placing the nodes and being given them. A single polynomial through equally ' +
        'spaced nodes is the option that fails, and it fails worse the more data you give it. ' +
        'Everything else on this chart works; the differences between them are about what ' +
        'smoothness you need and whether the curve is allowed to leave the range of the data.',
      definition: [
        'flowchart TD',
        '    A["n data points"] --> B["one polynomial<br/>of degree n-1"]',
        '    A --> C["piecewise cubics<br/>a spline"]',
        '    B --> D{"where are<br/>the nodes?"}',
        '    D -- "equally spaced" --> E["Runge: error GROWS<br/>with more nodes"]',
        '    D -- "Chebyshev, clustered<br/>at the ends" --> F["converges<br/>near-optimally"]',
        '    C --> G{"which continuity?"}',
        '    G -- "C2, natural" --> H["smoothest curve;<br/>overshoots the data"]',
        '    G -- "C1, monotone" --> I["stays inside the data;<br/>gives up C2 to do it"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**More data points can make a polynomial fit dramatically worse.** Runge\'s function is ' +
        'perfectly smooth and innocuous.',
      'The polynomial through equally spaced samples of it oscillates wildly near the ends, and the ' +
        'oscillation grows as you add nodes.',
      'This is not a rounding problem and it does not go away in exact arithmetic. It is a property ' +
        'of high-degree polynomials through equally spaced points, and the error grows without ' +
        'bound.',
      '**The fix is where the nodes are, not how many.** Chebyshev nodes cluster towards the ends of ' +
        'the interval, and they are the projections of equally spaced points on a semicircle.',
      'The same degree of polynomial through them converges, and does so nearly as fast as the best ' +
        'polynomial of that degree could.',
      'When you control the sampling, this is a free win. When the data arrives on a uniform grid, ' +
        'it is the reason to reach for something other than one polynomial.',
      '**Splines fit many low-degree pieces instead of one high-degree curve.** A cubic spline runs ' +
        'a separate cubic between each pair of nodes and matches value, slope and curvature where ' +
        'they meet.',
      'So it is C² everywhere while no piece is ever above degree three. The oscillation problem is ' +
        'a high-degree problem, and the spline never has a high degree.',
      'That is why it converges on equally spaced data where the polynomial diverges.',
      '**Passing through every data point is not the same as being usable.** A natural cubic spline ' +
        'through monotone data overshoots. It dips below values that were never below, and rises ' +
        'above ones that were never above, because C² continuity forces it to.',
      'If the quantity is a probability, a price or a mass, that dip is a wrong answer between the ' +
        'points you were given.',
      'Monotone cubics give up C² to guarantee it never happens.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — Runge’s phenomenon, Chebyshev nodes and spline overshoot',
        markup: root.InterpolationTemplate.render()
      },
      diagram: diagram(),
      insight: 'Interpolation is one of the few places where the standard advice is genuinely ' +
        'simple. **Use a cubic spline unless you have a specific reason not to**, and if the data ' +
        'is monotone and the quantity is physical, use a monotone one. The general lesson is ' +
        'broader and worth more than the specific rule. A fit that agrees with the data perfectly ' +
        'can be arbitrarily wrong between the data, and "it passes through every point" is the ' +
        'weakest possible quality claim. It is the same shape as the residual in 18.1: an easily ' +
        'computed quantity that measures agreement with what you specified rather than agreement ' +
        'with what you wanted. Look at the curve between the points, always.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.InterpolationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const sweepFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.nodeSweep({ target: key });
  });

  const curvesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.AnalysisLab.interpolationCurves({ target: parts[0], count: Number(parts[1]) });
  });

  const overshootFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.overshootStudy({});
  });

  function update(app) {
    const values = panel.values();
    const sweep = sweepFor(values['itp-target']);
    const curves = curvesFor(values['itp-target'] + '|' + values['itp-count']);
    const overshoot = overshootFor('');
    const chosen = rowFor(sweep, Number(values['itp-count']));

    paintMetrics(chosen, overshoot);
    paintChart(app, curves, values['itp-curves'] === true || values['itp-curves'] === 'true');
    paintSweep(sweep, chosen);
    paintOvershoot(overshoot);
    paintNodes(curves);
  }

  function rowFor(rows, count) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (Math.abs(row.count - count) < Math.abs(best.count - count)) best = row;
    });
    return best;
  }

  function paintMetrics(chosen, overshoot) {
    const natural = overshoot[0];

    root.MetricGrid.update({
      'itp-equal': { value: root.Format.exponential(chosen.equal, 3),
        note: 'at ' + root.Format.exact(chosen.count) + ' nodes' },
      'itp-chebyshev': { value: root.Format.exponential(chosen.chebyshev, 3),
        note: root.Format.exponential(chosen.equal / chosen.chebyshev, 1) + '× better, same degree' },
      'itp-spline': { value: root.Format.exponential(chosen.spline, 3),
        note: 'degree three, whatever the node count' },
      'itp-overshoot-metric': { value: root.Format.percent(natural.worst / natural.range),
        note: 'the monotone cubic overshoots by ' +
          root.Format.percent(overshoot[1].worst / overshoot[1].range) }
    });
  }

  function paintChart(app, curves, withSpline) {
    const host = root.jQuery('#itp-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const series = [
      { label: curves.label + ' — the truth', points: curves.points.truth },
      { label: 'equally spaced polynomial', points: curves.points.equal },
      { label: 'Chebyshev polynomial', points: curves.points.chebyshev }
    ];
    if (withSpline) series.push({ label: 'cubic spline', dashed: true, points: curves.points.spline });

    chart = root.FunctionPlot.curves(host, {
      lazyLib: app.lazyLib,
      height: 260,
      xLabel: 'x',
      yLabel: 'value',
      clip: { min: -1.5, max: 2.5 },
      series: series,
      legendHost: root.jQuery('#itp-legend')[0]
    });

    root.Helpers.setText('itp-chart-note',
      'The y axis is clipped, because the equally spaced polynomial leaves the frame near the ' +
      'ends and would otherwise flatten everything else into a line. Notice that all of these ' +
      'curves agree exactly at the nodes — the disagreement is entirely between them, which is ' +
      'the only place interpolation is ever used. The oscillation is concentrated at the edges of ' +
      'the interval, and adding nodes makes it larger, not smaller.');
  }

  function paintSweep(rows, chosen) {
    root.jQuery('#itp-sweep tbody').html(rows.map(function (row) {
      return '<tr' + (row === chosen ? ' class="matrix-row-lit"' : '') + '><td>' + row.count +
        '</td><td class="mono">' + root.Format.exponential(row.equal, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.chebyshev, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.spline, 3) + '</td><td>' +
        (row.equal > rows[0].equal ? 'the polynomial got worse' : 'all three improving') +
        '</td></tr>';
    }).join(''));

    const first = rows[0];
    const last = rows[rows.length - 1];
    root.Helpers.setText('itp-sweep-note',
      'Read the second column downwards: from ' + root.Format.exponential(first.equal, 2) +
      ' at ' + root.Format.exact(first.count) + ' nodes to ' +
      root.Format.exponential(last.equal, 2) + ' at ' + root.Format.exact(last.count) +
      '. Five times the data and the answer is ' +
      root.Format.exponential(last.equal / first.equal, 1) + '× worse. The third column is the ' +
      'same degree of polynomial with the nodes moved to the Chebyshev positions — ' +
      root.Format.exponential(last.chebyshev, 2) + ' — and the fourth is a spline on the original ' +
      'equally spaced nodes. Nothing was added to the last two columns; one changed where the ' +
      'nodes are and the other changed the degree of the pieces.');
  }

  function paintOvershoot(rows) {
    root.jQuery('#itp-overshoot tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.fixed(row.above, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.below, 4) + '</td><td class="mono">' +
        root.Format.percent(row.worst / row.range) + '</td><td class="mono">' +
        root.Format.exponential(row.interpolationError, 1) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('itp-overshoot-note',
      'The data is 0, 0, 0, 1, 1, 1, 1 — a step, and monotone increasing throughout. The last ' +
      'column shows both curves pass through every point to machine precision, so neither is ' +
      '"wrong" by the usual test. The natural cubic still dips ' +
      root.Format.fixed(rows[0].below, 3) + ' below zero and rises ' +
      root.Format.fixed(rows[0].above, 3) + ' above one, because C² continuity leaves it no ' +
      'choice: matching curvature at every join forces the curve to swing. If those values are ' +
      'probabilities you have just produced a negative probability from non-negative data, and ' +
      'the fix is to give up C² — which is exactly what the monotone cubic does.');
  }

  function paintNodes(curves) {
    const equal = curves.equal;
    const chebyshev = curves.chebyshev.slice().sort(function (a, b) { return a - b; });
    const shown = Math.min(equal.length, 9);

    const rows = [];
    for (let i = 0; i < shown; i += 1) {
      rows.push('<tr><td>' + i + '</td><td class="mono">' + root.Format.fixed(equal[i], 5) +
        '</td><td class="mono">' + root.Format.fixed(chebyshev[i], 5) + '</td><td class="mono">' +
        (i + 1 < shown ? root.Format.fixed(chebyshev[i + 1] - chebyshev[i], 5) : '—') +
        '</td></tr>');
    }
    root.jQuery('#itp-nodes tbody').html(rows.join(''));

    root.Helpers.setText('itp-nodes-note',
      'The last column is the gap between consecutive Chebyshev nodes, and it grows as you move ' +
      'inwards from the left end — the nodes are dense at the boundaries and sparse in the ' +
      'middle. That is the entire difference between the second and third columns of the sweep ' +
      'above. Geometrically they are equally spaced points on a semicircle projected down onto ' +
      'the interval, and the reason it works is that the error of a polynomial interpolant is ' +
      'proportional to the product of the distances to all the nodes, which the equally spaced ' +
      'layout makes enormous near the ends.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
