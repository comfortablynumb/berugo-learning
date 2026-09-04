/**
 * Section: conditioning, stability and error.
 *
 * The whole milestone rests on one distinction and this section exists to
 * make it unmissable: a small residual does not mean a correct answer. The
 * sweep solves the same system at nine condition numbers, and the residual
 * sits at machine precision throughout while the solution error climbs from
 * 1.6e-16 to 1.9e-1. Nothing warns the caller. The solver did not fail, the
 * algorithm was stable, and the answer has no correct digits.
 *
 * Reporting the residual as evidence of correctness is the single most common
 * mistake in numerical code, and it is so common because the residual is the
 * quantity you can compute without knowing the answer. The condition number
 * is the other half: it says how much of the input's uncertainty the output
 * is entitled to magnify, and it is computable too.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'conditioning-and-error';
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
      title: 'Diagram — where the error comes from, and which part is the algorithm’s fault',
      caption: 'Two things can go wrong and they are independent. The PROBLEM has a condition ' +
        'number, which is how much an input perturbation is magnified on the way to the output — ' +
        'a property of the question, not of any code. The ALGORITHM has a stability, which is ' +
        'whether it introduces more error than the rounding of the inputs already justifies. A ' +
        'stable algorithm on an ill-conditioned problem still returns a bad answer, and that is ' +
        'not a bug to be fixed: the answer is not determined by the data to any better precision.',
      definition: [
        'flowchart TD',
        '    A["exact input"] --> B["rounding: a relative<br/>perturbation of about 1e-16"]',
        '    B --> C["perturbed input"]',
        '    C --> D{"condition number<br/>of the PROBLEM"}',
        '    D -- "kappa = 1" --> E["output error ~ 1e-16<br/>every digit survives"]',
        '    D -- "kappa = 1e8" --> F["output error ~ 1e-8<br/>half the digits gone"]',
        '    D -- "kappa = 1e16" --> G["output error ~ 1<br/>no digits survive"]',
        '    C --> H["a STABLE algorithm adds<br/>no more error than this"]',
        '    H --> I["small residual, always"]',
        '    I -.-> J["which says nothing<br/>about the error"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A small residual does not mean a correct answer.** The residual ‖Ax − b‖ asks whether your ' +
        'answer satisfies the equations as written. The error ‖x − x*‖ asks whether it is the ' +
        'answer.',
      'On a well-conditioned problem those two travel together, and the habit of checking the ' +
        'residual is harmless.',
      'On an ill-conditioned one they separate completely. And the residual is the one you can ' +
        'compute without knowing the answer, which is exactly why it is the one people report.',
      '**The condition number is a property of the problem, not of the code.** It is the factor by ' +
        'which a relative perturbation of the input can be magnified in the output, and it is ' +
        'defined before any algorithm is chosen.',
      'The input is already perturbed by the rounding that stored it — about 10⁻¹⁶. So a condition ' +
        'number of 10⁸ means you may lose half your digits no matter what you do, and 10¹⁶ means ' +
        'you may lose all of them.',
      '**Stability is the separate question of whether the algorithm adds more error than that.** A ' +
        'stable algorithm returns the exact answer to a slightly perturbed problem — that is what ' +
        'backward stability means.',
      'So its error is bounded by the condition number times the rounding, and no better.',
      'Gaussian elimination with partial pivoting is stable. The answer it gives on a Hilbert matrix ' +
        'is still worthless, and both of those statements are true at once.',
      '**So there are two separate diagnoses and they need different fixes.** If the algorithm is ' +
        'unstable, replace it — that is what the next three sections are about.',
      'If the problem is ill-conditioned, no algorithm helps. The answer is not determined by the ' +
        'data, and the fix is to change the problem: reformulate, regularise, or collect better ' +
        'data.',
      'Telling the two apart is the skill, and the condition number is how.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the residual, the error, and the gap between them',
        markup: root.ConditioningAndErrorTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a numerical result looks wrong, compute the condition number before ' +
        'suspecting the code. It is one SVD and it settles the question. If it is large, the ' +
        'answer you are unhappy with may be the best answer the data supports, and no amount of ' +
        'algorithm-swapping will improve it. The corollary is the one that saves the most time: ' +
        '**never report a residual as evidence of correctness**. It is evidence that the solver ' +
        'ran, and on exactly the problems where you most want reassurance it is reassuring and ' +
        'meaningless. If you cannot compute the error because you do not know the answer, say ' +
        'that. A stated uncertainty is worth more than a residual quoted as though it were one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ConditioningAndErrorTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumericLab.conditioningSweep({ size: Number(parts[0]), seed: Number(parts[1]) });
  });

  const hilbertFor = root.Helpers.memoise(function () {
    return root.NumericLab.hilbertLadder();
  });

  function rowFor(rows, condition) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (Math.abs(Math.log10(row.requested) - Math.log10(condition)) <
        Math.abs(Math.log10(best.requested) - Math.log10(condition))) best = row;
    });
    return best;
  }

  function update(app) {
    const values = panel.values();
    const rows = sweepFor(values['ce-size'] + '|' + values['ce-seed']);
    const chosen = rowFor(rows, Number(values['ce-condition']));

    paintMetrics(chosen);
    paintChart(app, rows);
    paintSweep(rows, chosen);
    paintHilbert(hilbertFor(''));
  }

  function paintMetrics(row) {
    root.MetricGrid.update({
      'ce-residual': { value: root.Format.exponential(row.relativeResidual, 3),
        note: 'the solver satisfied the equations to machine precision' },
      'ce-error': { value: root.Format.exponential(row.relativeError, 3),
        note: 'and this is how far the answer is from the truth' },
      'ce-gap': { value: root.Format.exponential(
        row.relativeError / Math.max(row.relativeResidual, Number.MIN_VALUE), 3),
        note: 'the residual is this many times smaller than the error' },
      'ce-digits': { value: root.Format.exact(
        Math.max(0, Math.round(Math.log10(row.measured)))),
        note: 'of the 16 a double carries' }
    });
  }

  function paintChart(app, rows) {
    const host = root.jQuery('#ce-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      logY: true,
      xLabel: 'condition number',
      yLabel: 'relative size',
      series: [
        { label: 'relative residual', dots: true,
          points: rows.map(function (row) {
            return { x: row.measured, y: Math.max(row.relativeResidual, 1e-18) };
          }) },
        { label: 'relative solution error', dots: true,
          points: rows.map(function (row) {
            return { x: row.measured, y: Math.max(row.relativeError, 1e-18) };
          }) },
        { label: 'what the condition number allows', dashed: true,
          points: rows.map(function (row) { return { x: row.measured, y: row.bound }; }) }
      ],
      legendHost: root.jQuery('#ce-legend')[0]
    });

    root.Helpers.setText('ce-chart-note',
      'Both axes are logarithmic. The residual line is flat at machine precision across nine ' +
      'orders of conditioning — the solver is doing its job perfectly at every point on it. The ' +
      'error line climbs at forty-five degrees, which on log-log axes means it is proportional ' +
      'to the condition number, and it sits just under the dashed bound the condition number ' +
      'entitles it to. Nothing in the first line predicts the second.');
  }

  function paintSweep(rows, chosen) {
    root.jQuery('#ce-sweep tbody').html(rows.map(function (row) {
      const mark = row === chosen ? ' class="matrix-row-lit"' : '';
      return '<tr' + mark + '><td class="mono">' + root.Format.exponential(row.measured, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.relativeResidual, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.relativeError, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.bound, 2) + '</td><td>' +
        (row.withinBound ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const worst = rows[rows.length - 1];
    root.Helpers.setText('ce-sweep-note',
      'Read the first two numeric columns across. The residual never leaves the neighbourhood of ' +
      root.Format.exponential(rows[0].relativeResidual, 1) + '; the error goes from ' +
      root.Format.exponential(rows[0].relativeError, 1) + ' to ' +
      root.Format.exponential(worst.relativeError, 1) + '. The fourth column is what the ' +
      'condition number entitles the error to be — machine epsilon times κ — and every row sits ' +
      'inside it, which is what "the algorithm is stable" means. Stable and useless are not ' +
      'contradictory.');
  }

  function paintHilbert(rows) {
    root.jQuery('#ce-hilbert tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.n + '</td><td class="mono">' +
        root.Format.exponential(row.condition, 2) + '</td><td class="mono">' +
        root.Format.exponential(row.relativeResidual, 2) + '</td><td class="mono">' +
        root.Format.exponential(row.relativeError, 2) + '</td><td>' +
        root.Format.exact(row.digitsLost) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ce-hilbert-note',
      'The Hilbert matrix has entries 1/(i + j + 1) — nothing about it looks dangerous, and its ' +
      'condition number multiplies by about a thousand for every two rows. By n = 13 the ' +
      'relative error is ' +
      root.Format.exponential(rows[rows.length - 1].relativeError, 1) + ', which means the ' +
      'answer has no correct digits at all, while the residual is still ' +
      root.Format.exponential(rows[rows.length - 1].relativeResidual, 1) + '. It is ' +
      'ill-conditioned for a reason worth knowing: its columns are samples of 1, x, x², … and ' +
      'those become nearly parallel as the degree rises — which is the same thing that makes ' +
      'polynomial fitting hard in 18.4.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
