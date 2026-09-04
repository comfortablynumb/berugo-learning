/**
 * Section: markov-chain-monte-carlo.
 *
 * The section is built on one comparison the demo makes impossible to look
 * away from: at a proposal width of 0.1 the chain accepts 93% of its moves,
 * which reads as perfect health on every dashboard, and it is the worst chain
 * in the table. It never crosses to the second mode, its effective sample size
 * is 75 out of 20 000, its estimated mean is out by 1.38, and the standard
 * error it reports is 0.006. The answer is roughly two hundred and fifty of
 * its own standard errors away from the truth.
 *
 * Everything else in the section is the set of instruments that would have
 * caught it: the autocorrelation, the effective sample size derived from it,
 * the mode share, and R-hat across dispersed chains. The last is the only one
 * that can detect a chain stuck in a mode, because a single chain has nothing
 * to disagree with.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'markov-chain-monte-carlo';
  let panel = null;
  let trace = null;
  let acf = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — propose, accept, repeat, and the condition that makes it work',
      caption: 'Detailed balance is the condition that pins the stationary distribution: if the ' +
        'flow from x to y equals the flow from y to x for every pair, then π is preserved by the ' +
        'step. The Metropolis acceptance rule is constructed to satisfy it, and the normalising ' +
        'constant of π cancels in the ratio — which is the entire reason the method exists, ' +
        'because that constant is exactly what nobody can compute. Detailed balance guarantees ' +
        'the chain converges to π eventually; it says nothing at all about how long that takes.',
      definition: [
        'flowchart TD',
        '    A["at x"] --> B["propose y ~ q(y | x)<br/>here: y = x + normal noise"]',
        '    B --> C["ratio r = pi(y) / pi(x)<br/>the constant cancels"]',
        '    C --> D{"u ~ Uniform(0,1)<br/>u < r ?"}',
        '    D -- yes --> E["accept: move to y"]',
        '    D -- no --> F["reject: STAY at x<br/>and record x again"]',
        '    E --> A',
        '    F --> A',
        '    C -.-> G["detailed balance:<br/>pi(x) P(x to y) = pi(y) P(y to x)"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The method exists because the normalising constant cancels.** A posterior is a density ' +
        'you can evaluate up to an unknown factor. That factor is an integral over the whole ' +
        'parameter space that nobody can do.',
      'Metropolis–Hastings only ever uses the RATIO π(y)/π(x), in which the factor disappears. So ' +
        'a distribution you cannot normalise is a distribution you can sample from.',
      '**A rejection is not a wasted step. It is a repeated sample.** The chain records its ' +
        'current position again, and that repetition is what gives high-density regions their ' +
        'weight.',
      'Code that skips rejected steps rather than re-recording the current one samples from the ' +
        'wrong distribution, and nothing in the output looks unusual.',
      '**Consecutive draws are correlated, so N draws are not N samples.** The integrated ' +
        'autocorrelation time τ says how many steps the chain takes to forget where it was, and ' +
        'the effective sample size is N/τ.',
      'The demo shows a chain of 20 000 draws worth 75 independent ones.',
      'Every standard error computed as σ/√N on that chain is too narrow by a factor of √τ, which ' +
        'here is about sixteen.',
      '**Both failure modes are step-size problems and they sit on opposite sides.** Too small a ' +
        'proposal is accepted almost always and moves almost nowhere. Too large is rejected ' +
        'almost always and the chain sits still.',
      'The optimum for a random walk is around 0.234 acceptance in high dimensions and 0.4–0.5 in ' +
        'one or two.',
      'So a *low* acceptance rate is the target, and the 93% reading that looks healthiest is the ' +
        'diagnosis of the worst chain in the table.',
      '**Burn-in and mixing are different problems and only one of them is fixable by waiting.** ' +
        'Burn-in is the chain forgetting its starting point, and discarding a prefix handles it.',
      'A chain that cannot cross between modes will never mix however long you run it.',
      'The only diagnostic that sees that is several chains started far apart: Gelman and Rubin’s ' +
        'R̂, which compares the variance between chains against the variance within them.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — a trace, an autocorrelation and four chains that disagree',
        markup: root.MarkovChainMonteCarloTemplate.render()
      },
      diagram: diagram(),
      insight: '**The failure mode of MCMC is a small standard error attached to a wrong number, ' +
        'and it is the default outcome of a badly sized proposal.** Nothing throws, nothing warns, ' +
        'and the acceptance rate — the one number most people look at — points the wrong way. The ' +
        'practical rule is three lines long. **Run several chains from dispersed starts, report ' +
        'effective sample size rather than sample count, and never quote a posterior mean whose ' +
        'R̂ is above 1.01.** The demo’s width-0.1 column is what happens without them. It shows ' +
        '93% acceptance, a beautiful-looking trace at the wrong scale, and an answer two hundred ' +
        'and fifty of its own standard errors from the truth.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MarkovChainMonteCarloTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.chainStudy({ steps: Number(parts[0]), target: parts[1], seed: 42 });
  });

  const convergenceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.convergenceStudy({ width: Number(parts[0]), target: parts[1],
      steps: 8000 });
  });

  function chosenRow(study, width) {
    for (let i = 0; i < study.rows.length; i += 1) {
      if (study.rows[i].width === width) return study.rows[i];
    }
    return study.rows[0];
  }

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['mcm-steps'] + '|' + values['mcm-target']);
    const row = chosenRow(study, Number(values['mcm-width']));
    const convergence = convergenceFor(values['mcm-width'] + '|' + values['mcm-target']);

    paintMetrics(row, study);
    paintTrace(app, row, study);
    paintWidths(study, row);
    paintAcf(app, study, row);
    paintChains(convergence);
    paintDiagnostics(row, convergence, study);
  }

  function paintMetrics(row, study) {
    root.MetricGrid.update({
      'mcm-accept': { value: root.Format.percent(row.acceptanceRate, 1),
        note: 'the best-mixing width in this table accepts ' +
          root.Format.percent(bestRow(study).acceptanceRate, 1) },
      'mcm-ess': { value: root.Format.fixed(row.ess, 1),
        note: 'from ' + root.Format.exact(row.steps) + ' draws, correlation time ' +
          root.Format.fixed(row.autocorrelationTime, 1) },
      'mcm-bars': { value: root.Format.fixed(row.honestError / row.naiveError, 1) + '×',
        note: 'naive ' + root.Format.fixed(row.naiveError, 5) + ', honest ' +
          root.Format.fixed(row.honestError, 5) },
      'mcm-modes': { value: row.modeShare === null ? '—'
        : root.Format.percent(row.modeShare.measured, 1),
      note: row.modeShare === null ? 'this target has one mode'
        : 'its true weight is ' + root.Format.percent(row.modeShare.expected, 1) }
    });
  }

  function bestRow(study) {
    return study.rows.reduce(function (a, b) { return b.ess > a.ess ? b : a; });
  }

  function paintTrace(app, row, study) {
    const host = root.jQuery('#mcm-trace')[0];
    if (!host) return;
    if (trace) trace.destroy();

    const stride = Math.max(1, Math.floor(row.steps / 1200));
    const points = [];
    for (let i = 0; i < row.steps; i += stride) points.push({ x: i, y: row.chainX[i] });
    const best = bestRow(study);
    const bestPoints = [];
    for (let i = 0; i < best.steps; i += stride) bestPoints.push({ x: i, y: best.chainX[i] });

    trace = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260,
      xLabel: 'step', yLabel: 'first coordinate',
      yMin: -6, yMax: 6,
      series: [
        { label: 'width ' + row.width, points: points, width: 1 },
        { label: 'width ' + best.width + ' (best mixing here)', points: bestPoints, width: 1 }
      ],
      legendHost: root.jQuery('#mcm-trace-legend')[0]
    });

    root.Helpers.setText('mcm-trace-note',
      'A well-mixed trace looks like noise around the target and crosses between the modes ' +
      'repeatedly; a badly mixed one looks like a slow wander that stays on one side. Every ' +
      root.Format.exact(stride) + 'th draw is plotted, so the visible texture is real rather ' +
      'than an artefact of overplotting. Note what the eye cannot judge here: both traces are ' +
      '"noisy", and only one of them is a sample from the distribution.');
  }

  function paintWidths(study, chosen) {
    root.jQuery('#mcm-widths tbody').html(study.rows.map(function (row) {
      return '<tr' + (row.width === chosen.width ? ' class="matrix-row-lit"' : '') +
        '><td class="mono">' + row.width + '</td><td class="mono">' +
        root.Format.percent(row.acceptanceRate, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.mean, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.meanError, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.autocorrelationTime, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.ess, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.naiveError, 5) + '</td><td class="mono">' +
        root.Format.fixed(row.honestError, 5) + '</td></tr>';
    }).join(''));

    const worst = study.rows[0];
    const best = bestRow(study);
    root.Helpers.setText('mcm-widths-note',
      'Read the acceptance column and the effective-sample column together. The width-' +
      worst.width + ' chain accepts ' + root.Format.percent(worst.acceptanceRate, 1) +
      ' of its proposals and is worth ' + root.Format.fixed(worst.ess, 0) + ' independent draws; ' +
      'the width-' + best.width + ' chain accepts ' + root.Format.percent(best.acceptanceRate, 1) +
      ' and is worth ' + root.Format.fixed(best.ess, 0) + '. The two error columns are the ' +
      'consequence: the naive bar barely moves down the table because it only sees σ and N, ' +
      'while the honest one moves by a factor of ' +
      root.Format.fixed(worst.honestError / best.honestError, 1) + '. The width-' + worst.width +
      ' row is the dangerous one — its error of ' + root.Format.fixed(worst.meanError, 3) +
      ' is ' + root.Format.exact(Math.round(worst.meanError / worst.naiveError)) +
      ' times its own reported standard error.');
  }

  function paintAcf(app, study, row) {
    const host = root.jQuery('#mcm-acf')[0];
    if (!host) return;
    if (acf) acf.destroy();

    const best = bestRow(study);
    const lags = 400;
    const series = [row, best].map(function (entry, index) {
      const rho = root.Mcmc.autocorrelation(entry.chainX.slice(0, 8000), lags);
      return { label: 'width ' + entry.width + (index === 1 ? ' (best mixing here)' : ''),
        points: rho.map(function (value, lag) { return { x: lag, y: value }; }) };
    });

    acf = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240,
      xLabel: 'lag', yLabel: 'autocorrelation', yMin: -0.2, yMax: 1,
      series: series,
      legendHost: root.jQuery('#mcm-acf-legend')[0]
    });

    root.Helpers.setText('mcm-acf-note',
      'The area under this curve is what τ measures, and the effective sample size is the chain ' +
      'length divided by 1 + twice that area. A curve that has not reached zero by the right-hand ' +
      'edge is a chain whose correlation time is longer than the window — the estimate of τ is ' +
      'then a lower bound and the effective sample size an upper one, which is the direction that ' +
      'flatters the chain. Geyer’s truncation rule stops the sum at the first negative PAIR ' +
      'rather than the first negative value, because single lags go negative by noise and ' +
      'stopping there underestimates τ on exactly the chains you are trying to catch.');
  }

  function paintChains(convergence) {
    root.jQuery('#mcm-chains tbody').html(convergence.chains.map(function (chain, index) {
      return '<tr><td class="mono">' + root.Format.fixed(convergence.starts[index], 1) +
        '</td><td class="mono">' + root.Format.fixed(chain.mean, 4) + '</td><td class="mono">' +
        (chain.modeShare === null ? '—' : root.Format.percent(chain.modeShare.measured, 1)) +
        '</td><td class="mono">' + root.Format.fixed(chain.ess, 1) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mcm-chains-note',
      'Four chains, same target, same proposal, four starting points. R̂ = ' +
      root.Format.fixed(convergence.rHat.rHat, 4) + ', comparing a between-chain variance of ' +
      root.Format.fixed(convergence.rHat.between, 3) + ' against a within-chain variance of ' +
      root.Format.fixed(convergence.rHat.within, 3) + '. The usual threshold is 1.01, and the ' +
      'reason to run several chains rather than one long one is visible in the mean column: a ' +
      'single chain reports a mean and has nothing to disagree with, and four chains that ' +
      'disagree are the only evidence that any of them is wrong.');
  }

  function paintDiagnostics(row, convergence, study) {
    const best = bestRow(study);
    const rows = [
      { name: 'acceptance rate',
        reading: root.Format.percent(row.acceptanceRate, 1),
        verdict: row.acceptanceRate > 0.6 ? 'looks healthy' : 'looks low',
        misses: 'everything — 93% acceptance is the signature of a chain that is not moving' },
      { name: 'trace plot', reading: 'visual',
        verdict: 'ambiguous at this scale',
        misses: 'a chain confined to one mode looks like well-mixed noise if you do not know ' +
          'the other mode is there' },
      { name: 'effective sample size',
        reading: root.Format.fixed(row.ess, 1) + ' of ' + root.Format.exact(row.steps),
        verdict: row.ess < row.steps / 50 ? 'badly correlated' : 'acceptable',
        misses: 'a chain that mixes well WITHIN one mode and never leaves it — the ESS can be ' +
          'high and the answer still wrong' },
      { name: 'second-mode share',
        reading: row.modeShare === null ? '—' : root.Format.percent(row.modeShare.measured, 1),
        verdict: row.modeShare === null ? 'not applicable'
          : (Math.abs(row.modeShare.measured - row.modeShare.expected) < 0.05 ? 'agrees' : 'wrong'),
        misses: 'requires knowing the modes in advance, which in a real posterior you do not' },
      { name: 'Gelman–Rubin R̂',
        reading: root.Format.fixed(convergence.rHat.rHat, 4),
        verdict: convergence.rHat.rHat > 1.01 ? 'not converged' : 'no disagreement',
        misses: 'a mode that NONE of the chains found — all four can agree on the wrong answer' }
    ];
    root.jQuery('#mcm-diagnostics tbody').html(rows.map(function (entry) {
      return '<tr><td>' + entry.name + '</td><td class="mono">' + entry.reading + '</td><td>' +
        entry.verdict + '</td><td>' + entry.misses + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mcm-diagnostics-note',
      'No single row of this table is sufficient, which is why the practice is to report three ' +
      'of them together. The last column is the important one: every diagnostic has a failure ' +
      'it cannot see, and R̂ — the strongest of them — still cannot detect a mode that none of ' +
      'the chains visited. That is the honest limit of the method, and the reason dispersed ' +
      'starting points matter more than chain length. For reference, the best-mixing width in ' +
      'this table (' + best.width + ') reaches an effective sample size of ' +
      root.Format.fixed(best.ess, 0) + ' and a mode share of ' +
      (best.modeShare === null ? '—' : root.Format.percent(best.modeShare.measured, 1)) + '.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
