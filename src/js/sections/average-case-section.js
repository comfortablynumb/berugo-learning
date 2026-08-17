/**
 * Section: Average-case and probabilistic analysis.
 *
 * The closed form and the simulation, side by side. Agreement is the evidence
 * that the indicator-variable derivation was right; disagreement would mean
 * the model was wrong, which is the more useful outcome.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'average-case';
  let panel = null;
  let chart = null;
  let lastRun = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'The expected number of comparisons in randomised quicksort is derived without touching a ' +
          'recurrence: for each pair of elements, write down the probability that they are ever ' +
          'compared, then add the probabilities up. Linearity of expectation does the rest, and it ' +
          'does not care that the events are dependent.',
        'Two elements whose ranks differ by g are compared exactly when one of them is chosen as ' +
          'pivot before any of the g−1 elements between them, which happens with probability ' +
          '2/(g+1). Summing over every pair gives the exact expectation shown below.',
        'Then run the experiment. The measured mean should sit on the closed form; the spread is ' +
          'what tells you how often a single run will be far from it.'
      ],
      demo: { title: 'Interactive demo — derive it, then measure it', markup: root.AverageCaseTemplate.render() },
      diagram: {
        title: 'Diagram — average case versus randomised algorithm',
        caption: 'Randomising the algorithm moves the assumption from the world to your own coin.',
        definition: [
          'flowchart LR',
          '    A["Random input,<br/>deterministic algorithm"] --> B["Average case:<br/>assumes a distribution<br/>your users may not honour"]',
          '    C["Arbitrary input,<br/>randomised algorithm"] --> D["Expected cost:<br/>holds for every input,<br/>over your own randomness"]'
        ].join('\n')
      },
      insight: '"Average case" silently assumes a distribution over inputs that your adversary — or ' +
        'just your production traffic — may not honour. Randomising the algorithm makes the ' +
        'guarantee hold for every input, and that is why quicksort chooses a random pivot.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AverageCaseTemplate.controls,
      onChange: function (id) { if (id === 'avg-run') runExperiment(app); }
    });

    runExperiment(app);
  }

  function runExperiment(app) {
    const values = panel.values();
    const n = values['avg-n'];
    const trials = values['avg-trials'];
    const rng = root.Random.seeded(values['avg-seed']);

    panel.disable('avg-run', true);

    const stats = root.Probabilistic.sample({
      trials: trials,
      trial: function () { return root.Probabilistic.quicksortComparisons(n, rng); }
    });

    const exact = root.Probabilistic.quicksortExpectation(n);
    const asymptotic = root.Probabilistic.quicksortAsymptotic(n);
    const bounds = root.Probabilistic.tailBounds({ mean: exact, sd: stats.sd, threshold: stats.max });

    lastRun = { stats: stats, exact: exact, n: n, trials: trials };

    root.MetricGrid.update({
      'avg-measured': { value: root.Format.exact(stats.mean), note: 'mean of ' + trials + ' trials at n = ' + n },
      'avg-exact': { value: root.Format.exact(exact), note: 'closed form, no simulation' },
      'avg-asymptotic': { value: root.Format.exact(asymptotic), note: root.Format.percent(asymptotic / exact - 1, 1) + ' off the exact sum' },
      'avg-error': {
        value: root.Format.percent(Math.abs(stats.mean - exact) / exact, 2),
        note: Math.abs(stats.mean - exact) / exact < 0.02 ? 'the derivation checks out' : 'wider than expected — raise the trials'
      },
      'avg-spread': { value: root.Format.exact(stats.sd), note: root.Format.percent(stats.sd / stats.mean, 1) + ' of the mean' },
      'avg-tail': {
        value: root.Format.exact(stats.max),
        note: 'Chebyshev allows ' + root.Format.percent(bounds.chebyshev, 1) + ' of trials at or past it'
      }
    });

    panel.disable('avg-run', false);
    draw(app);
  }

  function draw(app) {
    const bins = root.Probabilistic.histogram(lastRun.stats.values, 26);
    const peak = bins.reduce(function (max, bin) { return Math.max(max, bin.y); }, 0);

    chart = root.GrowthPlot.render(root.jQuery('#avg-chart')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      series: [{ label: 'trials in this bucket', points: bins, dots: true }],
      markers: [
        { x: lastRun.exact, label: 'exact expectation', anchor: 'start', labelY: 12 },
        { x: lastRun.stats.mean, label: 'measured mean', anchor: 'end', labelY: 28, color: root.Palette.hue('green') }
      ],
      xLabel: 'comparisons',
      yLabel: 'trials',
      yMin: 0,
      legendHost: root.jQuery('#avg-legend')[0],
      summary: function () {
        return 'Histogram of comparison counts over ' + lastRun.trials + ' randomised quicksort runs ' +
          'at n = ' + lastRun.n + ', peaking at ' + peak + ' trials in a bucket, with the exact ' +
          'expectation and the measured mean marked.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
