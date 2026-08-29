/**
 * Section: hardness in practice.
 *
 * Two measurements and they are the same measurement at different scales. The
 * phase transition is a statement about a DISTRIBUTION of instances: sweep the
 * clause-to-variable ratio and both the satisfiable fraction and the median
 * solve cost do something abrupt near 4.27. The runtime distribution is a
 * statement about a distribution of RUNS on one instance: the median is small,
 * the tail is not, and the mean is dominated by runs nobody will wait for.
 *
 * Both have the same moral and it is the reason this section is next to the
 * hedged-request material in M57: when a cost distribution is heavy-tailed,
 * the fix is not a faster algorithm but a cutoff, and the cutoff has to be
 * chosen by measurement because too short is far worse than none at all.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hardness-in-practice';
  let panel = null;
  let chart = null;

  const STRUCTURE = [
    { property: 'community structure', random: 'none — every clause draws three variables uniformly',
      industrial: 'strong; variables cluster into modules that barely interact',
      gets: 'a conflict inside one module produces a learned clause that is local, so it prunes without being general' },
    { property: 'backdoor set', random: 'no small set of variables decides the rest',
      industrial: 'often a few dozen variables whose assignment makes the rest propagate',
      gets: 'once the backdoor is guessed the remaining millions of variables are decided by propagation, in linear time' },
    { property: 'clause length distribution', random: 'every clause is exactly three literals',
      industrial: 'mostly binary and ternary, from encoded implications',
      gets: 'binary clauses propagate immediately, so most of the formula is effectively an implication graph' },
    { property: 'symmetry', random: 'none to speak of',
      industrial: 'large groups of interchangeable objects — machines, slots, replicas',
      gets: 'nothing, unless it is broken; unbroken symmetry multiplies the search by a factorial' },
    { property: 'the answer', random: 'balanced on the threshold, by construction',
      industrial: 'usually satisfiable, and usually near a solution the encoder had in mind',
      gets: 'a good branching heuristic finds it early; UNSAT industrial instances are much harder than SAT ones' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the three regimes, and why the cost peaks between them',
      caption: 'Below the threshold a random formula is under-constrained: solutions are ' +
        'plentiful and almost any greedy descent falls into one, so the cost is low and the ' +
        'answer is YES. Above it the formula is over-constrained: contradictions appear within a ' +
        'few decisions, propagation reaches them quickly, and the cost is low again with the ' +
        'answer NO. At the crossover the formula has few solutions and no early contradiction — ' +
        'the search must go deep before learning anything — and that is where the median cost ' +
        'peaks. The peak sits slightly ABOVE the satisfiability crossover at these sizes, which ' +
        'the demo measures rather than assumes; the two coincide only in the limit.',
      definition: [
        'flowchart LR',
        '    A["ratio ≪ 4.27<br/>under-constrained<br/>many solutions"] -->|"greedy descent finds one"| A2["cheap · YES"]',
        '    B["ratio ≈ 4.27<br/>few solutions,<br/>no early contradiction"] -->|"search must go deep"| B2["expensive · either"]',
        '    C["ratio ≫ 4.27<br/>over-constrained<br/>contradictions everywhere"] -->|"propagation finds one<br/>fast"| C2["cheap · NO"]',
        '    A --- B --- C'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Worst case and typical case are different questions and NP-completeness answers only ' +
        'the first.** A hardness result says some instances are hard; it says nothing about ' +
        'the ones you have. Industrial SAT instances with millions of variables are solved in ' +
        'seconds every day, and randomly generated instances with fifty variables can be ' +
        'genuinely difficult. Structure is the difference, and structure is not in the ' +
        'complexity class.',
      '**Random 3-SAT has a phase transition, and it is a property of the distribution rather ' +
        'than of any instance.** Below a clause-to-variable ratio of about 4.27 almost every ' +
        'formula is satisfiable; above it almost none is; and at the crossover both the ' +
        'satisfiable fraction and the solve cost change abruptly. The demo sweeps the ratio ' +
        'with many seeds per point, because a single instance per ratio measures noise.',
      '**The cost peaks at the crossover for a reason that is easy to state.** Far below it, ' +
        'solutions are plentiful and any descent finds one. Far above it, contradictions ' +
        'appear within a few decisions and propagation reaches them immediately. At the ' +
        'crossover there are few solutions AND no early contradiction, so the search has to go ' +
        'deep before it learns anything at all.',
      '**Report the median, not the mean.** At the peak the cost distribution is heavy-tailed, ' +
        'so the mean is dominated by a handful of runs far above everything else and moves ' +
        'around between experiments. The demo prints the median, the upper quartile, the mean ' +
        'and the worst side by side precisely so the gap between them is visible.',
      '**Generating genuinely hard instances is its own skill.** Random at the threshold is ' +
        'one recipe; the pigeonhole family from 20.3 is another, and it is hard for a ' +
        'structural reason rather than a statistical one. "I tried a few instances and it was ' +
        'fast" is not evidence about a solver, because the instances people reach for first ' +
        'are exactly the under-constrained ones.',
      '**A backdoor is a small set of variables whose assignment makes the rest propagate.** ' +
        'Industrial instances usually have one of a few dozen variables even when they have ' +
        'millions in total; random instances at the threshold do not. That single structural ' +
        'fact explains most of the gap between "solves in seconds" and "runs for a week", and ' +
        'it is why encodings that preserve structure beat encodings that flatten it.',
      '**Runtimes of combinatorial search are heavy-tailed, and the tail is not a bug.** The ' +
        'same stochastic solver on the same instance with different seeds produces a ' +
        'distribution whose worst run is orders of magnitude above its median. An unlucky seed ' +
        'wanders into a region with no short path out, and it has no way to know.',
      '**Restarts convert an unbounded tail into a bounded expectation, and the cutoff has to ' +
        'be measured.** Abandon a run at a cutoff and start again with a fresh seed: the ' +
        'expected total is then geometric rather than heavy-tailed. Too long a cutoff does ' +
        'nothing; too short a cutoff is far worse than no restarts at all, because every ' +
        'attempt is killed just before it would have finished. The demo measures all of that ' +
        'and the bad setting is in the table on purpose.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the phase transition, and the runtime distribution restarts fix',
        markup: root.HardnessInPracticeTemplate.render()
      },
      diagram: diagram(),
      insight: '**When a cost distribution is heavy-tailed the fix is a cutoff, not a faster ' +
        'algorithm — and this is the same argument as hedged requests.** A p99 that is fifty ' +
        'times the median means most of your latency budget is being spent by a small number of ' +
        'unlucky runs, and shaving 20% off the median does nothing about them. Abandoning and ' +
        'retrying does, because a fresh attempt is a fresh draw from the distribution rather ' +
        'than a continuation of a bad one. The cutoff is the whole design and it has to come ' +
        'from the measured distribution: the demo’s shortest cutoff makes the mean four times ' +
        'WORSE than no restarts at all, which is the failure mode of picking a timeout that ' +
        'feels responsive rather than one the data supports.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HardnessInPracticeTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const phaseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.HeuristicLab.phaseTransition({ variables: Number(parts[0]),
      instances: Number(parts[1]) });
  });

  const restartFor = root.Helpers.memoise(function (key) {
    return root.HeuristicLab.restartStudy({ noise: Number(key), trials: 40 });
  });

  function update(app) {
    const values = panel.values();
    const phase = phaseFor(values['hip-variables'] + '|' + values['hip-instances']);
    const restarts = restartFor(values['hip-noise']);

    paintMetrics(phase, restarts);
    paintChart(app, phase);
    paintPhase(phase);
    paintRestarts(restarts);
    paintStructure();
  }

  function peakOf(phase) {
    return phase.rows.reduce(function (best, row) {
      return row.median > best.median ? row : best;
    }, phase.rows[0]);
  }

  /** The ratio at which the satisfiable fraction crosses one half, by linear
   *  interpolation between the two rows that straddle it. */
  function crossingOf(phase) {
    for (let i = 1; i < phase.rows.length; i += 1) {
      const above = phase.rows[i - 1];
      const below = phase.rows[i];
      if (above.satisfiableFraction < 0.5 || below.satisfiableFraction >= 0.5) continue;
      const span = above.satisfiableFraction - below.satisfiableFraction;
      const share = (above.satisfiableFraction - 0.5) / span;
      return above.ratio + share * (below.ratio - above.ratio);
    }
    return null;
  }

  function bestCutoff(restarts) {
    return restarts.rows.reduce(function (best, row) {
      return row.mean < best.mean ? row : best;
    }, restarts.rows[0]);
  }

  function paintMetrics(phase, restarts) {
    const peak = peakOf(phase);
    const crossing = crossingOf(phase);
    const best = bestCutoff(restarts);

    root.MetricGrid.update({
      'hip-peak': { value: root.Format.fixed(peak.ratio, 2),
        note: root.Format.exact(peak.median) + ' median nodes there, against ' +
          root.Format.exact(phase.rows[0].median) + ' at ratio ' +
          root.Format.fixed(phase.rows[0].ratio, 1) },
      'hip-crossing': { value: crossing === null ? '—' : root.Format.fixed(crossing, 2),
        note: 'the asymptotic value is 4.27; at ' + root.Format.exact(phase.variables) +
          ' variables the crossover has not settled there yet' },
      'hip-tail': { value: root.Format.fixed(restarts.plain.spread, 1) + '×',
        note: 'worst ' + root.Format.exact(restarts.plain.worst) + ' flips against a median of ' +
          root.Format.exact(restarts.plain.median) },
      'hip-restart': { value: root.Format.exact(best.cutoff) + ' flips',
        note: 'mean ' + root.Format.exact(Math.round(best.mean)) + ' against ' +
          root.Format.exact(Math.round(restarts.plain.mean)) + ' with no restarts' }
    });
  }

  function paintChart(app, phase) {
    const host = root.jQuery('#hip-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const peak = peakOf(phase);
    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260, logY: true, yMin: 1,
      xLabel: 'clauses per variable', yLabel: 'nodes (log scale) · fraction × 1000',
      markers: [{ x: peak.ratio, label: 'peak median cost' }],
      series: [
        { label: 'median search nodes', points: phase.rows.map(function (row) {
          return { x: row.ratio, y: row.median };
        }) },
        { label: 'worst of the batch', points: phase.rows.map(function (row) {
          return { x: row.ratio, y: row.worst };
        }) },
        { label: 'satisfiable fraction × 1000', dashed: true,
          points: phase.rows.map(function (row) {
            return { x: row.ratio, y: Math.max(1, row.satisfiableFraction * 1000) };
          }) }
      ]
    });

    root.Helpers.setText('hip-chart-note', chartNote(phase, peak));
  }

  function chartNote(phase, peak) {
    const crossing = crossingOf(phase);

    return 'Each point is ' + root.Format.exact(phase.instances) + ' independent formulas on ' +
      root.Format.exact(phase.variables) + ' variables. The dashed curve is the satisfiable ' +
      'fraction, scaled by a thousand so it shares the logarithmic axis; it falls from every ' +
      'instance satisfiable to none across a narrow band. The solid curves are the search cost, ' +
      'and they rise and then fall — the peak is at ratio ' + root.Format.fixed(peak.ratio, 2) +
      ' with a median of ' + root.Format.exact(peak.median) + ' nodes' +
      (crossing === null ? '' : ', slightly above the satisfiability crossover at ' +
        root.Format.fixed(crossing, 2)) + '. Both ends are cheap for opposite reasons: on the ' +
      'left there are so many solutions that anything finds one, and on the right a ' +
      'contradiction turns up within a few decisions. Only the middle is hard, and that band is ' +
      'where anybody generating "random test instances" should be aiming if they want the test ' +
      'to mean anything.';
  }

  function paintPhase(phase) {
    root.jQuery('#hip-phase tbody').html(phase.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.ratio, 2) + '</td><td class="mono">' +
        root.Format.exact(row.clauses) + '</td><td class="mono">' +
        root.Format.percent(row.satisfiableFraction, 1) + '</td><td class="mono">' +
        root.Format.exact(row.median) + '</td><td class="mono">' +
        root.Format.exact(row.quartile) + '</td><td class="mono">' +
        root.Format.fixed(row.mean, 1) + '</td><td class="mono">' +
        root.Format.exact(row.worst) + '</td><td class="mono">' +
        root.Format.fixed(row.worst / Math.max(1, row.median), 1) + '×</td></tr>';
    }).join(''));

    const worstSpread = phase.rows.reduce(function (best, row) {
      return row.worst / Math.max(1, row.median) > best.worst / Math.max(1, best.median)
        ? row : best;
    }, phase.rows[0]);
    root.Helpers.setText('hip-phase-note',
      'Read the median column against the mean column. They agree far from the threshold and ' +
      'diverge near it, because near the threshold the distribution grows a tail: the worst run ' +
      'at ratio ' + root.Format.fixed(worstSpread.ratio, 2) + ' is ' +
      root.Format.fixed(worstSpread.worst / Math.max(1, worstSpread.median), 1) +
      ' times its median. That is why the literature plots the median — a mean over a ' +
      'heavy-tailed sample is an estimate of something that moves between experiments, and ' +
      'quoting it as "the solve time" is how a benchmark becomes irreproducible without anybody ' +
      'doing anything wrong.');
  }

  function paintRestarts(restarts) {
    const rows = [{ label: 'no restarts', data: restarts.plain, cutoff: null }].concat(
      restarts.rows.map(function (row) {
        return { label: 'restart every ' + root.Format.exact(row.cutoff) + ' flips', data: row,
          cutoff: row.cutoff };
      }));

    root.jQuery('#hip-restarts tbody').html(rows.map(function (entry) {
      const data = entry.data;
      return '<tr><td>' + entry.label + '</td><td class="mono">' +
        root.Format.exact(data.solved) + ' / ' + root.Format.exact(data.trials) +
        '</td><td class="mono">' + root.Format.exact(data.median) + '</td><td class="mono">' +
        root.Format.fixed(data.mean, 1) + '</td><td class="mono">' +
        root.Format.exact(data.p90) + '</td><td class="mono">' +
        root.Format.exact(data.worst) + '</td><td class="mono">' +
        root.Format.fixed(data.spread, 1) + '×</td><td class="mono">' +
        (entry.cutoff === null ? '—' : root.Format.exact(data.restarts)) + '</td></tr>';
    }).join(''));

    const best = bestCutoff(restarts);
    const worst = restarts.rows.reduce(function (bad, row) {
      return row.mean > bad.mean ? row : bad;
    }, restarts.rows[0]);
    root.Helpers.setText('hip-restarts-note',
      'One instance, ' + root.Format.exact(restarts.trials) + ' seeds, and a stochastic local ' +
      'search that cannot report UNSAT — so a run that has not finished tells you nothing about ' +
      'whether to keep waiting. Without restarts the median is ' +
      root.Format.exact(restarts.plain.median) + ' flips and the worst is ' +
      root.Format.exact(restarts.plain.worst) + '. A cutoff of ' +
      root.Format.exact(best.cutoff) + ' brings the mean from ' +
      root.Format.fixed(restarts.plain.mean, 0) + ' to ' + root.Format.fixed(best.mean, 0) +
      ' and the worst from ' + root.Format.exact(restarts.plain.worst) + ' to ' +
      root.Format.exact(best.worst) + ', while barely moving the median — the tail is what got ' +
      'cut. Now look at the ' + root.Format.exact(worst.cutoff) + '-flip row: it takes ' +
      root.Format.exact(worst.restarts) + ' restarts and its mean is ' +
      root.Format.fixed(worst.mean / restarts.plain.mean, 1) + ' times WORSE than no restarts ' +
      'at all, because every attempt is abandoned just short of finishing. Too short a cutoff is ' +
      'not a mild mistake, and that is why this row is in the table.');
  }

  function paintStructure() {
    root.jQuery('#hip-structure tbody').html(STRUCTURE.map(function (row) {
      return '<tr><td>' + row.property + '</td><td>' + row.random + '</td><td>' +
        row.industrial + '</td><td>' + row.gets + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hip-structure-note',
      'Nothing in this table is about size. A random instance at the threshold with fifty ' +
      'variables can be harder than an industrial instance with five million, and every row here ' +
      'is a reason why. The practical consequence runs backwards through the pipeline: an ' +
      'encoding that preserves the structure of the original problem — keeping related variables ' +
      'adjacent, keeping implications binary, breaking the symmetry the domain obviously has — ' +
      'produces an instance a solver can exploit, and an encoding that flattens it produces one ' +
      'that looks random. That is the same claim section 20.7 makes, arrived at from the other ' +
      'direction.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
