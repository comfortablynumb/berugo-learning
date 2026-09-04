/**
 * Section: online scheduling and load balancing.
 *
 * Two results, both measured against a real optimum rather than a bound. The
 * first is Graham's: putting each arriving job on the least-loaded machine is
 * (2 − 1/m)-competitive, and the family that attains it is m(m − 1) tiny jobs
 * followed by one enormous one — a construction worth knowing because it is
 * exactly what a burst of small requests followed by one large one does to a
 * live load balancer.
 *
 * The second is the one worth acting on. Assigning to a uniformly random
 * machine leaves a maximum load of about log n / log log n above the mean;
 * sampling TWO and taking the less loaded leaves about log log n. It is one
 * extra sample and an exponential improvement, and the demo measures both
 * against their predictions rather than quoting the theorem.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'online-scheduling';
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
      title: 'Diagram — one sample against two, and why the second one changes the exponent',
      caption: 'With one sample the ball goes wherever it lands, so the load of a bin is a ' +
        'Poisson draw and the maximum over n of them is about log n / log log n. With two ' +
        'samples the ball avoids the busier of the pair, so a bin only grows past height h when ' +
        'BOTH samples were already at h — and the probability of that squares at every level. ' +
        'Squaring a probability per level is what turns a logarithm into a log-logarithm, and it ' +
        'is the whole argument. Three samples cube it instead of squaring, which is a further ' +
        'improvement of a constant factor rather than an exponent, so two is where the benefit ' +
        'per sample stops.',
      definition: [
        'flowchart TD',
        '    A["a job arrives"] --> B{"how many machines to sample?"}',
        '    B -- "one" --> C["send it there"]',
        '    C --> D["max load ≈ mean + log n / log log n"]',
        '    B -- "two" --> E["sample i and j"]',
        '    E --> F{"which is less loaded?"}',
        '    F --> G["send it to the lighter one"]',
        '    G --> H["max load ≈ mean + log log n / log 2"]',
        '    H -.- I["a bin passes height h only if BOTH samples were at h<br/>— the probability squares each level"]'
      ].join('\n')
    };
  }

  function orientationGraham() {
    return [
      '**List scheduling is the whole online algorithm: put the arriving job on the least-loaded ' +
        'machine.** Graham proved in 1966 that it is (2 − 1/m)-competitive, and no online rule ' +
        'beats it by much.',
      'The demo scores it against the EXACT optimum found by exhaustive assignment rather than ' +
        'against a lower bound.',
      'A ratio against a bound is an over-estimate, and reporting it as the ratio is how an ' +
        'algorithm ends up looking worse than it is.',
      '**The bound is tight and its instance is worth recognising.** Take m(m − 1) jobs of size ' +
        'one followed by one job of size m.',
      'The small jobs fill every machine evenly, and the big one has nowhere good to go. The demo ' +
        'measures exactly 2 − 1/m on it at every m.',
      'That shape, a burst of small requests and then one large one, is a real arrival pattern ' +
        'rather than a theoretical curiosity.',
      '**Sorting the jobs first gives 4/3 − 1/(3m), and sorting needs the future.** LPT is the ' +
        'same greedy rule with the jobs longest-first, and the gap between its bound and Graham’s ' +
        'is exactly what online costs.',
      'On the tight instance LPT is optimal, because placing the big job first removes the problem ' +
        'entirely.'
    ];
  }

  function orientationBalancing() {
    return [
      '**Random assignment has a maximum load about log n / log log n above the mean.** Throwing n ' +
        'balls into n bins uniformly leaves the busiest bin with several, not one, and the gap ' +
        'grows with n.',
      'That is the baseline any load balancer without feedback is measured against, and it is ' +
        'worse than most people expect.',
      '**Sampling two bins and taking the lighter collapses it to about log log n.** A bin only ' +
        'grows past height h when BOTH samples were already at h, so the probability squares at ' +
        'every level.',
      'Squaring at every level is what turns a logarithm into a log-logarithm. The demo measures ' +
        'the maximum at rising n against both predictions.',
      '**Three choices is not another exponential improvement.** Cubing instead of squaring buys a ' +
        'constant factor, so the benefit per extra sample falls off sharply after the second.',
      'That is why the technique is called the power of TWO choices, and why nobody samples ten.',
      '**Consistent hashing answers a different question and is measured on two axes.** It is not ' +
        'trying to balance load. It is trying to make the assignment stable when the machine set ' +
        'changes.',
      'The demo reports its imbalance, where it loses to random assignment, next to the fraction ' +
        'of keys that move when a machine is removed. Random assignment has no answer to the ' +
        'second at all.',
      '**Virtual nodes are the dial, and they trade memory for balance.** One ring point per ' +
        'machine leaves the busiest machine several times over the mean, and sixty-four points ' +
        'each brings it inside a quarter.',
      'The key-movement fraction stays at about 1/m throughout, because that is a property of the ' +
        'construction rather than of the number of points.'
    ];
  }

  function orientation() {
    return orientationGraham().concat(orientationBalancing());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — Graham’s bound attained, and the one-line change that beats it',
        markup: root.OnlineSchedulingTemplate.render()
      },
      diagram: diagram(),
      insight: '**Sample two backends and send the request to the less loaded one.** It is a ' +
        'one-line change to any random load balancer, and it needs no coordination, no shared ' +
        'state and no history. It collapses the tail of the load distribution from logarithmic to ' +
        'log-logarithmic. Nothing else in this milestone has that ratio of benefit to effort. ' +
        'There are two conditions to check. The load signal has to be roughly current, because a ' +
        'stale one makes every balancer converge on the same "idle" backend and is worse than ' +
        'random. And the sampling has to be two independent draws rather than two rounds of the ' +
        'same hash, which quietly turns it back into one choice.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.OnlineSchedulingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const scheduleFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.OnlineLab.schedulingStudy({ machines: Number(parts[0]), jobs: Number(parts[1]),
      instances: Number(parts[2]) });
  });

  const choicesFor = root.Helpers.memoise(function () {
    return root.OnlineLab.choicesStudy({});
  });

  const ringFor = root.Helpers.memoise(function () {
    return root.OnlineLab.ringStudy({});
  });

  function update(app) {
    const values = panel.values();
    const study = scheduleFor(values['osc-machines'] + '|' + values['osc-jobs'] + '|' +
      values['osc-instances']);
    const choices = choicesFor('');

    paintMetrics(study, choices);
    paintChart(app, choices);
    paintRatios(study);
    paintBalls(choices);
    paintRing(ringFor(''), Number(values['osc-replicas']));
  }

  function paintMetrics(study, choices) {
    const last = choices.rows[choices.rows.length - 1];

    root.MetricGrid.update({
      'osc-online': { value: root.Format.fixed(study.onlineWorst, 4),
        note: 'over ' + root.Format.exact(study.exactRows) + ' instances with an exact optimum; ' +
          'the bound is ' + root.Format.fixed(study.onlineBound, 4) },
      'osc-lpt': { value: root.Format.fixed(study.lptWorst, 4),
        note: 'the same rule with the future revealed; the bound is ' +
          root.Format.fixed(study.lptBound, 4) },
      'osc-trap': { value: root.Format.fixed(study.trap.onlineRatio, 4),
        note: root.Format.exact(study.trap.jobs) + ' jobs built to attain ' +
          root.Format.fixed(study.trap.bound, 4) + ' — and LPT solves it exactly' },
      'osc-choices': { value: root.Format.fixed(last.one, 2) + ' → ' +
        root.Format.fixed(last.two, 2),
        note: 'at ' + root.Format.exact(last.n) + ' bins, one sample against two' }
    });
  }

  function paintChart(app, choices) {
    const host = root.jQuery('#osc-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logX: true, yMin: 0,
      xLabel: 'bins (and balls), log scale', yLabel: 'maximum load',
      series: [
        { label: 'one choice', points: choices.rows.map(function (row) {
          return { x: row.n, y: row.one };
        }) },
        { label: 'log n / log log n', dashed: true, points: choices.rows.map(function (row) {
          return { x: row.n, y: row.predictedOne };
        }) },
        { label: 'two choices', points: choices.rows.map(function (row) {
          return { x: row.n, y: row.two };
        }) },
        { label: 'log log n / log 2', dashed: true, points: choices.rows.map(function (row) {
          return { x: row.n, y: row.predictedTwo };
        }) },
        { label: 'three choices', points: choices.rows.map(function (row) {
          return { x: row.n, y: row.three };
        }) }
      ]
    });

    const first = choices.rows[0];
    const last = choices.rows[choices.rows.length - 1];
    root.Helpers.setText('osc-chart-note',
      'n balls into n bins, averaged over ' + root.Format.exact(choices.trials) +
      ' runs at each size, so the mean load is exactly 1 in every column and the maximum is the ' +
      'whole story. One choice goes from ' + root.Format.fixed(first.one, 2) + ' at ' +
      root.Format.exact(first.n) + ' bins to ' + root.Format.fixed(last.one, 2) + ' at ' +
      root.Format.exact(last.n) + ' — a 256-fold increase in size and the maximum keeps ' +
      'climbing. Two choices goes from ' + root.Format.fixed(first.two, 2) + ' to ' +
      root.Format.fixed(last.two, 2) + ', which on a logarithmic x axis is nearly a flat line. ' +
      'Three choices is below two by a constant rather than by an exponent, which is why the ' +
      'result is named after the second sample.');
  }

  function paintRatios(study) {
    const rows = [
      { rule: 'list scheduling (online)', worst: study.onlineWorst, mean: study.onlineMean,
        bound: study.onlineBound, knows: 'the jobs one at a time, and nothing about the rest' },
      { rule: 'LPT (offline)', worst: study.lptWorst, mean: study.lptMean,
        bound: study.lptBound, knows: 'every job in advance, so it can sort them' }
    ];

    root.jQuery('#osc-ratios tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.rule + '</td><td class="mono">' +
        root.Format.fixed(row.worst, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.mean, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.bound, 4) + '</td><td class="mono">' +
        (row.worst <= row.bound + 1e-9 ? 'yes' : 'NO — the denominator is wrong') +
        '</td><td>' + row.knows + '</td></tr>';
    }).join('') + '<tr><td>the tight instance, online</td><td class="mono">' +
      root.Format.fixed(study.trap.onlineRatio, 4) + '</td><td class="mono">—</td>' +
      '<td class="mono">' + root.Format.fixed(study.trap.bound, 4) + '</td><td class="mono">' +
      'attained</td><td>' + study.trap.reason + '</td></tr>' +
      '<tr><td>the tight instance, LPT</td><td class="mono">' +
      root.Format.fixed(study.trap.lptRatio, 4) + '</td><td class="mono">—</td>' +
      '<td class="mono">' + root.Format.fixed(study.lptBound, 4) + '</td><td class="mono">yes' +
      '</td><td>placing the big job first removes the problem</td></tr>');

    root.Helpers.setText('osc-ratios-note',
      'Every ratio in the first two rows is against an EXACT optimum, found by trying every ' +
      'assignment — ' + root.Format.exact(study.exactRows) + ' of ' +
      root.Format.exact(study.instances) + ' instances were small enough for that, and rows ' +
      'scored against a lower bound are excluded rather than mixed in. That matters: an earlier ' +
      'version of this table mixed them and reported an LPT worst case of 1.3647 against a bound ' +
      'of 1.2500, which reads as a violated theorem and was a violated denominator. On random ' +
      'instances both rules are comfortably inside their bounds; the tight instance is the only ' +
      'place the online bound is reached, and it is reached exactly.');
  }

  function paintBalls(choices) {
    root.jQuery('#osc-balls tbody').html(choices.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td><td class="mono">' +
        root.Format.fixed(row.one, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.predictedOne, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.two, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.predictedTwo, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.three, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.one / row.two, 2) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('osc-balls-note',
      'The predictions are asymptotic and the measurements are at sizes a browser can run, so ' +
      'they do not coincide — the one-choice column runs above log n / log log n throughout, ' +
      'which is the constant the asymptotic drops. What the table is evidence for is the SHAPE: ' +
      'the one-choice column keeps rising with n and the two-choice column has nearly stopped. ' +
      'The last column is the ratio between them and it grows, which is what an exponential ' +
      'separation looks like when it is measured over a range rather than proved over all of them.');
  }

  function paintRing(study, highlight) {
    root.jQuery('#osc-ring tbody').html(study.rows.map(function (row) {
      const mark = row.replicas === highlight ? ' ●' : '';
      return '<tr><td class="mono">' + root.Format.exact(row.replicas) + mark +
        '</td><td class="mono">' + root.Format.exact(row.points) + '</td><td class="mono">' +
        root.Format.fixed(row.imbalance, 3) + '×</td><td class="mono">' +
        root.Format.fixed(row.spread, 2) + '×</td><td class="mono">' +
        root.Format.percent(row.movedOnRemoval, 2) + '</td><td class="mono">' +
        root.Format.percent(row.idealMove, 2) + '</td></tr>';
    }).join(''));

    const one = study.rows[0];
    const many = study.rows[study.rows.length - 1];
    root.Helpers.setText('osc-ring-note',
      'With one point per machine the busiest holds ' + root.Format.fixed(one.imbalance, 2) +
      ' times the mean and ' + root.Format.fixed(one.spread, 0) + ' times the quietest — far ' +
      'worse than random assignment, which is the standard criticism and is only half the ' +
      'picture. With ' + root.Format.exact(many.replicas) + ' points each the imbalance falls to ' +
      root.Format.fixed(many.imbalance, 3) + '. The last two columns are what the imbalance ' +
      'buys: removing a machine moves about ' + root.Format.percent(many.movedOnRemoval, 1) +
      ' of the keys, against an ideal of ' + root.Format.percent(many.idealMove, 1) + ', and ' +
      'random assignment cannot make that promise at all — rehashing modulo a changed machine ' +
      'count moves nearly everything.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
