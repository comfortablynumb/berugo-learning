/**
 * Section: least squares, QR and the SVD.
 *
 * One number carries this section: forming AᵀA squares the condition number.
 * That is not a subtlety, it is a halving of the digits you have, and it is
 * what the textbook derivation of least squares tells you to do. The demo puts
 * κ(A), κ(AᵀA) and their ratio side by side so the exponent doubling is
 * visible in the table rather than asserted in a sentence.
 *
 * The orthogonality race is the second measurement worth having. Classical and
 * modified Gram-Schmidt differ by moving one subtraction inside the loop -
 * mathematically identical, five orders of magnitude apart in the orthogonality
 * of the result, and Householder is another five beyond that.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'least-squares';
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
      title: 'Diagram — three routes to the same least-squares answer',
      caption: 'All three compute the same minimiser in exact arithmetic and they are not ' +
        'interchangeable in floating point. The normal equations are the cheapest and square the ' +
        'condition number on the way. QR keeps the conditioning of the original matrix and costs ' +
        'about twice as much. The SVD costs more again and is the only one that still tells you ' +
        'something useful when the columns are actually dependent, because it names how dependent ' +
        'they are instead of failing.',
      definition: [
        'flowchart TD',
        '    A["overdetermined Ax = b<br/>more equations than unknowns"] --> B["normal equations<br/>A^T A x = A^T b"]',
        '    A --> C["QR factorisation<br/>A = QR, solve Rx = Q^T b"]',
        '    A --> D["SVD<br/>A = U S V^T"]',
        '    B --> E["cheapest; kappa is SQUARED<br/>half the digits, gone"]',
        '    C --> F["about 2x the cost<br/>kappa preserved"]',
        '    D --> G["most expensive; kappa preserved<br/>AND the rank is reported"]',
        '    E --> H["fine when kappa is small"]',
        '    F --> I["the default in every library"]',
        '    G --> J["truncate, regularise,<br/>or diagnose rank deficiency"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Least squares does not solve the equations; it finds the point where the leftover is ' +
          'perpendicular to everything you can reach.** With more equations than unknowns there ' +
          'is generally no exact solution, so the minimiser is the projection of b onto the column ' +
          'space of A. That geometric statement is the whole method: the residual at the optimum ' +
          'is orthogonal to every column, which is what setting the derivative to zero produces ' +
          'and why the answer is unique whenever the columns are independent.',
        '**The normal equations are the textbook derivation and they square the condition ' +
          'number.** AᵀA has the condition number of A multiplied by itself, so a design matrix ' +
          'at 10⁸ — perfectly workable — becomes a system at 10¹⁶, which is past what a double ' +
          'carries. You lose half your digits at the moment you form the product, before any ' +
          'solving happens, and the demo shows the ratio landing on 1.00 to confirm it is exactly ' +
          'the square rather than roughly it.',
        '**QR avoids the squaring, and how you compute Q decides whether it was worth it.** ' +
          'Classical Gram–Schmidt subtracts all the previous projections computed from the ' +
          'original vector; modified Gram–Schmidt subtracts each one from the running remainder. ' +
          'The two are identical on paper and differ by seven orders of magnitude in how ' +
          'orthogonal Q comes out. Householder reflections, which build Q as a product of ' +
          'reflections rather than subtracting anything, are orthogonal to machine precision.',
        '**The SVD is the one that can tell you the question was badly posed.** It factors any ' +
          'matrix into a rotation, a scaling and another rotation, and the scalings — the singular ' +
          'values — are the condition number, the rank, and the error of every truncation, all in ' +
          'one list. Eckart–Young says the best rank-k approximation is the first k of them, and ' +
          'its error is exactly σₖ₊₁: the first singular value you threw away.'
      ],
      demo: {
        title: 'Interactive demo — squared conditioning, three QRs and a truncated SVD',
        markup: root.LeastSquaresTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a fit misbehaves, look at the singular values before you look at the code. ' +
        'They answer the three questions that matter at once — how ill-conditioned the fit is ' +
        '(the ratio of first to last), how many directions the data actually constrains (how many ' +
        'are above the noise), and what you lose by dropping the rest (exactly the next one). ' +
        'That is also the practical reason to distrust `(X\'X)^-1 X\'y` wherever you find it ' +
        'written out: it is the mathematics transcribed literally, it squares the conditioning, ' +
        'and every library\'s `lstsq` uses QR or the SVD instead. The mathematically clean form ' +
        'and the numerically sound one are different expressions, and this is the clearest case ' +
        'of it in the whole milestone.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LeastSquaresTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const fittingFor = root.Helpers.memoise(function (key) {
    return root.NumericLab.fittingSweep({ noise: Number(key) });
  });

  const orthogonalityFor = root.Helpers.memoise(function () {
    return root.NumericLab.orthogonalityRace({});
  });

  const truncationFor = root.Helpers.memoise(function () {
    return root.NumericLab.truncationStudy({});
  });

  function update(app) {
    const values = panel.values();
    const fitting = fittingFor(values['lsq-noise']);
    const orthogonality = orthogonalityFor('');
    const truncation = truncationFor('');
    const chosen = rowFor(fitting, Number(values['lsq-degree']));

    paintMetrics(chosen, orthogonality);
    paintChart(app, truncation);
    paintFitting(fitting, chosen);
    paintOrthogonality(orthogonality);
    paintTruncation(truncation, Number(values['lsq-rank']));
  }

  function rowFor(rows, degree) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (Math.abs(row.degree - degree) < Math.abs(best.degree - degree)) best = row;
    });
    return best;
  }

  function methodFor(rows, id) {
    return rows.filter(function (row) { return row.id === id; })[0];
  }

  function paintMetrics(chosen, orthogonality) {
    const householder = methodFor(orthogonality, 'householder');
    const classical = methodFor(orthogonality, 'classical');

    root.MetricGrid.update({
      'lsq-condition': { value: root.Format.exponential(chosen.condition, 3),
        note: 'at degree ' + root.Format.exact(chosen.degree) },
      'lsq-normal': { value: root.Format.exponential(chosen.normalCondition, 3),
        note: 'the ratio to κ(A)² is ' + root.Format.fixed(chosen.squared, 3) },
      'lsq-loss': { value: root.Format.exponential(householder.loss, 2),
        note: 'orthogonal to machine precision' },
      'lsq-worst': { value: root.Format.exponential(classical.loss, 2),
        note: root.Format.exponential(classical.loss / householder.loss, 1) +
          '× further from orthogonal' }
    });
  }

  function paintChart(app, truncation) {
    const host = root.jQuery('#lsq-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'index',
      yLabel: 'magnitude',
      series: [
        { label: 'singular value σₖ', dots: true,
          points: Array.from(truncation.singular).map(function (value, index) {
            return { x: index + 1, y: Math.max(value, 1e-18) };
          }) },
        { label: 'error of the rank-k approximation', dots: true,
          points: truncation.rows.map(function (row) {
            return { x: row.k, y: Math.max(row.measured, 1e-18) };
          }) }
      ],
      legendHost: root.jQuery('#lsq-legend')[0]
    });

    root.Helpers.setText('lsq-chart-note',
      'The two lines are offset by exactly one position, which is the whole content of the ' +
      'Eckart–Young theorem drawn: the error left after keeping k singular values is the next one ' +
      'you did not keep. Nothing else about the matrix enters. That is why the singular value ' +
      'spectrum is the first thing to plot when deciding how much of a matrix you can afford to ' +
      'throw away — the plot is the answer, not an input to further analysis.');
  }

  function paintFitting(rows, chosen) {
    root.jQuery('#lsq-fitting tbody').html(rows.map(function (row) {
      return '<tr' + (row === chosen ? ' class="matrix-row-lit"' : '') + '><td>' + row.degree +
        '</td><td class="mono">' + root.Format.exponential(row.condition, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.normalCondition, 2) +
        '</td><td class="mono">' + root.Format.fixed(row.squared, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.qrResidual, 2) + '</td><td class="mono">' +
        root.Format.exponential(row.normalResidual, 2) + '</td></tr>';
    }).join(''));

    const clean = rows.filter(function (row) { return Math.abs(row.squared - 1) < 0.01; });
    const last = clean[clean.length - 1];
    root.Helpers.setText('lsq-fitting-note',
      'The fourth column is κ(AᵀA) divided by κ(A)², and it sits at 1.000 for the first ' +
      root.Format.exact(clean.length) + ' rows — the squaring is exact, not approximate. At ' +
      'degree ' + root.Format.exact(last.degree) + ' the design matrix is at ' +
      root.Format.exponential(last.condition, 1) + ', which a double handles comfortably, and the ' +
      'normal equations are at ' + root.Format.exponential(last.normalCondition, 1) +
      ', which it does not — and the last two columns show it, with the QR residual continuing to ' +
      'fall while the normal-equations one turns and climbs. Below those rows the ratio collapses ' +
      'for a reason worth naming: κ(AᵀA) has itself become unmeasurable. Its smallest singular ' +
      'value is below the largest one times machine epsilon, so the SVD cannot resolve it and the ' +
      'reported condition number saturates near 1/ε rather than continuing to square. The ' +
      'formulation stopped being merely ill-conditioned and started being indistinguishable from ' +
      'singular. Fitting a polynomial by monomials is the classic way to meet this, because 1, x, ' +
      'x², … become nearly parallel as sampled columns — the same reason the Hilbert matrix in ' +
      '18.1 was hopeless.');
  }

  function paintOrthogonality(rows) {
    const householder = methodFor(rows, 'householder');
    root.jQuery('#lsq-orthogonality tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.exponential(row.loss, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.loss / householder.loss, 1) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('lsq-orthogonality-note',
      'The matrix is a degree-9 Vandermonde with condition number ' +
      root.Format.exponential(rows[0].condition, 2) + ', and the column measures ‖QᵀQ − I‖ — how ' +
      'far the computed Q is from actually being orthogonal. Classical and modified Gram–Schmidt ' +
      'differ only in whether each projection is subtracted from the original vector or from the ' +
      'running remainder; that single change buys ' +
      root.Format.exponential(methodFor(rows, 'classical').loss /
        methodFor(rows, 'modified').loss, 1) + '×. Householder never subtracts projections at ' +
      'all — it builds Q as a product of reflections, each of which is orthogonal by ' +
      'construction — and is the reason no library ships Gram–Schmidt as its QR.');
  }

  function paintTruncation(truncation, rank) {
    const size = truncation.rows.length;
    root.jQuery('#lsq-truncation tbody').html(truncation.rows.map(function (row) {
      return '<tr' + (row.k === rank ? ' class="matrix-row-lit"' : '') + '><td>' + row.k +
        '</td><td class="mono">' + root.Format.exponential(row.singular, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.spectralBound, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.frobeniusBound, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.measured, 2) + '</td><td>' +
        root.Format.exact(row.stored) + ' of ' + root.Format.exact(row.full) + '</td></tr>';
    }).join(''));

    const chosen = truncation.rows[Math.min(rank, size) - 1];
    const breakEven = truncation.rows.filter(function (row) { return row.stored < row.full; });
    root.Helpers.setText('lsq-truncation-note',
      'Eckart–Young says the truncated SVD is the best possible rank-k approximation, and it ' +
      'states the error in two different norms — which is why there are two bound columns and ' +
      'they are not equal. The spectral-norm error is exactly the next singular value you dropped; ' +
      'the Frobenius-norm error is the root of the sum of the squares of all of them, so it is ' +
      'always the larger. The measured column is a Frobenius difference and lands on the ' +
      'Frobenius bound to the digit at every rank: at rank ' + root.Format.exact(chosen.k) +
      ' it is ' + root.Format.exponential(chosen.measured, 2) + ' against a bound of ' +
      root.Format.exponential(chosen.frobeniusBound, 2) + '. Compare it to the spectral bound of ' +
      root.Format.exponential(chosen.spectralBound, 2) + ' and the approximation appears to ' +
      'violate its own guarantee, which is a units error and not a bug. The last column is the ' +
      'practical caveat: storing two factors costs k(m + n + 1) numbers, so on a square matrix ' +
      'truncation only saves anything below about half the rank — here, the first ' +
      root.Format.exact(breakEven.length) + ' rows. This one table is behind principal component ' +
      'analysis, latent semantic indexing and every "compress the embedding matrix" trick, all of ' +
      'which are Eckart–Young with different nouns.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
