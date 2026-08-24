/**
 * Section: monte-carlo-estimation.
 *
 * Three measurements carry this section and each one contradicts a habit.
 *
 * The first is that no variance-reduction technique works everywhere: on the
 * monotone integrand antithetic pairs cut the variance by about sixty times,
 * and on the oscillating one the same trick makes the ERROR worse. The demo
 * runs all five on whichever target is selected, so the reader watches the
 * ranking rearrange rather than being told that it can.
 *
 * The second is that a stratified estimator's sample variance is not its
 * error bar. The points are not identically distributed, so the usual formula
 * reports roughly the plain estimator's variance while the measured error is
 * three orders of magnitude smaller. That is why the table shows both columns
 * and why they disagree.
 *
 * The third is the rare event. At a threshold of 4 the plain estimator
 * returns exactly zero with a standard error of exactly zero, which is a
 * confident wrong answer carrying no warning at all - and importance sampling
 * with too large a shift produces the opposite failure, where the hit count
 * looks best exactly where the estimate is worst.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'monte-carlo-estimation';
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
      title: 'Diagram — importance sampling, and where the correction goes',
      caption: 'Sampling from the target wastes almost every draw when the region of interest is ' +
        'rare. Sampling from a proposal that lives where the interest is fixes that, and the ' +
        'bias it introduces is removed exactly by weighting each draw by the ratio of the two ' +
        'densities. The estimator stays unbiased for any proposal whose support covers the ' +
        'target’s — but the VARIANCE depends entirely on the choice, and a proposal with a ' +
        'lighter tail than the target has infinite variance while still producing plausible ' +
        'numbers.',
      definition: [
        'flowchart TD',
        '    A["want E_p[f(X)]<br/>but f is non-zero only where p is tiny"] --> B["choose a proposal q<br/>that lives where f does"]',
        '    B --> C["draw x from q"]',
        '    C --> D["weight w = p(x) / q(x)"]',
        '    D --> E["estimate = mean of f(x)·w"]',
        '    E --> F{"weight ESS<br/>close to N?"}',
        '    F -- yes --> G["the proposal is good"]',
        '    F -- no --> H["a few draws carry everything<br/>the estimate is not converged"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**The error falls like 1/√N and nothing changes that.** Quadrupling the samples halves ' +
          'the error; ten times the accuracy costs a hundred times the work. That rate is a ' +
          'property of averaging independent draws, so it is the same for an integral, an area, ' +
          'a probability or a simulated queue. The only lever is the numerator: the standard ' +
          'error is σ/√N, and every technique in this section reduces σ.',
        '**The rate does not depend on the dimension, which is the whole reason Monte Carlo is ' +
          'used.** A product quadrature rule with m nodes per axis needs mᵈ points and its error ' +
          'per axis improves like m⁻²; at a fixed budget m collapses as d grows. The demo ' +
          'measures both at the same point budget and finds the crossover between five and six ' +
          'dimensions — below it quadrature wins by six orders of magnitude, above it sampling ' +
          'wins and keeps winning.',
        '**Antithetic and control variates work by correlation and fail without it.** Pairing u ' +
          'with 1 − u helps when f is monotone, because the pair’s errors point opposite ways; ' +
          'on an oscillating integrand the pairs are positively correlated and the trick backfires. ' +
          'A control variate reduces the variance by a factor of 1 − ρ², so a control correlated ' +
          'at 0.3 buys 9% and is not worth the code. Both report their correlation in the demo ' +
          'for exactly that reason.',
        '**Stratification is the one that changes the rate rather than the constant**, and it ' +
          'breaks the usual error bar. One point per stratum removes the between-strata variance ' +
          'exactly, so what is left shrinks with the stratum width — but the draws are no longer ' +
          'identically distributed and the sample-variance formula no longer estimates the ' +
          'estimator’s variance. The demo shows a stratified run whose reported variance is ' +
          'unchanged and whose measured error is a thousand times smaller.',
        '**Importance sampling is the only technique that turns an impossible estimate into a ' +
          'possible one, and the only one that can be catastrophically worse than doing nothing.** ' +
          'Sample from a distribution that lives where the event is, weight by the density ratio, ' +
          'and the estimator stays unbiased. Choose the shift badly and a handful of draws carry ' +
          'all the weight; the diagnostic is the effective sample size of the weights, and it is ' +
          'not optional.'
      ],
      demo: {
        title: 'Interactive demo — five estimators, the dimension crossover and a tail probability',
        markup: root.MonteCarloEstimationTemplate.render()
      },
      diagram: diagram(),
      insight: '**Monte Carlo loses badly in one dimension and wins in thirty, and people reach ' +
        'for it in one.** The demo’s dimension table is the whole argument: at d = 1 the midpoint ' +
        'rule is nine orders of magnitude more accurate than sampling at the same cost, and by ' +
        'd = 8 it is ten times worse and falling. If your integral is one-dimensional and smooth, ' +
        'use quadrature from 18.7 and stop. The second habit worth breaking is quoting a Monte ' +
        'Carlo result without an interval. Every estimate in the table carries one, the rare-event ' +
        'row shows a plain estimator reporting **zero with a standard error of zero**, and that is ' +
        'what an estimate with no interval looks like from the inside. **A sampled number without ' +
        'an error bar is not a measurement.**'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MonteCarloEstimationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const reductionFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.varianceReduction({ target: parts[0], samples: Number(parts[1]),
      seed: 21 });
  });

  const seriesFor = root.Helpers.memoise(function (key) {
    return root.RandomizedLab.errorSeries({ target: key, repeats: 40, maxPower: 16 });
  });

  const coverageFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.intervalCoverage({ target: parts[0], samples: Number(parts[1]),
      repeats: 200 });
  });

  const dimensionFor = root.Helpers.memoise(function () {
    return root.RandomizedLab.dimensionSweep({ budget: 4096, maxDimension: 8, repeats: 20 });
  });

  const rareFor = root.Helpers.memoise(function (key) {
    return root.RandomizedLab.rareEvent({ threshold: Number(key), samples: 20000 });
  });

  function update(app) {
    const values = panel.values();
    const reduction = reductionFor(values['mce-target'] + '|' + values['mce-samples']);
    const series = seriesFor(values['mce-target']);
    const dimension = dimensionFor('');
    const rare = rareFor(values['mce-threshold']);
    const coverage = coverageFor(values['mce-target'] + '|' + values['mce-samples']);

    paintMetrics(reduction, dimension, rare);
    paintChart(app, series);
    paintMethods(reduction, coverage);
    paintSeries(series);
    paintDimension(dimension);
    paintRare(rare);
  }

  function bestOf(reduction) {
    let best = reduction.rows[1];
    reduction.rows.forEach(function (row) {
      if (row.method !== 'plain' && row.run.error < best.run.error) best = row;
    });
    return best;
  }

  function crossoverOf(dimension) {
    for (let i = 0; i < dimension.rows.length; i += 1) {
      if (dimension.rows[i].gridError > dimension.rows[i].monteCarloError) {
        return dimension.rows[i].dimension - 1;
      }
    }
    return dimension.rows[dimension.rows.length - 1].dimension;
  }

  function paintMetrics(reduction, dimension, rare) {
    const best = bestOf(reduction);
    root.MetricGrid.update({
      'mce-plain': { value: root.Format.exponential(reduction.rows[0].run.error, 3),
        note: 'estimate ' + root.Format.fixed(reduction.rows[0].run.estimate, 6) + ' against ' +
          root.Format.fixed(reduction.target.exact, 6) },
      'mce-best': { value: best.method,
        note: root.Format.fixed(best.errorFactor, 1) + '× less error than plain, at the same ' +
          root.Format.exact(reduction.samples) + ' evaluations' },
      'mce-crossover': { value: root.Format.exact(crossoverOf(dimension)),
        note: 'past that, ' + root.Format.exact(dimension.budget) +
          ' random points beat the same number arranged in a grid' },
      'mce-hits': { value: root.Format.exact(rare.plain.hits),
        note: rare.plain.hits === 0
          ? 'so the estimate is exactly 0 with a standard error of exactly 0'
          : 'out of ' + root.Format.exact(rare.samples) + ' draws' }
    });
  }

  function paintChart(app, series) {
    const host = root.jQuery('#mce-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260, logX: true, logY: true,
      xLabel: 'samples', yLabel: 'absolute error',
      series: [
        { label: 'plain sampling, mean over 40 seeds', points: series.rows.map(function (row) {
          return { x: row.samples, y: row.meanError };
        }) },
        { label: 'the 1/√N line through the first point', dashed: true,
          points: series.rows.map(function (row, index) {
            return { x: row.samples, y: index === 0 ? row.meanError : row.predicted };
          }) },
        { label: 'van der Corput points', points: series.rows.map(function (row) {
          return { x: row.samples, y: row.quasiError };
        }) }
      ],
      legendHost: root.jQuery('#mce-legend')[0]
    });

    root.Helpers.setText('mce-chart-note',
      'Both axes are logarithmic, so a power law is a straight line and its slope is the ' +
      'exponent. The sampled curve has slope −1/2 and the deterministic one has slope close to ' +
      '−1: quasi-Monte Carlo converges nearly a full order faster in one dimension, which is ' +
      'exactly the regime where nobody should be sampling in the first place. The measured ' +
      'curve wobbles because each point is an average over forty seeds rather than a limit.');
  }

  function coverageOf(coverage, method) {
    for (let i = 0; i < coverage.length; i += 1) {
      if (coverage[i].method === method) return coverage[i];
    }
    return null;
  }

  function paintMethods(reduction, coverage) {
    root.jQuery('#mce-methods tbody').html(reduction.rows.map(function (row) {
      const cover = coverageOf(coverage, row.method);
      return '<tr><td>' + row.method + '</td><td class="mono">' +
        root.Format.fixed(row.run.estimate, 6) + '</td><td class="mono">' +
        root.Format.exponential(row.run.error, 3) + '</td><td class="mono">' +
        (row.run.variance === null ? '— (deterministic)' : root.Format.fixed(row.run.variance, 6)) +
        '</td><td class="mono">' + (row.factor === null ? '—'
          : root.Format.fixed(row.factor, 2) + '×') + '</td><td class="mono">' +
        root.Format.fixed(row.errorFactor, 1) + '×</td><td class="mono">' +
        (cover === null ? 'no interval to cover'
          : root.Format.percent(cover.coverage, 1) + ' (' + root.Format.exact(cover.inside) +
            ' of ' + root.Format.exact(cover.repeats) + ')') +
        '</td></tr>';
    }).join(''));

    const anti = reduction.rows[1];
    const strat = coverageOf(coverage, 'stratified');
    root.Helpers.setText('mce-methods-note',
      'The two reduction columns disagree on purpose. Antithetic sampling reports a variance ' +
      'reduction of ' + root.Format.fixed(anti.factor, 2) + '× here, and an error reduction of ' +
      root.Format.fixed(anti.errorFactor, 1) + '× — the first is a property of the estimator and ' +
      'the second is one draw from a distribution, so they only agree on average. The stratified ' +
      'row is the one to look at twice: its sample variance is barely below plain and its error ' +
      'is orders of magnitude smaller, because the sample-variance formula assumes identically ' +
      'distributed draws and stratified points are not. Its interval is computed from the ' +
      'stratum width instead, and the coverage column shows what that buys: ' +
      root.Format.percent(strat.coverage, 1) + ' rather than the nominal 95%, because the ' +
      'stratum-width bar is conservative. The other three sit within a point or two of 95%, ' +
      'which is the interval being correct rather than lucky — a single run’s "was it inside?" ' +
      'flag is a coin weighted 19 to 1 and says almost nothing. The quasi row has no interval ' +
      'at all — the points are deterministic, so there is nothing to be uncertain about except ' +
      'the answer, and reporting a zero standard error there would be a lie of a different kind.');
  }

  function paintSeries(series) {
    root.jQuery('#mce-series tbody').html(series.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.samples) + '</td><td class="mono">' +
        root.Format.exponential(row.meanError, 3) + '</td><td class="mono">' +
        (row.predicted === null ? '— (the anchor)' : root.Format.exponential(row.predicted, 3)) +
        '</td><td class="mono">' + root.Format.exponential(row.quasiError, 3) +
        '</td><td class="mono">' + root.Format.exponential(row.discrepancy, 3) + '</td></tr>';
    }).join(''));

    const last = series.rows[series.rows.length - 1];
    root.Helpers.setText('mce-series-note',
      'The third column is not a fit — it is the first row’s error scaled by √(N₀/N), so the ' +
      'agreement with the second column is the 1/√N rate being confirmed rather than assumed. ' +
      'At ' + root.Format.exact(last.samples) + ' samples the measured mean error is ' +
      root.Format.exponential(last.meanError, 3) + ' against a predicted ' +
      root.Format.exponential(last.predicted, 3) + '. The right-hand pair is the reason quasi-' +
      'Monte Carlo works: the star discrepancy of the van der Corput set is ' +
      root.Format.exponential(last.discrepancy, 3) + ', and the Koksma-Hlawka inequality bounds ' +
      'the integration error by the discrepancy times the integrand’s variation — so a point set ' +
      'chosen to be evenly spread integrates well, and the error column tracks the discrepancy ' +
      'column almost exactly.');
  }

  function paintDimension(dimension) {
    root.jQuery('#mce-dimension tbody').html(dimension.rows.map(function (row) {
      const gridWins = row.gridError < row.monteCarloError;
      return '<tr' + (gridWins ? '' : ' class="matrix-row-lit"') + '><td class="mono">' +
        row.dimension + '</td><td class="mono">' + root.Format.exact(row.nodes) +
        '</td><td class="mono">' + root.Format.exact(row.gridPoints) + '</td><td class="mono">' +
        root.Format.exponential(row.gridError, 2) + '</td><td class="mono">' +
        root.Format.exponential(row.monteCarloError, 2) + '</td><td>' +
        (gridWins ? 'grid' : 'sampling') + '</td></tr>';
    }).join(''));

    const first = dimension.rows[0];
    const last = dimension.rows[dimension.rows.length - 1];
    root.Helpers.setText('mce-dimension-note',
      'Same integrand, same exact answer of 1, same point budget of ' +
      root.Format.exact(dimension.budget) + ' in every row. The grid’s error climbs from ' +
      root.Format.exponential(first.gridError, 2) + ' at one dimension to ' +
      root.Format.exponential(last.gridError, 2) + ' at ' + root.Format.exact(last.dimension) +
      ', because the nodes per axis collapse from ' + root.Format.exact(first.nodes) + ' to ' +
      root.Format.exact(last.nodes) + '. The sampling column does not move at all. That is the ' +
      'dimension independence of 1/√N, and it is the only reason anybody integrates by throwing ' +
      'darts.');
  }

  function paintRare(rare) {
    const rows = [{ shift: 0, run: rare.plain, relativeError: rare.plain.error / rare.exact,
      plainRow: true }].concat(rare.rows.filter(function (row) { return row.shift > 0; }));

    root.jQuery('#mce-rare-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + (row.plainRow ? 'none (plain sampling)'
        : root.Format.fixed(row.shift, 1)) + '</td><td class="mono">' +
        root.Format.exponential(row.run.estimate, 4) + '</td><td class="mono">' +
        root.Format.percent(row.relativeError, 3) + '</td><td class="mono">' +
        root.Format.exact(row.run.hits) + '</td><td class="mono">' +
        root.Format.fixed(row.run.weightEss, 1) + '</td></tr>';
    }).join(''));

    const best = rare.rows.reduce(function (a, b) {
      return b.relativeError < a.relativeError ? b : a;
    });
    const over = rare.rows[rare.rows.length - 1];
    root.Helpers.setText('mce-rare-note',
      'The exact answer is ' + root.Format.exponential(rare.exact, 6) + ', so plain sampling ' +
      'needs about ' + root.Format.exact(rare.samplesForOneHit) + ' draws to see one hit and ' +
      'gets ' + root.Format.exact(rare.plain.hits) + ' from ' + root.Format.exact(rare.samples) +
      '. Shifting the proposal to ' + root.Format.fixed(best.shift, 1) + ' brings the relative ' +
      'error to ' + root.Format.percent(best.relativeError, 3) + '. Now read the last row, which ' +
      'is the trap: a shift of ' + root.Format.fixed(over.shift, 1) + ' puts ' +
      root.Format.exact(over.run.hits) + ' of ' + root.Format.exact(rare.samples) + ' draws past ' +
      'the threshold — the best hit count in the table — and is ' +
      root.Format.percent(over.relativeError, 1) + ' out, because almost all the weight sits on ' +
      'a few draws. The hit count says it is working and the weight ESS of ' +
      root.Format.fixed(over.run.weightEss, 1) + ' says it is not. Trust the second one.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
