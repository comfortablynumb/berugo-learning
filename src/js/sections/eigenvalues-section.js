/**
 * Section: eigenvalues and the QR algorithm.
 *
 * Three measurements, each answering a question that the definition of an
 * eigenvalue does not.
 *
 * The gap study prices power iteration: the cost is set entirely by the ratio
 * of the top two eigenvalues, and at 0.99 it takes 1802 iterations to do what
 * it does in 33 at 0.5. The shift study shows the fix - the same iteration on
 * (A - sigma I) inverse reaches any eigenvalue you can name in 10 to 24 steps,
 * the smallest one included.
 * And the polynomial ladder shows why the definition is not the algorithm: the
 * characteristic polynomial's roots are so ill-conditioned that a 1e-10 nudge
 * to one coefficient moves a root by nearly one whole unit at degree 20.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'eigenvalues';
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
      title: 'Diagram — from the definition nobody uses to the algorithm everybody does',
      caption: 'The route down the left is the one taught first and it is numerically hopeless: ' +
        'polynomial roots are so ill-conditioned in the coefficients that the answer is destroyed ' +
        'before any root finder runs. The route down the right is what LAPACK does — reduce to ' +
        'Hessenberg form once, then run shifted QR, which is similarity transformations all the ' +
        'way and therefore never changes the eigenvalues it is looking for.',
      definition: [
        'flowchart TD',
        '    A["A x = lambda x"] --> B["det(A - lambda I) = 0<br/>the characteristic polynomial"]',
        '    A --> C["reduce to Hessenberg form<br/>by orthogonal similarity"]',
        '    B --> D["roots of a degree-n polynomial"]',
        '    D --> E["catastrophically ill-conditioned<br/>in the coefficients"]',
        '    C --> F["QR step: A = QR, then A := RQ<br/>a similarity, so lambda is unchanged"]',
        '    F --> G{"subdiagonal<br/>small enough?"}',
        '    G -- no --> H["shift towards an eigenvalue<br/>and repeat"]',
        '    H --> F',
        '    G -- yes --> I["triangular: the eigenvalues<br/>are on the diagonal"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Power iteration is the whole idea in three lines, and its speed is one number.** ' +
          'Multiply a vector by the matrix repeatedly and normalise; every eigendirection is ' +
          'scaled by its own eigenvalue each time, so the largest one wins and everything else ' +
          'decays relative to it at the ratio of its eigenvalue to the largest. That ratio — the ' +
          'spectral gap — is the entire convergence story: at 0.5 it takes tens of iterations, at ' +
          '0.99 it takes thousands, and the matrix size does not appear.',
        '**Shifting turns a slow eigenvalue into a fast one.** Applying the iteration to ' +
          '(A − σI)⁻¹ maps each eigenvalue λ to 1/(λ − σ), so the one nearest your guess σ becomes ' +
          'the dominant one by a huge margin, and the gap that decides the speed is now a gap you ' +
          'chose. It converges in a handful of steps to whichever eigenvalue you aimed at, ' +
          'including the smallest, which power iteration can never reach.',
        '**The QR algorithm gets the whole spectrum by making the matrix triangular without ' +
          'changing it.** Factor A = QR, multiply back in the other order to get RQ, and repeat. ' +
          'Because RQ = QᵀAQ, each step is a similarity transformation — a change of basis — so ' +
          'the eigenvalues are untouched while the subdiagonal shrinks. With shifts and a ' +
          'Hessenberg reduction first, this is what every library actually runs.',
        '**Never compute eigenvalues through the characteristic polynomial.** It is the ' +
          'definition, and the map from a matrix to its polynomial coefficients is catastrophically ' +
          'ill-conditioned: Wilkinson\'s example has roots at 1 through 20, and perturbing one ' +
          'coefficient in its fifteenth significant digit moves a root by a substantial fraction ' +
          'of a whole unit. The eigenvalues themselves are perfectly well conditioned for a ' +
          'symmetric matrix; it is the detour through the polynomial that destroys them.'
      ],
      demo: {
        title: 'Interactive demo — gaps, shifts, the QR sweep and Wilkinson’s polynomial',
        markup: root.EigenvaluesTemplate.render()
      },
      diagram: diagram(),
      insight: 'The transferable idea here is not any one algorithm — it is that **the ' +
        'conditioning of a route can be far worse than the conditioning of the destination**. ' +
        'Wilkinson\'s eigenvalues are fine; his polynomial\'s roots are not; they are the same ' +
        'numbers reached two ways. Whenever you find yourself transforming a problem into an ' +
        'equivalent one because the equivalent one has a nicer closed form, ask what that ' +
        'transformation does to the conditioning, because "algebraically identical" is a statement ' +
        'about exact arithmetic and says nothing about what survives. In practice: call `eig`, ' +
        'never `roots(charpoly(A))`, and when you only need the largest few eigenvalues, say so — ' +
        'the iterative methods that give you those cost a matrix-vector product per step and ' +
        'never form a factorisation at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.EigenvaluesTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const gapsFor = root.Helpers.memoise(function () {
    return root.NumericLab.gapStudy({});
  });

  const shiftsFor = root.Helpers.memoise(function (key) {
    return root.NumericLab.shiftStudy({ offset: Number(key) / 100 });
  });

  const qrFor = root.Helpers.memoise(function () {
    return root.NumericLab.qrConvergence({});
  });

  const polynomialFor = root.Helpers.memoise(function (key) {
    return root.NumericLab.polynomialLadder(null, Number(key));
  });

  function update(app) {
    const values = panel.values();
    const gaps = gapsFor('');
    const shifts = shiftsFor(values['eig-offset']);
    const qr = qrFor('');
    const chosen = gapRowFor(gaps, Number(values['eig-gap']));

    paintMetrics(chosen, shifts, qr);
    paintChart(app, qr);
    paintGaps(gaps, chosen);
    paintShifts(shifts, gaps[gaps.length - 1]);
    paintPolynomial(polynomialFor(values['eig-perturbation']));
  }

  function gapRowFor(rows, gap) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (Math.abs(row.gap - gap) < Math.abs(best.gap - gap)) best = row;
    });
    return best;
  }

  function paintMetrics(chosen, shifts, qr) {
    let worst = shifts[0];
    shifts.forEach(function (row) {
      if (row.iterations > worst.iterations) worst = row;
    });

    root.MetricGrid.update({
      'eig-power': { value: root.Format.exact(chosen.iterations),
        note: 'at a gap of ' + root.Format.fixed(chosen.gap, 2) },
      'eig-predicted': { value: root.Format.exact(Math.round(chosen.predicted)),
        note: 'the measurement runs a little under it, and grows with it' },
      'eig-shift': { value: root.Format.exact(worst.iterations),
        note: 'the worst of the four, whichever one you aim at' },
      'eig-qr': { value: root.Format.exact(qr.iterations),
        note: qr.converged ? 'all four eigenvalues at once' : 'hit the iteration limit' }
    });
  }

  function paintChart(app, qr) {
    const host = root.jQuery('#eig-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'QR sweep',
      yLabel: 'norm of the subdiagonal',
      series: [{ label: 'subdiagonal', dots: true,
        points: qr.trail.map(function (value, index) {
          return { x: index + 1, y: Math.max(value, 1e-18) };
        }) }],
      legendHost: root.jQuery('#eig-legend')[0]
    });

    root.Helpers.setText('eig-chart-note',
      'This is the quantity the QR algorithm drives to zero: everything below the diagonal. When ' +
      'it reaches machine precision the matrix is triangular and its diagonal holds the ' +
      'eigenvalues — which have not moved throughout, because every step was a similarity ' +
      'transformation. The line is straight on a log axis, meaning the subdiagonal shrinks by a ' +
      'constant factor per sweep, and that factor is set by ratios between neighbouring ' +
      'eigenvalues, exactly as in power iteration. Shifts are what break the straightness in a ' +
      'production implementation, turning it into the cubic convergence LAPACK gets.');
  }

  function paintGaps(rows, chosen) {
    root.jQuery('#eig-gap-table tbody').html(rows.map(function (row) {
      return '<tr' + (row === chosen ? ' class="matrix-row-lit"' : '') + '><td class="mono">' +
        root.Format.fixed(row.gap, 2) + '</td><td>' + root.Format.exact(row.iterations) +
        '</td><td>' + root.Format.exact(Math.round(row.predicted)) + '</td><td class="mono">' +
        root.Format.fixed(row.value, 6) + '</td><td class="mono">' +
        root.Format.exponential(row.residual, 2) + '</td></tr>';
    }).join(''));

    const tight = rows[rows.length - 1];
    root.Helpers.setText('eig-gap-note',
      'The predicted column is log(tolerance)/log(gap) — the error is multiplied by the gap on ' +
      'every step, so reaching 10⁻¹⁰ takes that many multiplications. The measurement runs a ' +
      'little under it at every row, because the starting vector already has a healthy component ' +
      'along the dominant direction and does not have to earn the whole ratio from nothing; what ' +
      'matters is that the two columns grow together and diverge to infinity as the gap ' +
      'approaches one. Note what is absent: the matrix size does not appear in either column. ' +
      'Power iteration on ' +
      'a million-by-million matrix with a gap of 0.5 takes the same ' +
      root.Format.exact(gapRowFor(rows, 0.5).iterations) + ' iterations it takes on a four-by-four ' +
      'one; each iteration costs more, but the count does not change. At a gap of ' +
      root.Format.fixed(tight.gap, 2) + ' it needs ' + root.Format.exact(tight.iterations) +
      ', and a near-tie is exactly where shifting earns its keep.');
  }

  function paintShifts(rows, tightest) {
    root.jQuery('#eig-inverse tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.target, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.shift, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.found, 8) + '</td><td>' + root.Format.exact(row.iterations) +
        '</td><td>' + (row.correct ? 'yes' : 'NO — landed on a different one') + '</td></tr>';
    }).join(''));

    const smallest = rows[rows.length - 1];
    let fewest = rows[0];
    rows.forEach(function (row) {
      if (row.iterations < fewest.iterations) fewest = row;
    });
    root.Helpers.setText('eig-inverse-note',
      'Every row is the same iteration on (A − σI)⁻¹ with a different σ, and every one finishes ' +
      'between ' + root.Format.exact(fewest.iterations) + ' and ' +
      root.Format.exact(smallest.iterations) + ' steps — including the smallest eigenvalue, ' +
      root.Format.fixed(smallest.target, 2) + ', which plain power iteration would never reach at ' +
      'all. Compare that with the ' + root.Format.exact(tightest.iterations) + ' iterations the ' +
      'table above needed at a gap of ' + root.Format.fixed(tightest.gap, 2) + '. The shift maps ' +
      'λ to 1/(λ − σ), so an eigenvalue a little way from σ becomes enormous ' +
      'relative to the others and the gap that governs the speed is one you chose. Drag the ' +
      'offset slider up and watch the counts rise: the closer the aim, the faster it converges, ' +
      'and aiming too far can land you on a neighbour instead.');
  }

  function paintPolynomial(rows) {
    root.jQuery('#eig-polynomial tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.n + '</td><td class="mono">xⁿ⁻¹</td><td class="mono">' +
        root.Format.exponential(Math.abs(row.coefficient), 2) + '</td><td class="mono">' +
        root.Format.exponential(row.rootShift, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.rootShift / row.epsilon, 2) + '×</td></tr>';
    }).join(''));

    const worst = rows[rows.length - 1];
    root.Helpers.setText('eig-polynomial-note',
      'The polynomial is (x − 1)(x − 2)…(x − n), whose roots are the integers and could not be ' +
      'more benign. Multiply one coefficient by 1 + ' + root.Format.exponential(worst.epsilon, 0) +
      ' — a change smaller than the rounding that storing it already caused — and at degree ' +
      root.Format.exact(worst.n) + ' a root moves by ' +
      root.Format.exponential(worst.rootShift, 2) + ', an amplification of ' +
      root.Format.exponential(worst.rootShift / worst.epsilon, 1) + '×. Wilkinson called this the ' +
      'most traumatic experience of his career as a numerical analyst, and it is the reason the ' +
      'characteristic polynomial appears in the definition of an eigenvalue and in no ' +
      'implementation of one.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
