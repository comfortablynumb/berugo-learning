/**
 * Section: optimisation.
 *
 * The step size is the whole story, and the demo prices it three ways.
 *
 * A fixed step of 0.01 on Rosenbrock diverges to 4.1e35 in five iterations. A
 * fixed step of 0.001 survives and reaches 3.8e-3 after five thousand - the two
 * are one factor of ten apart. A line search, with no step size to choose at
 * all, reaches 9.1e-7 in the same iteration budget, at six times the gradient
 * evaluations. That is the argument against the hyperparameter: it is not that
 * it is hard to tune, it is that tuning it is solving a problem the algorithm
 * can solve for itself at every iteration, with better information than you
 * have - and the extra evaluations are what that information costs.
 *
 * The condition study is the second half. Gradient descent's iteration count
 * tracks the condition number - 2 at kappa = 1, 9244 at kappa = 1000 - and
 * Newton's is 2 at every single one, because Newton is affine invariant and
 * descent is not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'optimisation';
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
      title: 'Diagram — a backtracking line search, and the condition it has to satisfy',
      caption: 'The Armijo condition asks for a decrease proportional to the step taken and the ' +
        'slope in that direction — not just any decrease, which a tiny step could always achieve. ' +
        'Backtracking starts optimistically and halves until the condition holds, so the step is ' +
        'chosen from what the function actually does rather than from a constant you guessed ' +
        'before seeing the surface. The loop is guaranteed to terminate for a descent direction, ' +
        'which is why this removes the hyperparameter rather than hiding it.',
      definition: [
        'flowchart TD',
        '    A["at x, with gradient g"] --> B["direction d = -g<br/>(or a quasi-Newton direction)"]',
        '    B --> C["start with a generous step t"]',
        '    C --> D{"f(x + t*d) <= f(x)<br/>+ c*t*(g dot d) ?"}',
        '    D -- no --> E["t := t / 2"]',
        '    E --> D',
        '    D -- yes --> F["accept: x := x + t*d"]',
        '    F --> G{"gradient<br/>small enough?"}',
        '    G -- no --> A',
        '    G -- yes --> H["a stationary point"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Convexity is the dividing line, and it is what "solved" means here.** On a convex ' +
          'function every local minimum is the global one and a descent method that stops has ' +
          'finished; off it, the same method stops somewhere and cannot tell you what. That is ' +
          'why linear and convex programs have guarantees and neural network training has ' +
          'heuristics — the algorithms are similar, and the claims you can make about their ' +
          'output are not.',
        '**A fixed step size is a hyperparameter with a cliff on one side and a crawl on the ' +
          'other.** Above the stability limit — twice the reciprocal of the largest curvature — ' +
          'gradient descent diverges, and not gracefully: it explodes in a handful of iterations. ' +
          'Below it, halving the step roughly doubles the iterations. The limit depends on the ' +
          'surface, which is exactly the thing you do not know when you are choosing the number.',
        '**A line search removes the hyperparameter by choosing the step from the function.** ' +
          'Start generous, halve until the decrease is proportional to what the slope promised — ' +
          'the Armijo condition — and accept. On Rosenbrock the fixed step that diverges and the ' +
          'fixed step that merely crawls are one factor of ten apart, and the line search needs ' +
          'neither of them: it never diverges, and in the same iteration budget it gets four ' +
          'orders of magnitude further down. It is not free — it spends several extra ' +
          'evaluations per iteration probing — but it spends them on information rather than on ' +
          'a guess.',
        '**Curvature is what separates the fast methods from the slow ones.** Gradient descent ' +
          'knows only the slope, so on an elongated valley it zig-zags across the narrow ' +
          'direction, and its iteration count grows with the condition number. Newton uses the ' +
          'second derivative and takes the same number of steps at any conditioning, because ' +
          'rescaling the problem does not change its steps. BFGS gets most of that by ' +
          'accumulating an approximation to the curvature out of the gradients it was already ' +
          'computing.'
      ],
      demo: {
        title: 'Interactive demo — five optimisers, a stability cliff and the cost of conditioning',
        markup: root.OptimisationTemplate.render()
      },
      diagram: diagram(),
      insight: 'Most "the optimiser did not converge" reports are a step-size problem on an ' +
        'ill-conditioned surface, and a line search removes the hyperparameter that caused it. ' +
        'Before touching the learning rate again, look at the conditioning: the demo shows ' +
        'gradient descent going from 2 iterations to over nine thousand as κ goes from 1 to 1000, ' +
        'while Newton takes 2 throughout. That is the practical hierarchy — **if you can afford ' +
        'the Hessian, use it; if you cannot, use BFGS, which learns the curvature from gradients ' +
        'you are already computing; and if the problem is too large even for that, use L-BFGS or ' +
        'preconditioning, because both are attacking the conditioning rather than the step.** ' +
        'Deep learning is the exception that proves it: the problems are too large for curvature ' +
        'and too noisy for a line search, which is why that field alone spends real effort tuning ' +
        'learning-rate schedules by hand.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.OptimisationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const raceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.AnalysisLab.optimiserRace({ surface: parts[0], step: Number(parts[1]) });
  });

  const gridFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.surfaceGrid(key, {});
  });

  const stabilityFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.stepStability({});
  });

  const conditionFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.conditionStudy({});
  });

  const coordinateFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.coordinateStudy({});
  });

  function update(app) {
    const values = panel.values();
    const race = raceFor(values['opt-surface'] + '|' + values['opt-step']);
    const withPaths = values['opt-paths'] === true || values['opt-paths'] === 'true';

    paintMetrics(race);
    paintChart(app, race, gridFor(values['opt-surface']), withPaths);
    paintRace(race, Number(values['opt-step']));
    paintStability(stabilityFor(''));
    paintCondition(conditionFor(''));
    paintCoordinate(coordinateFor(''));
  }

  function rowAt(race, index) {
    return race.rows[index] || race.rows[race.rows.length - 1];
  }

  function outcomeOf(row) {
    if (row.diverged) return 'diverged';
    return row.converged ? 'converged' : 'hit the iteration limit';
  }

  function paintMetrics(race) {
    root.MetricGrid.update({
      'opt-fixed': { value: root.Format.exact(rowAt(race, 0).iterations),
        note: outcomeOf(rowAt(race, 0)) + ', at ' +
          root.Format.exponential(rowAt(race, 0).objective, 2) },
      'opt-search': { value: root.Format.exact(rowAt(race, 2).iterations),
        note: outcomeOf(rowAt(race, 2)) + ', at ' +
          root.Format.exponential(rowAt(race, 2).objective, 2) },
      'opt-bfgs': { value: root.Format.exact(rowAt(race, 3).iterations),
        note: outcomeOf(rowAt(race, 3)) + ', at ' +
          root.Format.exponential(rowAt(race, 3).objective, 2) },
      'opt-newton': { value: race.rows.length > 4
        ? root.Format.exact(rowAt(race, 4).iterations) : '—',
        note: race.rows.length > 4
          ? outcomeOf(rowAt(race, 4)) + ', at ' +
            root.Format.exponential(rowAt(race, 4).objective, 2)
          : 'this surface has no analytic Hessian here' }
    });
  }

  function paintChart(app, race, grid, withPaths) {
    const host = root.jQuery('#opt-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.FunctionPlot.contours(host, {
      lazyLib: app.lazyLib,
      height: 280,
      xLabel: 'x',
      yLabel: 'y',
      grid: grid,
      paths: withPaths ? race.rows.map(function (row) {
        return { label: row.method, points: row.path };
      }) : [],
      legendHost: root.jQuery('#opt-legend')[0]
    });

    root.Helpers.setText('opt-chart-note',
      'The shading is the objective on a logarithmic scale — dark is high — and the ring marks ' +
      'the true minimum. The zig-zag is what an ill-conditioned surface does to a method that ' +
      'only knows the slope: the gradient points across the valley rather than along it, so ' +
      'descent bounces between the walls and creeps forward. Newton’s and BFGS’s paths cut ' +
      'straight along the floor of the valley instead, because they know how the slope is ' +
      'changing and not only what it is.');
  }

  function paintRace(race, step) {
    root.jQuery('#opt-race tbody').html(race.rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td>' + root.Format.exact(row.iterations) +
        '</td><td>' + root.Format.exact(row.evaluations) + '</td><td class="mono">' +
        root.Format.exponential(row.objective, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.distance, 2) + '</td><td>' +
        (row.monotone ? 'yes' : root.Format.exact(row.increases) + ' increases') + '</td><td>' +
        outcomeOf(row) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('opt-race-note',
      'The first three rows are all gradient descent — same direction, same surface — differing ' +
      'only in how the step is chosen, which is the comparison worth making. The fixed step at ' +
      step + ' reaches ' + root.Format.exponential(rowAt(race, 0).objective, 2) +
      ' and the line search reaches ' + root.Format.exponential(rowAt(race, 2).objective, 2) +
      ' with no step size specified anywhere. Read the evaluation column before calling that ' +
      'free: the line search spent ' + root.Format.exact(rowAt(race, 2).evaluations) +
      ' evaluations against the fixed step’s ' + root.Format.exact(rowAt(race, 0).evaluations) +
      ', because every iteration probes several candidate steps before accepting one. That is ' +
      'the trade, and it is usually worth taking, because the alternative is a number you ' +
      'cannot choose correctly without already knowing the surface. Note the monotone column ' +
      'too: momentum deliberately overshoots, so its objective goes up on some iterations, and ' +
      'that is not a bug — the accumulated velocity is what carries it along the valley floor ' +
      'instead of across it.');
  }

  function paintStability(rows) {
    root.jQuery('#opt-stability tbody').html(rows.map(function (row) {
      return '<tr' + (row.diverged ? ' class="matrix-row-lit"' : '') + '><td class="mono">' +
        root.Format.fixed(row.multiple, 2) + '×</td><td class="mono">' +
        root.Format.exponential(row.step, 3) + '</td><td>' +
        root.Format.exact(row.iterations) + '</td><td class="mono">' +
        (row.diverged ? '—' : root.Format.exponential(row.objective, 2)) + '</td><td>' +
        outcomeOf(row) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('opt-stability-note',
      'The stability limit for a quadratic is 2/L, where L is the largest curvature. At 0.5× the ' +
      'limit descent takes ' + root.Format.exact(rows[0].iterations) + ' iterations, at 0.9× it ' +
      'takes ' + root.Format.exact(rows[1].iterations) + ' — closer to the limit is faster, right ' +
      'up until it is not. At and above the limit it stops converging entirely. There is no ' +
      'gentle degradation across that boundary, which is what makes a fixed step so unpleasant to ' +
      'tune: the good values are next to the values that explode, and the boundary moves with the ' +
      'surface.');
  }

  function paintCondition(rows) {
    root.jQuery('#opt-condition tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.condition) + '</td><td>' +
        root.Format.exact(row.descent) + '</td><td>' + root.Format.exact(row.newton) +
        '</td></tr>';
    }).join(''));

    const worst = rows[rows.length - 1];
    root.Helpers.setText('opt-condition-note',
      'Gradient descent goes from ' + root.Format.exact(rows[0].descent) + ' iterations at κ = 1 ' +
      'to ' + root.Format.exact(worst.descent) + ' at κ = ' + root.Format.exact(worst.condition) +
      ' — and this is descent WITH a line search, so the step size is not the problem. Newton ' +
      'takes ' + root.Format.exact(worst.newton) + ' at every conditioning, because it is affine ' +
      'invariant: rescaling the problem rescales its steps identically and the iteration count ' +
      'does not notice. That is the real reason second-order methods are worth their cost, and ' +
      'the reason preconditioning helps first-order ones — both are attacking the same number.');
  }

  function paintCoordinate(rows) {
    root.jQuery('#opt-coordinate tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + root.Format.exact(row.iterations) +
        '</td><td>' + root.Format.exact(row.evaluations) + '</td><td>' +
        (row.converged ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('opt-coordinate-note',
      'Coordinate descent minimises one variable at a time. On a valley aligned with the axes it ' +
      'finishes in ' + root.Format.exact(rows[0].iterations) + ' iterations, because each ' +
      'variable is independent of the others and one pass settles it. Rotate the identical ' +
      'surface by 45° and it takes ' + root.Format.exact(rows[1].iterations) + ': every ' +
      'coordinate move now has to be undone slightly by the next one. Nothing about the problem ' +
      'got harder — the same eigenvalues, the same conditioning — only its alignment with the ' +
      'coordinate system changed, which is precisely what an affine-invariant method would ignore ' +
      'and this one cannot. It is worth knowing because coordinate descent is what LASSO solvers ' +
      'use, and their features are chosen by whoever built the dataset.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
