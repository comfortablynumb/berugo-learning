/**
 * Section: root finding.
 *
 * Newton's method is the one everybody knows and the one that fails silently.
 * It converges quadratically when it works — the demo fits an order of 1.96
 * from the iterates rather than quoting 2 — and when it does not work it does
 * not report that: it returns a number. The demo reaches all three failure
 * modes from chosen starting points, and the third is the worst, because the
 * answer it gives is a genuine root of the function and simply not the one
 * anywhere near where you started.
 *
 * The convergence-order column is deliberately blank for the bracketing
 * methods. Bisection halves the BRACKET, not the error, and its iterate error
 * is not geometric — fitting an order to it produced a confident 1.857 in an
 * earlier version, which invites a comparison against Newton's 1.96 that means
 * nothing at all. They report their bracket contraction instead, and
 * bisection's is exactly 0.5.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'root-finding';
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
      title: 'Diagram — how Brent chooses, and why it never loses the bracket',
      caption: 'Brent tries the fastest step available and accepts it only if it makes enough ' +
        'progress inside the bracket; otherwise it bisects. The two progress conditions are what ' +
        'make this a hybrid rather than a fast method with a safety net: the interpolated step ' +
        'must land in the bracket’s upper quarter and must have halved the interval since last ' +
        'time, so the bracket shrinks at a guaranteed rate whatever the function does. Bisection ' +
        'is not the fallback for failure — it is the floor under every step.',
      definition: [
        'flowchart TD',
        '    A["a bracket where f changes sign"] --> B{"three distinct<br/>function values?"}',
        '    B -- yes --> C["inverse quadratic<br/>interpolation"]',
        '    B -- no --> D["secant step"]',
        '    C --> E{"inside the upper quarter<br/>AND halving the interval?"}',
        '    D --> E',
        '    E -- yes --> F["take the interpolated step"]',
        '    E -- no --> G["bisect instead"]',
        '    F --> H["shrink the bracket<br/>to keep the sign change"]',
        '    G --> H',
        '    H --> I{"converged?"}',
        '    I -- no --> B',
        '    I -- yes --> J["a root, with the bracket<br/>never given up"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Bisection is the only method here with a guarantee, and it is a strong one.** If the ' +
          'endpoints disagree in sign then a continuous function has a root between them, and ' +
          'halving cannot lose it. The cost is one bit per iteration, always — no faster on an ' +
          'easy function, no slower on a hard one — which is both why it is slow and why it never ' +
          'surprises anybody.',
        '**Newton is fast when it works and silently divergent when it does not.** It follows the ' +
          'tangent to the axis, doubling the number of correct digits each step, and it has three ' +
          'distinct failure modes: a flat derivative throws the iterate far away, a symmetric ' +
          'function can cycle between two points forever, and — worst of all — it can converge ' +
          'perfectly to a root that is not the one near where you started. None of the three ' +
          'raises an error.',
        '**The convergence order is measurable, and it is not the same question as speed.** ' +
          'Fitting the iterate errors gives Newton about 2 and the secant method about 1.618, ' +
          'the golden ratio — which falls out of its error recurrence and is not a coincidence. ' +
          'But Newton needs two evaluations per step and the secant needs one, so on a function ' +
          'whose derivative is expensive the lower order wins on the cost that is actually paid.',
        '**Every production root finder is a hybrid, for exactly this reason.** Brent tries ' +
          'inverse quadratic interpolation, falls back to the secant, and falls back to bisection ' +
          'whenever the interpolated step fails a progress test — so it has the speed of an open ' +
          'method and the guarantee of a bracketing one. False position is the cautionary tale in ' +
          'between: it keeps a bracket and interpolates, and on a convex function one endpoint ' +
          'sticks forever and it degrades to worse than bisection.'
      ],
      demo: {
        title: 'Interactive demo — five methods, three failure modes and two rearrangements',
        markup: root.RootFindingTemplate.render()
      },
      diagram: diagram(),
      insight: 'Use the library’s hybrid unless you have a reason not to, and when you write one ' +
        'yourself, the bracket is the part that matters. The pattern worth internalising is not ' +
        '"Newton is fast" — it is that a fast method with no guarantee plus a slow method with ' +
        'one, combined by a progress test, is better than either, and that shape recurs far ' +
        'beyond root finding: introsort is quicksort with a heapsort floor, a JIT is an ' +
        'interpreter with a compiler on top, and an adaptive integrator is the same idea again. ' +
        'And if you are ever tempted to ship bare Newton, remember the third failure: it does not ' +
        'return an error, it returns a root, and it is the wrong one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RootFindingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const raceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumericLab.rootRace(parts[0],
      { start: Number(parts[1]) / 10, tolerance: Number(parts[2]) });
  });

  const basinsFor = root.Helpers.memoise(function () {
    return root.NumericLab.newtonBasins('multiroot', null, {});
  });

  const fixedFor = root.Helpers.memoise(function () {
    return root.NumericLab.fixedPointPair({});
  });

  function update(app) {
    const values = panel.values();
    const rows = raceFor(values['rf-function'] + '|' + values['rf-start'] + '|' +
      values['rf-tolerance']);

    paintMetrics(rows);
    paintChart(app, rows, values['rf-function']);
    paintRace(rows);
    paintBasins(basinsFor(''));
    paintFixed(fixedFor(''));
  }

  function rowFor(rows, method) {
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].method === method) return rows[i];
    }
    return rows[0];
  }

  function paintMetrics(rows) {
    const converged = rows.filter(function (row) { return row.converged; });
    let cheapest = converged[0] || rows[0];
    converged.forEach(function (row) {
      if (row.evaluations < cheapest.evaluations) cheapest = row;
    });
    const newton = rowFor(rows, 'newton');
    const secant = rowFor(rows, 'secant');

    root.MetricGrid.update({
      'rf-fastest': { value: root.Format.exact(cheapest.evaluations),
        note: cheapest.method + ', at ' + root.Format.exact(cheapest.iterations) + ' iterations' },
      'rf-newton-order': { value: newton.reportOrder === null ? '—'
        : root.Format.fixed(newton.reportOrder, 3),
        note: newton.converged ? 'quadratic is 2' : newton.reason },
      'rf-secant-order': { value: secant.reportOrder === null ? '—'
        : root.Format.fixed(secant.reportOrder, 3),
        note: 'the golden ratio is 1.618' },
      'rf-failures': { value: root.Format.exact(rows.length - converged.length) + ' of ' +
        rows.length,
        note: converged.length === rows.length ? 'every method reached the tolerance'
          : rows.filter(function (row) { return !row.converged; })
            .map(function (row) { return row.method; }).join(', ') }
    });
  }

  function paintChart(app, rows, functionId) {
    const host = root.jQuery('#rf-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();
    const truth = root.NumericLab.functionFor(functionId).truth;

    chart = root.FunctionPlot.convergence(host, {
      lazyLib: app.lazyLib,
      height: 240,
      xLabel: 'iteration',
      yLabel: 'distance from the root',
      series: rows.map(function (row) {
        return { label: row.method, dots: true,
          points: row.trail.map(function (step, index) {
            return { x: index + 1, y: Math.max(Math.abs(step.x - truth), 1e-17) };
          }) };
      }),
      legendHost: root.jQuery('#rf-legend')[0]
    });

    root.Helpers.setText('rf-chart-note',
      'The y axis is logarithmic, so a straight line is linear convergence and a curve bending ' +
      'downwards is superlinear. Bisection is the straight line — one bit per step, forever. ' +
      'Newton is the one that falls off the bottom of the chart in a handful of steps, because ' +
      'each step roughly squares the error. Where a line goes flat, the method has reached the ' +
      'floor a double allows and everything after that is rounding.');
  }

  function paintRace(rows) {
    root.jQuery('#rf-race tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td>' + (row.bracketed ? 'yes' : 'no') +
        '</td><td>' + root.Format.exact(row.iterations) + '</td><td>' +
        root.Format.exact(row.evaluations) + '</td><td>' +
        (row.reportOrder === null ? '—' : root.Format.fixed(row.reportOrder, 3)) +
        '</td><td>' + (row.reportContraction === null ? '—'
          : root.Format.fixed(row.reportContraction, 4)) + '</td><td>' +
        (row.converged ? 'converged' : row.reason) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rf-race-note',
      'The order column is blank for the bracketing methods on purpose. Bisection halves the ' +
      'bracket rather than the error, so its iterate error is not geometric and fitting an order ' +
      'to it produces a number that invites a meaningless comparison — its bracket contraction ' +
      'is exactly 0.5000, which is the real characterisation. False position keeps a bracket too ' +
      'and its contraction is close to 1.0000 on a convex function, which is the same stalling ' +
      'seen from the other side: it interpolates towards the root and one endpoint never moves.');
  }

  function paintBasins(rows) {
    root.jQuery('#rf-basins tbody').html(rows.map(function (row) {
      const wrong = row.converged && row.nearest !== null &&
        Math.abs(row.root - row.nearest) > 1e-6;
      return '<tr' + (wrong ? ' class="matrix-row-lit"' : '') + '><td class="mono">' +
        root.Format.fixed(row.start, 4) + '</td><td class="mono">' +
        (row.converged ? root.Format.fixed(row.root, 6) : '—') + '</td><td class="mono">' +
        (row.nearest === null ? '—' : root.Format.fixed(row.nearest, 6)) + '</td><td>' +
        root.Format.exact(row.iterations) + '</td><td>' +
        (wrong ? 'converged to the WRONG root' : (row.converged ? 'converged' : row.reason)) +
        '</td></tr>';
    }).join(''));

    const wrong = rows.filter(function (row) {
      return row.converged && row.nearest !== null && Math.abs(row.root - row.nearest) > 1e-6;
    }).length;

    root.Helpers.setText('rf-basins-note',
      'x³ − 2x has roots at −√2, 0 and +√2, and its derivative vanishes at ±√(2/3) ≈ 0.8165. ' +
      root.Format.exact(wrong) + ' of these ' + root.Format.exact(rows.length) + ' starting ' +
      'points converge to a root that is not the nearest one — from 0.75 Newton lands on −1.414, ' +
      'crossing the root at 0 to get there. The boundary is the point where the tangent is flat, ' +
      'and it flips at 0.8165 exactly. Nothing about the returned value says which basin it came ' +
      'from: it is a genuine root, correct to fifteen digits, and the wrong one.');
  }

  function paintFixed(rows) {
    root.jQuery('#rf-fixed tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td><td class="mono">' +
        root.Format.fixed(row.factor, 4) + '</td><td>' +
        (row.contraction ? 'yes, |g′| < 1' : 'no, |g′| ≥ 1') + '</td><td>' +
        (row.converged ? 'converged in ' + root.Format.exact(row.iterations) + ' iterations'
          : row.reason) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rf-fixed-note',
      'Both of these solve x² − x − 1 = 0, whose positive root is the golden ratio, and they are ' +
      'the same equation rearranged. The first has |g′| = ' + root.Format.fixed(rows[0].factor, 4) +
      ' at the root and converges; the second has ' + root.Format.fixed(rows[1].factor, 4) +
      ' and does not, from the same starting point. That number is checkable before running ' +
      'anything, which is the useful part: fixed-point iteration is not a method you try and see, ' +
      'it is one whose convergence you can settle in advance by differentiating the rearrangement ' +
      'you chose.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
