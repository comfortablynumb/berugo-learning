/**
 * Section: floating-point hazards.
 *
 * Every number in this section is scored against the exact sum of exactly the
 * doubles in the array, computed in BigInt. That reference is what makes the
 * section a measurement rather than a warning, and it also produces the one
 * reading that looks like a contradiction: the `exact` row has a non-zero
 * error. It does, and it must - the true sum of a list of doubles is generally
 * not itself a double, so returning one costs up to half a unit in the last
 * place. That residue is the floor. Compensated summation reaching exactly the
 * same value is the strongest statement available about it.
 *
 * The dataset generator is worth a warning for anyone editing this section.
 * `Random.seeded` yields uint32 / 2^32, which carries only 32 significant
 * bits, and a sum of fewer than 2^21 such values is exactly representable - so
 * naive summation over them scores a relative error of exactly zero and the
 * whole section demonstrates the opposite of its claim. `FloatLab.unit` widens
 * the draw to a full 53-bit mantissa for that reason; it was found by the
 * measurement, not by reasoning ahead.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'floating-point-hazards';
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
      title: 'Diagram — one step of Kahan compensation',
      caption: 'The addition `sum + y` throws away the low bits of y that did not fit. Kahan ' +
        'recovers them: `t − sum` is the part of y that DID make it into the total, so ' +
        '`(t − sum) − y` is exactly the part that did not, and carrying that forward means the ' +
        'next addition begins by repaying the last one’s rounding. Four operations instead of ' +
        'one, and an error bound that no longer grows with the number of terms.',
      definition: [
        'flowchart TD',
        '    A["y = value − compensation<br/>repay what was lost last time"] --> B["t = sum + y<br/>this is where rounding happens"]',
        '    B --> C["t − sum<br/>the part of y that survived"]',
        '    C --> D["compensation = (t − sum) − y<br/>the part that did not"]',
        '    D --> E["sum = t"]',
        '    E --> F{"more values?"}',
        '    F -- yes --> A',
        '    F -- no --> G["sum, with the error bound<br/>independent of n"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Floating-point addition is commutative and not associative.** `(a + b) + c` and ' +
          '`a + (b + c)` are different computations of one quantity and they are allowed to ' +
          'disagree, so summing an array left to right, in sorted order, and by a parallel ' +
          'reduction gives three answers and none of them is the bug. This is the honest ' +
          'explanation for "the batch job and the streaming job produce different totals", and ' +
          'the demo shows the same array in four orders landing on four different doubles.',
        '**Error accumulates because the accumulator outgrows the addend.** Once the running ' +
          'total is large, each new small value loses its low bits to rounding — and when the ' +
          'values share a sign those losses all go the same way rather than cancelling, so the ' +
          'error grows with n rather than with its square root. Past the point where the addend ' +
          'is smaller than half the local gap between doubles, it is absorbed completely and ' +
          'contributes nothing at all.',
        '**Compensated summation fixes it for three or four extra operations per element.** ' +
          'Kahan keeps the discarded low part in a second variable and feeds it back on the next ' +
          'step; Neumaier fixes the case Kahan gets wrong, where the incoming value is larger ' +
          'than the running sum and it is the *sum* whose bits are lost. Pairwise summation is ' +
          'the cheap middle: no extra arithmetic at all, just a different association, and the ' +
          'error grows with log n instead of n.',
        '**Catastrophic cancellation is the other failure and it needs a different fix.** ' +
          'Subtracting two nearly equal numbers does not introduce error — it *exposes* error ' +
          'that was already in the operands, by throwing away the leading digits they agreed on. ' +
          'No amount of compensation helps; the formula has to be rewritten so the subtraction ' +
          'never happens. The quadratic formula and the one-pass variance are the two canonical ' +
          'examples, and both are in the demo with their stable replacements.'
      ],
      demo: {
        title: 'Interactive demo — summation, ordering, variance and cancellation',
        markup: root.FloatingPointHazardsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Two rules cover most of what a working engineer needs. **Sum with pairwise or ' +
        'Kahan whenever the count is large and the result is reported to a user** — the cost is ' +
        'a few operations per element against an error that otherwise grows linearly, and no ' +
        'profile will ever tell you it mattered because the wrong answer is fast. **Compute ' +
        'variance with Welford, never with the sum of squares** — the textbook one-pass formula ' +
        'subtracts two large nearly equal numbers by construction, and on values clustered far ' +
        'from zero it is wrong by five orders of magnitude and can return a negative variance, ' +
        'which is not merely inaccurate but impossible. And when two systems disagree on a total, ' +
        'check the summation order before looking for a bug: it is usually not one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FloatingPointHazardsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function settingsFor() {
    const values = panel.values();
    return {
      dataset: values['fpz-dataset'],
      count: Number(values['fpz-count']),
      seed: Number(values['fpz-seed']),
      quadratic: Number(values['fpz-quadratic'])
    };
  }

  function key(settings) {
    return settings.dataset + '|' + settings.count + '|' + settings.seed;
  }

  const summationFor = root.Helpers.memoise(function (id) {
    const parts = id.split('|');
    return root.FloatLab.summationRun({ dataset: parts[0], count: Number(parts[1]),
      seed: Number(parts[2]) });
  });

  const seriesFor = root.Helpers.memoise(function (id) {
    const parts = id.split('|');
    return root.FloatLab.errorSeries({ dataset: parts[0], count: Number(parts[1]),
      seed: Number(parts[2]), samples: 24 });
  });

  const ordersFor = root.Helpers.memoise(function (id) {
    const parts = id.split('|');
    return root.FloatLab.orderSensitivity({ dataset: parts[0], count: Number(parts[1]),
      seed: Number(parts[2]) });
  });

  /* Variance is measured on the clustered dataset whatever the summation
     control says. The failure it demonstrates needs values far from zero, and
     a table that silently reports "no error" on the uniform dataset would read
     as evidence that the naive formula is fine. */
  const varianceFor = root.Helpers.memoise(function (id) {
    const parts = id.split('|');
    return root.FloatLab.varianceRun({ dataset: 'clustered', count: Number(parts[0]),
      seed: Number(parts[1]) });
  });

  const quadraticFor = root.Helpers.memoise(function (id) {
    return root.FloatLab.quadraticRoots(1, Math.pow(10, Number(id)), 1);
  });

  const absorptionFor = root.Helpers.memoise(function () {
    return root.FloatLab.absorptionLadder(1e16, [0.5, 1, 1.5, 2, 3, 4]);
  });

  function update(app) {
    const settings = settingsFor();
    const id = key(settings);
    const run = summationFor(id);

    paintMetrics(run, ordersFor(id), varianceFor(settings.count + '|' + settings.seed));
    paintChart(app, seriesFor(id), run);
    paintMethods(run);
    paintOrders(ordersFor(id));
    paintVariance(varianceFor(settings.count + '|' + settings.seed));
    paintCancellation(quadraticFor(String(settings.quadratic)), settings.quadratic);
    paintAbsorption(absorptionFor(''));
  }

  function paintMetrics(run, orders, variance) {
    const naiveSums = orders.map(function (row) { return row.naive; });
    const spread = Math.max.apply(null, naiveSums) - Math.min.apply(null, naiveSums);
    const worstVariance = variance.rows[0];

    root.MetricGrid.update({
      'fpz-naive': { value: root.Format.exponential(run.rows[0].relativeError, 3),
        note: 'absolute error ' + root.Format.exponential(run.rows[0].absoluteError, 3) },
      'fpz-kahan': { value: root.Format.exponential(run.rows[2].relativeError, 3),
        note: run.rows[2].relativeError <= run.rows[4].relativeError
          ? 'the same double the exact sum rounds to' : 'still above the rounding floor' },
      'fpz-spread': { value: root.Format.exponential(spread, 3),
        note: 'between the best and worst of four orderings' },
      'fpz-variance': { value: root.Format.exponential(worstVariance.relativeError, 3),
        note: worstVariance.negative ? 'and the answer came out NEGATIVE'
          : 'against Welford at ' +
            root.Format.exponential(variance.rows[2].relativeError, 3) }
    });
  }

  function paintChart(app, series, run) {
    const host = root.jQuery('#fpz-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'values summed so far',
      yLabel: 'absolute error against the exact sum',
      series: series.map(function (entry) {
        return { label: entry.id, dots: true,
          points: entry.points.map(function (point) { return { x: point.n, y: point.error }; }) };
      }),
      legendHost: root.jQuery('#fpz-legend')[0]
    });

    root.Helpers.setText('fpz-chart-note',
      'The y axis is logarithmic. The naive line climbs steadily because on same-signed data ' +
      'every rounding goes the same way and the errors add rather than cancel; pairwise sits far ' +
      'below it for no extra arithmetic at all, purely by associating differently; Kahan sits at ' +
      'the floor. At the full ' + root.Format.exact(run.count) + ' values the naive error is ' +
      root.Format.exponential(run.rows[0].absoluteError, 3) + ' and Kahan’s is ' +
      root.Format.exponential(run.rows[2].absoluteError, 3) + '.');
  }

  function paintMethods(run) {
    root.jQuery('#fpz-methods tbody').html(run.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.exponential(row.sum, 12) + '</td><td class="mono">' +
        root.Format.exponential(row.relativeError, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.absoluteError, 3) + '</td><td>' +
        root.Format.exact(row.operations) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fpz-methods-note',
      'The last row is the exact sum of exactly these doubles, computed in BigInt and then ' +
      'rounded into a double — and its error is not zero, because the true total is generally ' +
      'not representable. That residue is the floor no method returning a double can beat, and ' +
      'compensated summation reaching the same value is the strongest possible statement about ' +
      'it. The operation counts are the price: Kahan is four operations per element against one.');
  }

  function paintOrders(rows) {
    root.jQuery('#fpz-orders tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.exponential(row.naive, 14) + '</td><td>' +
        root.Format.exact(Number(row.naiveUlps)) + '</td><td class="mono">' +
        root.Format.exponential(row.kahan, 14) + '</td><td>' +
        root.Format.exact(Number(row.kahanUlps)) + '</td></tr>';
    }).join(''));

    const distinct = new Set(rows.map(function (row) { return row.naive; })).size;
    root.Helpers.setText('fpz-orders-note',
      'Four orderings of one array, and the naive column holds ' + root.Format.exact(distinct) +
      ' distinct values. None of them is a bug — floating-point addition is not associative, so ' +
      'these are four different computations. Smallest-first is the best of the four, which is ' +
      'the folk advice and is genuinely right for same-signed data; it is also the ordering a ' +
      'parallel reduction cannot give you. The Kahan column is the same value in all four here, ' +
      'which is the real argument for compensation — though it is worth stating precisely: ' +
      'compensation does not make summation associative, it removes the LINEAR growth of the ' +
      'error with n. On other data the four compensated sums can differ, by an ulp or two rather ' +
      'than by the tens of thousands the naive column spans.');
  }

  function paintVariance(variance) {
    root.jQuery('#fpz-var-table tbody').html(variance.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Format.exponential(row.variance, 8) + '</td><td class="mono">' +
        root.Format.exponential(row.relativeError, 3) + '</td><td>' +
        (row.negative ? 'YES' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fpz-var-note',
      'Measured on values clustered around 10⁹ whatever the summation control says, because that ' +
      'is the shape the failure needs. The one-pass formula forms Σx² − (Σx)²/n, which subtracts ' +
      'two enormous nearly equal numbers and keeps almost none of the digits: it is wrong by ' +
      root.Format.exponential(variance.rows[0].relativeError, 2) + ' relative. Two passes is the ' +
      'most accurate and needs the data twice; Welford is one pass with constant state and is ' +
      'the one a streaming metrics pipeline can actually use — its error, ' +
      root.Format.exponential(variance.rows[2].relativeError, 2) + ', is larger than the ' +
      'two-pass figure and that is the honest trade.');
  }

  function paintCancellation(roots, exponent) {
    const rows = [
      { name: 'the textbook (−b + √(b² − 4ac)) / 2a', value: roots.naive,
        residual: roots.naiveResidual },
      { name: 'rewritten as −2c / (b + √(b² − 4ac))', value: roots.stable,
        residual: roots.stableResidual }
    ];

    root.jQuery('#fpz-cancel tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Format.exponential(row.value, 12) + '</td><td class="mono">' +
        root.Format.exponential(row.residual, 3) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fpz-cancel-note',
      'x² + 10' + superscript(exponent) + 'x + 1, whose small root is very close to −10' +
      superscript(-exponent) + '. In the textbook form, √(b² − 4ac) is almost exactly b, so ' +
      '−b + √(…) subtracts two nearly equal numbers and the leading digits they agree on are ' +
      'thrown away — about ' + root.Format.exact(roots.digitsLost) + ' significant digits gone. ' +
      'The rewritten form multiplies by the conjugate so that subtraction never happens; the two ' +
      'roots are ' + root.Format.exact(Number(roots.ulps)) + ' representable doubles apart, and ' +
      'substituting each back into the equation shows which one is the answer.');
  }

  const SUPERSCRIPTS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶',
    7: '⁷', 8: '⁸', 9: '⁹' };

  function superscript(value) {
    return String(value).split('').map(function (character) {
      return SUPERSCRIPTS[character] || character;
    }).join('');
  }

  function paintAbsorption(rows) {
    root.jQuery('#fpz-absorb tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">10¹⁶ + ' + row.addend + '</td><td class="mono">' +
        root.Format.exponential(row.sum, 17) + '</td><td>' +
        (row.changed ? 'yes' : 'NO') + '</td><td>' + root.Format.fixed(row.ratio, 2) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('fpz-absorb-note',
      'The gap between representable doubles at 10¹⁶ is ' +
      root.Format.exact(rows[0].ulp) + '. An addend smaller than half that gap rounds away ' +
      'entirely and the sum is unchanged — which is what "absorption" means, and why summing a ' +
      'million small values into a large accumulator can lose every one of them while every ' +
      'individual addition is correctly rounded. Nothing overflowed, nothing was NaN, and no ' +
      'error was reported.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
