/**
 * Section: randomised-design.
 *
 * The two error models on one page, using the only pair of algorithms where
 * both are familiar: a Monte Carlo primality test, which always finishes and
 * is sometimes wrong, and a Las Vegas repeat-until-success, which is never
 * wrong and sometimes takes a long time.
 *
 * The measurement that carries the section is the liar density. 561 fools the
 * Fermat test on 57.0% of bases and Miller-Rabin on 1.43% - both are one-sided
 * Monte Carlo tests with the same shape, and only one of them amplifies to
 * anything usable, because 0.570^k stays visible for a long time and 0.0143^k
 * does not. That is the difference between "randomised" and "flaky".
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'randomised-design';
  let panel = null;
  let chart = null;
  let histogram = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the two error models, and what repetition does to each',
      caption: 'A Monte Carlo algorithm has a fixed runtime and a probability of being wrong; a ' +
        'Las Vegas one is always right and has a random runtime. Repetition helps both, but it ' +
        'helps them differently: for one-sided Monte Carlo error the failure probability is ' +
        'multiplied by itself, so it falls exponentially in the number of rounds, and for Las ' +
        'Vegas the answer never changes and repetition only moves you along the runtime ' +
        'distribution. The two are convertible in one direction for free — stop a Las Vegas run ' +
        'at a deadline and you have a Monte Carlo one — and in the other only when correctness ' +
        'can be checked.',
      definition: [
        'flowchart TD',
        '    A["a randomised algorithm"] --> B{"is the runtime fixed<br/>or the answer?"}',
        '    B -- "runtime fixed" --> C["Monte Carlo<br/>answer may be wrong"]',
        '    B -- "answer certain" --> D["Las Vegas<br/>runtime is random"]',
        '    C --> E{"one-sided error?"}',
        '    E -- yes --> F["k rounds: failure p^k<br/>repetition is pure gain"]',
        '    E -- no --> G["k rounds: majority vote<br/>Chernoff bound"]',
        '    D --> H["expected runtime 1/p<br/>the tail is the risk"]',
        '    H --> I["stop at a deadline<br/>= Monte Carlo again"]',
        '    F --> J["failure below a<br/>cosmic-ray bit flip"]'
      ].join('\n')
    };
  }

  const ORIENTATION = [
        '**Monte Carlo and Las Vegas differ in which of the two things is random.** A Monte Carlo ' +
          'algorithm runs for a fixed time and may return the wrong answer. A Las Vegas algorithm ' +
          'returns the right answer and may take a long time.',
        'Randomised quicksort is Las Vegas, because the output is sorted whatever the pivots were. ' +
          'A primality test that checks k random bases is Monte Carlo.',
        'Converting one way is free. Run the Las Vegas algorithm with a deadline and you have a ' +
          'Monte Carlo one whose error probability is the chance of overrunning.',
        'The other direction needs a way to *check* an answer, which is exactly what 19.5 is about.',
        '**One-sided error is worth much more than two-sided error.** A test that only ever errs in ' +
          'one direction says "prime" about a composite, but never "composite" about a prime.',
        'Such a test amplifies by simple repetition. Any round that says composite settles it, so k ' +
          'rounds fail only if all k fail, and the probability is the product.',
        'Two-sided error needs a majority vote over many more rounds, and the analysis is a Chernoff ' +
          'bound rather than a multiplication.',
        '**The per-instance rate and the universal bound are different numbers, and the gap is ' +
          'usually enormous.** Rabin proved at most a quarter of the bases below n can fool ' +
          'Miller–Rabin on a composite, so 4⁻ᵏ is the guarantee.',
        'The demo measures the actual density on the hardest small composites and finds it around ' +
          '1%. So the true failure rate at three rounds is nearer 10⁻⁶ than 10⁻².',
        'You quote the bound in a design document, and you measure the rate before choosing k.',
        '**Randomising the algorithm is not the same as assuming a random input.** Quicksort on a ' +
          'random permutation is an average-case claim that an adversary can violate.',
        'Quicksort with a random pivot is a claim about *your* coins that holds on every input, ' +
          'including the one the adversary chose.',
        'The second is a guarantee and the first is a hope, and the code differs by one line.',
        '**Amplification makes a defensible engineering position.** Twenty Miller–Rabin rounds put ' +
          'the failure probability under 4⁻²⁰ ≈ 10⁻¹².',
        'That is below the rate at which cosmic rays flip bits in the RAM the deterministic ' +
          'algorithm would run in.',
        '"It might be wrong" stops being an objection somewhere around there, and knowing where is ' +
          'the point of measuring.'
  ];

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: ORIENTATION,
      demo: {
        title: 'Interactive demo — error decaying with rounds, and a runtime distribution',
        markup: root.RandomisedDesignTemplate.render()
      },
      diagram: diagram(),
      insight: '**Do not argue about whether a randomised algorithm is acceptable. Compute the ' +
        'number and compare it to something.** The demo puts three quantities in one table: the ' +
        'measured failure rate, this instance’s bound and Rabin’s universal 4⁻ᵏ. They span ' +
        'several orders of magnitude at every round count. Twenty rounds is under 10⁻¹², which is ' +
        'smaller than the probability that the deterministic implementation you were going to ' +
        'write instead has a bug in it. The Las Vegas half carries the other lesson. A mean of ' +
        'five attempts sounds safe until you look at the tail. There the 99th percentile is four ' +
        'times the mean, and a timeout set at twice the mean kills more than one run in ten. ' +
        '**Randomised algorithms are sized from their tails, not their means.**'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RandomisedDesignTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const amplifyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.amplify({ n: Number(parts[0]), trials: Number(parts[1]),
      maxRounds: 6 });
  });

  const vegasFor = root.Helpers.memoise(function (key) {
    return root.RandomizedLab.lasVegasRuns({ successProbability: Number(key), trials: 4000 });
  });

  function update(app) {
    const values = panel.values();
    const amplify = amplifyFor(values['rzd-composite'] + '|' + values['rzd-trials']);
    const vegas = vegasFor(values['rzd-success']);

    paintMetrics(amplify, vegas);
    paintChart(app, amplify);
    paintAmplify(amplify);
    paintVegas(vegas);
    paintHistogram(app, vegas);
    paintLiars(amplify);
  }

  function paintMetrics(amplify, vegas) {
    const third = amplify.rows[2];
    root.MetricGrid.update({
      'rzd-fermat': { value: root.Format.percent(amplify.density.fermatRate, 1),
        note: root.Format.exact(amplify.density.fermatLiars) + ' of ' +
          root.Format.exact(amplify.density.bases) + ' bases say "prime"' },
      'rzd-miller': { value: root.Format.percent(amplify.density.millerRate, 2),
        note: root.Format.exact(amplify.density.millerLiars) + ' bases, against a proven ceiling of 25%' },
      'rzd-failure': { value: third.failures === 0 ? '0 of ' + root.Format.exact(third.trials)
        : root.Format.exponential(third.measured, 2),
      note: 'this composite predicts ' + root.Format.exponential(third.perInstance, 2) +
          ', Rabin allows ' + root.Format.exponential(third.universal, 2) },
      'rzd-attempts': { value: root.Format.fixed(vegas.mean, 2),
        note: 'expected 1/p = ' + root.Format.fixed(vegas.expectedMean, 2) +
          ', worst run ' + root.Format.exact(vegas.worst) }
    });
  }

  function paintChart(app, amplify) {
    const host = root.jQuery('#rzd-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      yMin: 1e-10,
      xLabel: 'independent rounds',
      yLabel: 'probability of being fooled',
      series: [
        { label: 'measured', points: amplify.rows.filter(function (row) {
          return row.measured > 0;
        }).map(function (row) { return { x: row.rounds, y: row.measured }; }) },
        { label: 'this composite: (liar density)^k', points: amplify.rows.map(function (row) {
          return { x: row.rounds, y: row.perInstance };
        }) },
        { label: 'Rabin’s universal 4^-k', dashed: true, points: amplify.rows.map(function (row) {
          return { x: row.rounds, y: row.universal };
        }) }
      ],
      legendHost: root.jQuery('#rzd-legend')[0]
    });

    root.Helpers.setText('rzd-chart-note',
      'The vertical axis is logarithmic, so an exponential decay is a straight line and all ' +
      'three of these are. The measured points stop when no run in the budget was fooled — ' +
      'a rate below one over the trial count cannot be distinguished from zero, and drawing a ' +
      'zero on a log axis would claim a certainty the experiment does not have. The gap between ' +
      'the two lower lines and the top one is the difference between what this instance does and ' +
      'what any instance is guaranteed to do, and it is about a factor of ' +
      root.Format.exact(Math.round(0.25 / Math.max(amplify.density.millerRate, 1e-9))) +
      ' per round.');
  }

  function paintAmplify(amplify) {
    root.jQuery('#rzd-amplify tbody').html(amplify.rows.map(function (row) {
      return '<tr><td class="mono">' + row.rounds + '</td><td class="mono">' +
        root.Format.exact(row.failures) + ' / ' + root.Format.exact(row.trials) +
        '</td><td class="mono">' + (row.failures === 0 ? '< ' +
          root.Format.exponential(1 / row.trials, 1) : root.Format.exponential(row.measured, 3)) +
        '</td><td class="mono">' + root.Format.exponential(row.perInstance, 2) +
        '</td><td class="mono">' + root.Format.exponential(row.universal, 2) +
        '</td><td class="mono">' + (row.failures === 0 ? '—'
          : root.Format.exponential(row.standardError, 1)) + '</td></tr>';
    }).join(''));

    const first = amplify.rows[0];
    root.Helpers.setText('rzd-amplify-note',
      'Read across the first row before reading down. One round is fooled ' +
      root.Format.exponential(first.measured, 3) + ' of the time, this composite’s liar ' +
      'density predicts ' + root.Format.exponential(first.perInstance, 2) + ', and Rabin’s ' +
      'theorem allows up to 0.25 — three numbers for the same event, and the two on the right ' +
      'are a prediction and a promise rather than a description. Reading down, each round ' +
      'multiplies the failure probability by the liar density, which is what one-sided error ' +
      'buys: no vote, no Chernoff bound, just a product. That is why the row that says ' +
      '"0 of ' + root.Format.exact(first.trials) + '" appears so quickly, and why the honest ' +
      'entry there is an upper bound rather than a zero.');
  }

  function paintVegas(vegas) {
    const rows = [
      { label: 'mean attempts', measured: root.Format.fixed(vegas.mean, 3),
        predicted: '1/p = ' + root.Format.fixed(vegas.expectedMean, 3) },
      { label: 'median attempts', measured: root.Format.exact(vegas.median),
        predicted: 'ln 2 / −ln(1 − p) = ' +
          root.Format.fixed(Math.log(2) / -Math.log(1 - vegas.successProbability), 2) },
      { label: '99th percentile', measured: root.Format.exact(vegas.p99),
        predicted: 'ln 100 / −ln(1 − p) = ' + root.Format.fixed(vegas.expectedP99, 2) },
      { label: 'worst of ' + root.Format.exact(vegas.trials), measured: root.Format.exact(vegas.worst),
        predicted: 'unbounded — the distribution has no maximum' },
      { label: 'runs over a budget of ' + root.Format.exact(vegas.budget),
        measured: root.Format.exact(vegas.overBudget) + ' (' +
          root.Format.percent(vegas.overBudgetRate, 1) + ')',
        predicted: '(1 − p)^budget = ' +
          root.Format.percent(Math.pow(1 - vegas.successProbability, vegas.budget), 1) }
    ];
    root.jQuery('#rzd-vegas-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' + row.measured +
        '</td><td class="mono">' + row.predicted + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rzd-vegas-note',
      'Nothing in this table is about correctness — every one of these runs returned the right ' +
      'answer. What varies is how long it took, and the mean is the least useful number in the ' +
      'column: a budget of twice the mean still kills ' +
      root.Format.percent(vegas.overBudgetRate, 1) + ' of runs, because a geometric ' +
      'distribution has a heavy tail relative to its mean. If you have ever set a retry timeout ' +
      'at "twice the average" and watched the error rate refuse to go to zero, this table is ' +
      'why.');
  }

  function paintHistogram(app, vegas) {
    const host = root.jQuery('#rzd-histogram')[0];
    if (!host) return;
    if (histogram) histogram.destroy();

    histogram = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib,
      height: 220,
      xLabel: 'attempts before the first success',
      yLabel: 'runs',
      values: vegas.histogram.map(function (bucket) {
        return { label: bucket.from === bucket.to - 1 ? String(bucket.from + 1)
          : (bucket.from + 1) + '–' + bucket.to, value: bucket.count };
      })
    });

    root.Helpers.setText('rzd-histogram-note',
      'The shape is geometric: the most likely outcome is one attempt, and the bars fall by a ' +
      'constant factor after that. The bars matter more than the mean because the right-hand ' +
      'end is where the incidents come from — the run that took ' +
      root.Format.exact(vegas.worst) + ' attempts is in there, one bar of height one, and it ' +
      'will happen to somebody.');
  }

  function paintLiars(amplify) {
    const density = amplify.density;
    const rows = [
      { test: 'Fermat', liars: density.fermatLiars, rate: density.fermatRate,
        bound: 'nothing — a Carmichael number passes for EVERY coprime base',
        usable: 'no' },
      { test: 'Miller–Rabin', liars: density.millerLiars, rate: density.millerRate,
        bound: 'at most 1/4 of the bases, for every composite', usable: 'yes' }
    ];
    root.jQuery('#rzd-liars tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.test + '</td><td class="mono">' + root.Format.exact(row.liars) +
        '</td><td class="mono">' + root.Format.exact(density.bases) + '</td><td class="mono">' +
        root.Format.percent(row.rate, 2) + '</td><td>' + row.bound + '</td><td>' +
        row.usable + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rzd-liars-note',
      'The two tests have the same shape — pick a base, do one modular exponentiation, answer ' +
      '"composite" or "do not know" — and completely different amplification. On ' +
      root.Format.exact(density.n) + ' the Fermat test is fooled by ' +
      root.Format.percent(density.fermatRate, 1) + ' of bases, so 0.57ᵏ needs about forty ' +
      'rounds to reach 10⁻¹⁰ and on a Carmichael number with no small factors it never gets ' +
      'there at all, because every coprime base is a liar. Miller–Rabin is fooled by ' +
      root.Format.percent(density.millerRate, 2) + ' and reaches the same place in five. The ' +
      'difference is one extra check — that no non-trivial square root of 1 turned up on the ' +
      'way — and it is the difference between an algorithm and an anecdote.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
