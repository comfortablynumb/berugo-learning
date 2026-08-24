/**
 * Section: differentiation, integration and autodiff.
 *
 * The V curve is the picture worth carrying away from the whole milestone: on
 * the right, truncation error falling as the step shrinks; on the left,
 * rounding error rising as the subtraction cancels; and a floor in between
 * that no amount of care gets under. It is the clearest instance of a
 * trade-off between the two error sources that every numerical method has.
 *
 * Then autodiff removes the trade-off entirely, which is the point of putting
 * it in the same section. It is not a better finite difference - there is no
 * step size, no subtraction and no truncation, because it differentiates the
 * program rather than sampling the function. The gradients are exact to
 * machine precision, and reverse mode gets ALL of them for a cost that does
 * not grow with the number of inputs.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'differentiation-and-autodiff';
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
      title: 'Diagram — a computation graph, its forward values and its reverse adjoints',
      caption: 'Forward mode carries one input\'s derivative through the graph, so n inputs need n ' +
        'sweeps. Reverse mode records the graph on the way forward and then walks it backwards ' +
        'once, applying the chain rule at each node, and every input\'s derivative falls out of ' +
        'that single sweep. The cost of the backward pass is a small constant times the forward ' +
        'pass regardless of how many inputs there are, which is the entire reason a model with ' +
        'billions of parameters can be trained at all.',
      definition: [
        'flowchart LR',
        '    X["x = 0.4"] --> M["mul<br/>x*y = 0.52"]',
        '    Y["y = 1.3"] --> M',
        '    M --> S["sin<br/>0.4969"]',
        '    X --> E["exp<br/>1.4918"]',
        '    S --> A["add<br/>f = 1.9887"]',
        '    E --> A',
        '    A -.->|"adjoint 1"| S',
        '    A -.->|"adjoint 1"| E',
        '    S -.->|"x cos(xy)"| M',
        '    M -.->|"y"| X',
        '    M -.->|"x"| Y',
        '    E -.->|"exp(x)"| X'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A finite difference has two errors pulling in opposite directions, and the best step ' +
          'is where they cross.** Shrink h and the truncation error — the terms of the Taylor ' +
          'series you dropped — falls; shrink it further and the subtraction f(x+h) − f(x) starts ' +
          'cancelling significant digits, and the rounding error rises as 1/h. Plotted against h ' +
          'on log axes the total error is a V, and the bottom of it is a floor: no step size gets ' +
          'you below it.',
        '**Each rule has a different optimum, and both are predictable.** A forward difference ' +
          'balances at about √ε ≈ 1.5 × 10⁻⁸ and bottoms out near 10⁻⁸ error — half the digits ' +
          'gone. A central difference has a smaller truncation term, balances at ∛ε ≈ 6 × 10⁻⁶ and ' +
          'reaches about 10⁻¹¹. The demo finds these by sweeping rather than by quoting them, and ' +
          'the measured minima land on the predicted ones.',
        '**The complex step trick removes the subtraction and therefore the floor.** Evaluate the ' +
          'function at x + ih and take the imaginary part over h: the two terms never cancel, ' +
          'because they were never subtracted, so h can go to 10⁻¹⁶⁰ and the error stays at zero. ' +
          'It costs a complex-arithmetic rewrite of the function and only works for analytic ' +
          'ones — but where it applies it is exact, and it is the bridge to why autodiff is ' +
          'possible.',
        '**Reverse-mode autodiff costs about the same as one forward evaluation, however many ' +
          'inputs there are.** It records every operation on a tape as the function runs, then ' +
          'walks the tape backwards accumulating adjoints by the chain rule. One backward sweep ' +
          'yields the whole gradient. Forward mode needs one sweep per input, so on 24 inputs it ' +
          'costs about ten times as much — and on a billion parameters the comparison stops being ' +
          'a comparison.'
      ],
      demo: {
        title: 'Interactive demo — the V curve, four quadrature rules and both autodiff modes',
        markup: root.DifferentiationAndAutodiffTemplate.render()
      },
      diagram: diagram(),
      insight: 'If you are computing gradients by finite differences in production code, you are ' +
        'paying twice: once in accuracy — you get eight correct digits where autodiff gives ' +
        'sixteen — and once in cost, because a finite-difference gradient needs one extra ' +
        'evaluation per input while reverse mode needs one backward sweep for all of them. Both ' +
        'penalties grow with the number of parameters, which is why every deep-learning framework ' +
        'is, structurally, a reverse-mode autodiff engine with an operator library attached. ' +
        'Finite differences keep exactly one job: **checking that your analytic gradient is ' +
        'right**. Compare against a central difference at h = 10⁻⁶, expect agreement to about ' +
        'eight digits, and be suspicious if it is much better or much worse.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DifferentiationAndAutodiffTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const stepFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.stepStudy({ at: Number(key) / 10 });
  });

  const quadratureFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.quadratureRace({ panels: Number(key) });
  });

  const gaussFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.gaussExactness({});
  });

  const raceFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.autodiffRace({});
  });

  const tapeFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.tapeGraph(key);
  });

  function update(app) {
    const values = panel.values();
    const step = stepFor(values['ad-at']);
    const race = raceFor('');

    paintMetrics(step, race);
    paintChart(app, step);
    paintStep(step);
    paintQuadrature(quadratureFor(values['ad-panels']), Number(values['ad-panels']));
    paintGauss(gaussFor(''));
    paintRace(race);
    paintTape(tapeFor(values['ad-fixture']));
  }

  function paintMetrics(step, race) {
    const widest = race[race.length - 1];

    root.MetricGrid.update({
      'ad-forward-h': { value: root.Format.exponential(step.forward.h, 0),
        note: '√ε is ' + root.Format.exponential(step.predictedForward, 2) },
      'ad-central-h': { value: root.Format.exponential(step.central.h, 0),
        note: '∛ε is ' + root.Format.exponential(step.predictedCentral, 2) },
      'ad-complex': { value: root.Format.exponential(step.complex.error, 2),
        note: 'at h = ' + root.Format.exponential(step.complex.h, 0) },
      'ad-ratio': { value: root.Format.fixed(widest.ratio, 2) + '×',
        note: 'forward mode’s operations, over reverse mode’s, on ' +
          root.Format.exact(widest.inputs) + ' inputs' }
    });
  }

  function paintChart(app, step) {
    const host = root.jQuery('#ad-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 250,
      logX: true,
      logY: true,
      xLabel: 'step size h',
      yLabel: 'error',
      series: ['forward', 'central', 'richardson', 'complex'].map(function (key) {
        return { label: key + ' difference', dots: true,
          points: step.sweep.map(function (row) {
            return { x: row.h, y: Math.max(row[key], 1e-18) };
          }) };
      }),
      legendHost: root.jQuery('#ad-legend')[0]
    });

    root.Helpers.setText('ad-chart-note',
      'Read right to left. On the right, h is large and the truncation error dominates — the ' +
      'Taylor terms you threw away. Moving left it falls, until the subtraction f(x+h) − f(x) ' +
      'starts cancelling significant digits and the rounding error takes over, rising as 1/h. The ' +
      'bottom of each V is the best that rule can do at any step size. The complex-step line is ' +
      'the flat one: it never subtracts, so it has no left-hand branch at all and stays at zero ' +
      'error all the way down.');
  }

  function paintStep(step) {
    const rows = [
      { label: 'forward difference', best: step.forward, predicted: step.predictedForward },
      { label: 'central difference', best: step.central, predicted: step.predictedCentral },
      { label: 'complex step', best: step.complex, predicted: null }
    ];

    root.jQuery('#ad-step tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.exponential(row.best.h, 0) + '</td><td class="mono">' +
        (row.predicted === null ? 'no optimum — any h works'
          : root.Format.exponential(row.predicted, 2)) + '</td><td class="mono">' +
        root.Format.exponential(row.best.error, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ad-step-note',
      'The predicted optima come from balancing the two error terms: √ε for a forward difference ' +
      'because its truncation is O(h) against rounding O(ε/h), and ∛ε for a central difference ' +
      'because its truncation is O(h²). The sweep steps by decades, so the measured minimum is the ' +
      'nearest decade to each prediction — which is all a decade-spaced sweep can resolve, and it ' +
      'is the right decade in both cases. Note the practical ' +
      'consequence in the last column — the best a forward difference can ever do here is about ' +
      root.Format.exponential(step.forward.error, 1) + ', which is eight correct digits out of ' +
      'sixteen, and it is not a bug you can fix by tuning h.');
  }

  function paintQuadrature(rows, panels) {
    root.jQuery('#ad-quadrature tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td class="mono">' +
        root.Format.fixed(row.value, 12) + '</td><td class="mono">' +
        root.Format.exponential(row.error, 2) + '</td><td>' +
        root.Format.exact(row.evaluations) + '</td></tr>';
    }).join(''));

    const gauss = rows[2];
    const simpson = rows[1];
    root.Helpers.setText('ad-quadrature-note',
      'The integral is ∫₀¹ eˣ dx = e − 1, and the last column is what stops this being a ' +
      'meaningless race: an accurate rule that evaluates the function a hundred times has not won ' +
      'anything if the function is a simulation. Gauss–Legendre reaches ' +
      root.Format.exponential(gauss.error, 1) + ' in ' + root.Format.exact(gauss.evaluations) +
      ' evaluations against Simpson’s ' + root.Format.exponential(simpson.error, 1) + ' in ' +
      root.Format.exact(simpson.evaluations) + ', because it chooses where to sample instead of ' +
      'accepting a uniform grid. Adaptive Simpson is the row that looks worst here and is not: it ' +
      'reached the requested tolerance exactly, and it spent ' +
      root.Format.exact(rows[3].evaluations) + ' evaluations doing so on an integrand smooth ' +
      'enough that the adaptation had nothing to find. Its case is the opposite one — an ' +
      'integrand with a spike or a kink, where a uniform grid has to be fine everywhere to ' +
      'resolve one small region and adaptation spends its evaluations only where the error ' +
      'estimate says they are needed. Your panel count is ' + root.Format.exact(panels) + '.');
  }

  function paintGauss(rows) {
    root.jQuery('#ad-gauss tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.points + '</td><td>' + row.exactDegree + '</td><td class="mono">' +
        root.Format.exponential(row.errorAtExact, 2) + '</td><td class="mono">' +
        root.Format.exponential(row.errorBeyond, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ad-gauss-note',
      'n points give you 2n free parameters — n positions and n weights — and the rule is built by ' +
      'spending all of them, so it integrates every polynomial up to degree 2n − 1 exactly. The ' +
      'third column is at machine precision and the fourth is not, which is the boundary being ' +
      'attained rather than merely claimed. This is why Gauss beats Simpson so heavily on smooth ' +
      'integrands and why it is the wrong choice on a discontinuous one: the guarantee is about ' +
      'polynomials, and a step function is not close to any of them.');
  }

  function paintRace(rows) {
    root.jQuery('#ad-race tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + row.inputs + '</td><td class="mono">' +
        root.Format.exponential(row.forwardError, 1) + '</td><td class="mono">' +
        root.Format.exponential(row.reverseError, 1) + '</td><td class="mono">' +
        root.Format.exponential(row.centralError, 1) + '</td><td>' +
        root.Format.exact(row.forwardPasses) + '</td><td>' +
        root.Format.exact(row.reversePasses) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 2) + '×</td></tr>';
    }).join(''));

    const widest = rows[rows.length - 1];
    root.Helpers.setText('ad-race-note',
      'Both autodiff columns are zero or at machine precision on every row — these are not ' +
      'approximations of the derivative, they are the derivative, computed by applying the chain ' +
      'rule to the operations the program actually performed. The central-difference column beside ' +
      'them is off by between 10⁻¹¹ and 10⁻⁸ depending on the function, which is the floor from the ' +
      'V curve and not a tolerance anyone chose. Then read the pass counts: ' +
      'forward mode needs one sweep per input and reverse mode needs one in total, so on the ' +
      root.Format.exact(widest.inputs) + '-input fixture forward mode does ' +
      root.Format.fixed(widest.ratio, 1) + '× the work. Extend that axis to a billion parameters ' +
      'and you have the reason backpropagation exists.');
  }

  function paintTape(tape) {
    root.jQuery('#ad-tape tbody').html(tape.nodes.map(function (node) {
      return '<tr' + (node.isOutput ? ' class="matrix-row-lit"' : '') + '><td>' + node.index +
        '</td><td class="mono">' + (node.parents.length ? node.parents.join(', ') : '—') +
        '</td><td class="mono">' + root.Format.fixed(node.value, 6) + '</td><td class="mono">' +
        (node.partials.length ? node.partials.map(function (value) {
          return root.Format.fixed(value, 4);
        }).join(', ') : '—') + '</td><td class="mono">' +
        root.Format.fixed(node.adjoint, 6) + '</td><td>' +
        (node.isInput ? 'input' : (node.isOutput ? 'output' : 'intermediate')) + '</td></tr>';
    }).join(''));

    const inputs = tape.nodes.filter(function (node) { return node.isInput; });
    root.Helpers.setText('ad-tape-note',
      'This is the tape for ' + tape.label + ', in the order the operations ran. Each row stores ' +
      'its value and the local partial derivative with respect to each parent — that is all the ' +
      'forward pass records. The adjoint column is filled in by the backward sweep: the output ' +
      'starts at 1, and each node passes its adjoint to its parents multiplied by the local ' +
      'partial. When the sweep reaches the input rows, their adjoints are the gradient: ' +
      inputs.map(function (node) {
        return '∂f/∂x' + root.Format.exact(node.index) + ' = ' +
          root.Format.fixed(node.adjoint, 4);
      }).join(', ') + '. Every input was filled in by the same single walk down the table.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
