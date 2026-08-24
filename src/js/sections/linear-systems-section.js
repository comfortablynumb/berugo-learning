/**
 * Section: linear systems.
 *
 * The two demonstrations here are chosen because each one contradicts an
 * intuition that people hold firmly.
 *
 * The first is pivoting: the unpivoted elimination on [[e,1],[1,1]] does not
 * divide by zero, does not raise an exception and does not return NaN. It
 * returns [0, 1] — a clean, plausible pair of numbers, wrong in the first
 * component by 100%. The pivot was e = 1e-18, which is small and never zero,
 * so no singularity check fires.
 *
 * The second is the inverse. "Compute A⁻¹ and multiply" is the way the
 * mathematics is written and it is the wrong way to compute it: more work, and
 * measurably worse answers. The reuse study prices both.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'linear-systems';
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
      title: 'Diagram — one factorisation, then a solve per right-hand side',
      caption: 'The expensive step is the factorisation, and it depends only on the matrix. Every ' +
        'right-hand side after that costs two triangular solves, which is quadratic rather than ' +
        'cubic work. This is why a solver library separates `factor` from `solve` in its API: the ' +
        'split is not an implementation detail leaking out, it is the entire performance story, ' +
        'and code that calls a one-shot `solve(A, b)` in a loop pays the cubic cost every time.',
      definition: [
        'flowchart LR',
        '    A["matrix A"] --> B["factor: PA = LU<br/>about n^3/3 operations<br/>done once"]',
        '    B --> C["L, U and the<br/>permutation P"]',
        '    C --> D["solve Ly = Pb<br/>forward substitution"]',
        '    D --> E["solve Ux = y<br/>back substitution"]',
        '    F["right-hand side b1"] --> D',
        '    G["b2"] --> D',
        '    H["b3"] --> D',
        '    E --> I["x, at about n^2<br/>operations each"]',
        '    C -.-> J["A inverse: n^3 more work<br/>AND a worse answer"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Elimination without pivoting can return a confidently wrong answer with no warning.** ' +
          'The moment a pivot is small — not zero, just small — the multipliers below it are ' +
          'huge, and the entries they create swamp everything already in the row. The information ' +
          'in those entries is gone: it was added to a number a billion times larger and rounded ' +
          'away. Partial pivoting swaps the largest available entry into the pivot position, ' +
          'which bounds every multiplier by one and stops the process at its source.',
        '**The growth factor is what pivoting actually controls, and its bound is a worst case.** ' +
          'Growth is how large the intermediate entries get relative to the original matrix, and ' +
          'it is the term in the error bound that an algorithm can influence. Partial pivoting ' +
          'bounds it by 2ⁿ⁻¹, which sounds useless; in practice it is a small constant, and ' +
          'Wilkinson\'s matrix is the famous exception that attains the bound exactly while never ' +
          'triggering a single swap.',
        '**Factor once, solve many times — and never form the inverse.** LU costs about n³/3 ' +
          'operations and depends only on the matrix, so a second right-hand side costs two ' +
          'triangular solves at n² each. The explicit inverse costs more to build, costs the same ' +
          'n² to apply, and gives a worse answer than the factorisation it was built from, ' +
          'because it accumulates the rounding of n solves before you ask it anything.',
        '**Iterative methods trade an exact finish for a cheap step, and that is the right trade ' +
          'when the matrix is sparse.** Jacobi and Gauss–Seidel need only a matrix-vector product ' +
          'per sweep, never touching the fill-in that direct factorisation creates. Conjugate ' +
          'gradient converges at a rate set by the square root of the condition number, which is ' +
          'why preconditioning — changing the problem to one with a smaller condition number — is ' +
          'worth more than any amount of tuning the iteration itself.'
      ],
      demo: {
        title: 'Interactive demo — pivoting, growth, reuse and four iterative methods',
        markup: root.LinearSystemsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Two rules carry almost all of the practical value here, and both are about calling ' +
        'the library rather than writing one. **Never invert a matrix to solve a system** — ' +
        '`solve(A, b)`, not `inv(A) @ b` — because the inverse is more work and a worse answer, ' +
        'and the demo prices the penalty rather than asserting it. **Factor once when the matrix ' +
        'is reused**, because a `solve` in a loop pays the cubic cost on every pass. Then, when a ' +
        'system is large and sparse, reach for an iterative method and spend your effort on the ' +
        'preconditioner: halving the condition number buys more than any rewrite of the inner ' +
        'loop, since the convergence rate depends on its square root.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LinearSystemsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const pivotFor = root.Helpers.memoise(function (key) {
    return root.NumericLab.pivotingDemo({ epsilon: Number(key) });
  });

  const growthFor = root.Helpers.memoise(function () {
    return root.NumericLab.growthLadder();
  });

  const reuseFor = root.Helpers.memoise(function () {
    return root.NumericLab.reuseStudy({});
  });

  const raceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumericLab.iterativeRace({
      size: Number(parts[0]), scaled: parts[1] === 'true', omega: Number(parts[2]) / 100
    });
  });

  const omegaFor = root.Helpers.memoise(function () {
    return root.NumericLab.omegaSweep({});
  });

  function update(app) {
    const values = panel.values();
    const pivot = pivotFor(values['ls-epsilon']);
    const race = raceFor(values['ls-size'] + '|' + values['ls-scaled'] + '|' + values['ls-omega']);

    paintMetrics(pivot, race);
    paintChart(app, race);
    paintPivot(pivot, values['ls-epsilon']);
    paintGrowth(growthFor(''));
    paintIterative(race);
    paintOmega(omegaFor(''), Number(values['ls-omega']) / 100);
    paintReuse(reuseFor(''));
  }

  function unpivotedOf(rows) {
    return rows[0].pivoted ? rows[1] : rows[0];
  }

  function paintMetrics(pivot, race) {
    const bare = unpivotedOf(pivot);
    const cg = race.rows[race.rows.length - 1];

    root.MetricGrid.update({
      'ls-growth': { value: root.Format.exponential(bare.growth, 2),
        note: 'with pivoting it is ' + root.Format.exact(pivot[0].growth) },
      'ls-pivot-error': { value: root.Format.exponential(bare.relativeError, 3),
        note: 'the residual was ' + root.Format.exponential(bare.relativeResidual, 2) },
      'ls-cg': { value: root.Format.exact(cg.iterations),
        note: 'condition number ' + root.Format.exponential(race.condition, 2) },
      'ls-precond': { value: root.Format.exact(race.preconditioned.iterations),
        note: 'condition number ' + root.Format.exponential(race.preconditionedCondition, 2) }
    });
  }

  function paintChart(app, race) {
    const host = root.jQuery('#ls-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const series = race.rows.map(function (row) {
      return { label: row.method,
        points: row.history.map(function (point, index) {
          return { x: index + 1, y: Math.max(point.relativeResidual, 1e-16) };
        }) };
    });
    series.push({ label: 'CG’s bound', dashed: true,
      points: race.bound.map(function (point) {
        return { x: point.k, y: Math.max(point.bound, 1e-16) };
      }) });

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'iteration',
      yLabel: 'relative residual',
      series: series,
      legendHost: root.jQuery('#ls-legend')[0]
    });

    root.Helpers.setText('ls-chart-note',
      'The y axis is logarithmic, so each of the stationary methods is a straight line — they ' +
      'multiply the residual by a fixed factor per sweep, and the slope of the line is that ' +
      'factor. Gauss–Seidel’s slope is steeper than Jacobi’s because it uses each updated value ' +
      'immediately instead of waiting for the sweep to finish, and SOR’s is steeper again. ' +
      'Conjugate gradient is the curve that plunges rather than a line, and the dashed line is ' +
      'its textbook bound; the measured curve sits below it, because the bound assumes the worst ' +
      'possible spectrum and this one is better than that.');
  }

  function paintPivot(rows, epsilon) {
    root.jQuery('#ls-pivot tbody').html(rows.map(function (row) {
      return '<tr' + (row.pivoted ? '' : ' class="matrix-row-lit"') + '><td>' +
        (row.pivoted ? 'partial pivoting' : 'none') + '</td><td>' +
        root.Format.exact(row.swaps) + '</td><td class="mono">' +
        root.Format.exponential(row.growth, 2) + '</td><td class="mono">[' +
        row.x.map(function (value) { return root.Format.fixed(value, 6); }).join(', ') +
        ']</td><td class="mono">' + root.Format.exponential(row.relativeResidual, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.relativeError, 2) +
        '</td></tr>';
    }).join(''));

    const bare = unpivotedOf(rows);
    root.Helpers.setText('ls-pivot-note',
      'The system is [[ε, 1], [1, 1]] x = [1, 2] with ε = ' + epsilon + ', whose exact answer is ' +
      'almost exactly [1, 1]. Without pivoting the answer comes back as [' +
      bare.x.map(function (value) { return root.Format.fixed(value, 4); }).join(', ') +
      '] — a relative error of ' + root.Format.exponential(bare.relativeError, 2) +
      '. Nothing raised an error: ε is small, not zero, so no singularity check fires, and the ' +
      'first multiplier is 1/ε, which is enough to obliterate the second row. Swapping the two ' +
      'rows costs nothing and fixes it exactly.');
  }

  function paintGrowth(rows) {
    root.jQuery('#ls-wilkinson tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.n + '</td><td>' + root.Format.exact(row.swaps) +
        '</td><td class="mono">' + root.Format.exponential(row.growth, 3) +
        '</td><td class="mono">' + root.Format.exponential(row.predicted, 3) + '</td><td>' +
        (row.matchesPrediction ? 'exactly' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ls-wilkinson-note',
      'Wilkinson’s matrix has −1 below the diagonal, 1 on it, and a column of 1s on the right. ' +
      'Partial pivoting looks at each column, finds the diagonal entry is already the largest, ' +
      'and performs zero swaps — it is behaving exactly as specified — while the last column ' +
      'doubles at every step and reaches 2ⁿ⁻¹ precisely. This is why the pivoting bound is stated ' +
      'as a worst case rather than a reassurance: it is attained, by a matrix you could write ' +
      'down by hand, and the only reason we do not meet it in practice is that such matrices are ' +
      'vanishingly rare in real data.');
  }

  function paintIterative(race) {
    const rows = race.rows.concat([race.preconditioned]);
    root.jQuery('#ls-iterative tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td>' + root.Format.exact(row.iterations) +
        '</td><td class="mono">' + (row.history.length
          ? root.Format.exponential(row.history[row.history.length - 1].relativeResidual, 2)
          : '—') + '</td><td>' +
        (row.converged ? 'converged' : (row.diverged ? 'diverged' : 'hit the iteration limit')) +
        '</td></tr>';
    }).join(''));

    const cg = race.rows[3];
    const jacobi = race.rows[0];
    const helped = race.preconditioned.iterations < cg.iterations;
    root.Helpers.setText('ls-iterative-note',
      'Jacobi takes ' + root.Format.exact(jacobi.iterations) + ' sweeps and Gauss–Seidel ' +
      root.Format.exact(race.rows[1].iterations) + ' — the same arithmetic, differing only in ' +
      'whether an updated value is used immediately or at the end of the sweep. Conjugate ' +
      'gradient finishes in ' + root.Format.exact(cg.iterations) + ' on a system of size ' +
      root.Format.exact(race.size) + (cg.iterations <= race.size
        ? ' — in exact arithmetic it terminates in at most n steps, and in floating point it gets '
          + 'close to that'
        : ' — past the n steps exact arithmetic would need, which is what rounding costs it on an '
          + 'ill-conditioned system') + '. The last row is the caveat worth ' +
      'having: preconditioning ' + (helped ? 'takes it to ' +
        root.Format.exact(race.preconditioned.iterations)
        : 'changes nothing at all here') + '. Jacobi preconditioning rescales each row by its own ' +
      'diagonal, so on a matrix whose diagonal is already uniform it is the identity, and the two ' +
      'condition numbers in the metrics above are then equal to the digit. Tick "scale the rows" ' +
      'to give it something to work on and watch both numbers move. A preconditioner is only ' +
      'worth anything against the specific structure it was chosen for.');
  }

  function paintOmega(rows, chosen) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (row.converged && row.iterations < best.iterations) best = row;
    });

    root.jQuery('#ls-omega-table tbody').html(rows.map(function (row) {
      return '<tr' + (row === best ? ' class="matrix-row-lit"' : '') + '><td class="mono">' +
        root.Format.fixed(row.omega, 2) + '</td><td>' +
        (row.converged ? root.Format.exact(row.iterations) : 'did not converge') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ls-omega-note',
      'Successive over-relaxation is Gauss–Seidel with the update deliberately overshot by a ' +
      'factor ω. At ω = 1 it is Gauss–Seidel exactly, taking ' +
      root.Format.exact(rows[0].iterations) + ' iterations; the optimum on this system is ω = ' +
      root.Format.fixed(best.omega, 2) + ' at ' + root.Format.exact(best.iterations) +
      ', an order of magnitude better for a one-line change. The catch is that the optimum ' +
      'depends on the matrix and there is no cheap formula for it outside model problems, so the ' +
      'honest procedure is the one shown here: sweep it. Your slider is at ' +
      root.Format.fixed(chosen, 2) + '.');
  }

  function paintReuse(study) {
    const rows = [
      { label: 'factor once, then ' + study.rightHandSides + ' solves',
        count: study.factorisations.reused, error: study.reusedError },
      { label: 'solve from scratch each time',
        count: study.factorisations.fresh, error: study.freshError },
      { label: 'form the inverse, then multiply',
        count: study.factorisations.inverse, error: study.inverseError }
    ];

    root.jQuery('#ls-reuse tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + root.Format.exact(row.count) +
        '</td><td class="mono">' + root.Format.exponential(row.error, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ls-reuse-note',
      'The first two rows produce identical answers — reuse is free accuracy, it is purely a ' +
      'saving of ' + root.Format.exact(study.rightHandSides - 1) + ' cubic-cost factorisations. ' +
      'The third is the one to remember: the explicit inverse costs an extra n³ to build and ' +
      'returns answers ' + root.Format.fixed(study.inversePenalty, 1) + '× worse than the ' +
      'factorisation it was built from, because every column of it is itself a solve that has ' +
      'already been rounded. `inv(A) @ b` is slower and less accurate than `solve(A, b)` in every ' +
      'library that offers both.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
