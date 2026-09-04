/**
 * Section: random-contraction.
 *
 * The section is arranged around one distinction that is easy to lose and
 * changes the whole reading of the bound. "Karger's algorithm finds a minimum
 * cut with probability 2/(n(n-1))" is a statement about ONE specific minimum
 * cut, not about finding any of them. On a graph with a unique minimum cut the
 * two questions coincide and the measured rate sits far above the bound - the
 * demo measures 0.35 against 0.015 on two cliques. On a cycle, which has
 * exactly n(n-1)/2 minimum cuts, finding some minimum cut is essentially
 * certain while finding a nominated one sits at the bound within a whisker.
 *
 * That second reading is also the proof of the corollary that a graph has at
 * most n(n-1)/2 minimum cuts, which is a fact about graphs obtained from an
 * algorithm - and one of the tidiest arguments in the subject.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'random-contraction';
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
      title: 'Diagram — one contraction, and what survives it',
      caption: 'Contracting an edge merges its endpoints into one supernode. Edges that ran ' +
        'between the two endpoints become self-loops and are discarded; every other edge ' +
        'survives, keeping its multiplicity, so an edge that joined both endpoints to the same ' +
        'outside vertex becomes two parallel edges. Those parallel edges are the whole point — ' +
        'they are what makes a heavily connected region unlikely to be split later, and dropping ' +
        'them silently is the bug that turns the algorithm into a coin flip.',
      definition: [
        'flowchart LR',
        '    subgraph before["before: contract (u, v)"]',
        '      U["u"] --- V["v"]',
        '      U --- X["x"]',
        '      V --- X',
        '      V --- Y["y"]',
        '    end',
        '    subgraph after["after"]',
        '      UV["uv"] --- X2["x"]',
        '      UV --- X2',
        '      UV --- Y2["y"]',
        '    end',
        '    before --> after'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Contraction is the whole algorithm and it has no cleverness in it.** Pick a uniformly ' +
        'random surviving edge, merge its endpoints into one supernode, discard the self-loops ' +
        'that creates, repeat until two supernodes remain.',
      'Whatever edges still cross between them are a cut.',
      'There is no search, no residual graph and no augmenting path. It finds the global minimum ' +
        'cut with probability at least 2/(n(n−1)).',
      '**The analysis is one inequality repeated.** If the minimum cut has size k, every vertex has ' +
        'degree at least k, so the graph has at least nk/2 edges.',
      'The chance of contracting one of the k cut edges is therefore at most 2/n. Surviving all ' +
        'n−2 contractions gives a telescoping product that collapses to exactly 2/(n(n−1)).',
      'The step everybody skips is *why* the degree bound holds: a vertex of degree below k would ' +
        'be a smaller cut on its own.',
      '**A success probability of 1/n² is not the same as a failure.** Repeat the run ' +
        'n(n−1)/2 · ln(1/δ) times and the failure probability is below δ.',
      'Each run is O(n²), so the total is O(n⁴ log n) for a global minimum cut without a single ' +
        'max-flow computation.',
      'The cost model is expected total work, and a cheap run with a small success probability can ' +
        'beat an expensive run with certainty.',
      '**The bound is about ONE cut, and reporting the wrong event makes it look pessimistic.** On ' +
        'the two-clique graph, which has a single minimum cut, the demo measures a success rate ' +
        'more than twenty times the bound.',
      'On a cycle, which has exactly n(n−1)/2 minimum cuts, "found a minimum cut" is essentially ' +
        'certain. "Found this particular one" sits within a percent of 2/(n(n−1)).',
      'Same algorithm, same bound, two different questions.',
      '**Karger–Stein spends the repetition where it matters.** The early contractions are almost ' +
        'always safe and the last few are where cuts die.',
      'So contracting down to n/√2 and recursing twice keeps each stage’s survival probability ' +
        'near 1/2.',
      'The recurrence T(n) = 2T(n/√2) + O(n²) gives O(n² log n) per run, and the success ' +
        'probability rises from Ω(1/n²) to Ω(1/log n).'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — contraction, repetition and the two ways to read the bound',
        markup: root.RandomContractionTemplate.render()
      },
      diagram: diagram(),
      insight: '**The reflex "1/n² is too small to be useful" is the mistake this section ' +
        'exists to remove.** What matters is the product of the failure probability and the cost ' +
        'of a run, and a run here is quadratic. The demo shows the corollary too, and it is worth ' +
        'more than the algorithm in practice. The events "this run returns cut C" are disjoint and ' +
        'each has probability at least 2/(n(n−1)), so a graph can have at most n(n−1)/2 minimum ' +
        'cuts. That is a fact about graphs, proved by running an algorithm on them. The cycle ' +
        'attains it exactly, and the demo counts all of them. **When an algorithm’s analysis ' +
        'produces a counting bound as a side effect, the bound is usually the more reusable half.**'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RandomContractionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.kargerStudy({ family: parts[0],
      clusterSize: parts[0] === 'cycle' ? Number(parts[1]) : Number(parts[1]) / 2,
      bridges: Number(parts[2]), trials: Number(parts[3]), pickBy: parts[4] });
  });

  function keyOf(values) {
    return values['krg-family'] + '|' + values['krg-size'] + '|' + values['krg-bridges'] +
      '|' + values['krg-trials'] + '|' + values['krg-rule'];
  }

  function update(app) {
    const values = panel.values();
    const study = studyFor(keyOf(values));
    const other = studyFor(values['krg-family'] + '|' + values['krg-size'] + '|' +
      values['krg-bridges'] + '|' + values['krg-trials'] + '|' +
      (values['krg-rule'] === 'edge' ? 'pair' : 'edge'));

    paintMetrics(study);
    paintCanvas(study);
    paintTrace(study);
    paintChart(app, study);
    paintRules(study, other, values['krg-rule']);
    paintCost(study);
  }

  function paintMetrics(study) {
    root.MetricGrid.update({
      'krg-cut': { value: root.Format.exact(study.exact.cut),
        note: root.Format.exact(study.exact.optimalCuts) + ' distinct partitions attain it, ' +
          'from ' + root.Format.exact(study.exact.partitionsExamined) + ' examined' },
      'krg-rate': { value: root.Format.percent(study.run.exactCutRate, 2),
        note: 'the bound is ' + root.Format.percent(study.run.predictedRate, 2) +
          ' = 2/(n(n−1))' },
      'krg-any': { value: root.Format.percent(study.run.empiricalRate, 2),
        note: root.Format.exact(study.run.distinctCutsFound) + ' distinct minimum cuts turned up' },
      'krg-stein': { value: root.Format.exact(study.stein.cut),
        note: root.Format.exact(study.stein.contractions) + ' contractions across ' +
          root.Format.exact(study.stein.calls) + ' recursive calls' }
    });
  }

  function paintCanvas(study) {
    const host = root.jQuery('#krg-canvas')[0];
    if (!host) return;
    const graph = study.graph;
    const side = study.exact.side;
    const crossing = new Set();

    graph.edges.forEach(function (edge, id) {
      if (side[edge.from] !== side[edge.to]) crossing.add(id);
    });
    root.GraphView.draw({
      host: host, graph: graph, height: 300,
      positions: root.GraphView.circularLayout(graph.n, host.clientWidth || 560, 300),
      edgeClass: root.GraphView.classBySet(crossing, 'cut'),
      nodeClass: function (v) { return side[v] === 1 ? 'frontier' : null; }
    });
    root.Helpers.setText('krg-canvas-note',
      'The highlighted edges are the ' + root.Format.exact(study.exact.cut) +
      ' that the enumeration oracle says form the minimum cut, and the highlighted vertices are ' +
      'one side of it. This is the answer contraction is trying to reach by accident — it never ' +
      'looks at the cut, it only merges edges, and the cut is whatever is left when two ' +
      'supernodes remain.');
  }

  function paintTrace(study) {
    const run = root.Karger.contract(study.graph,
      { rng: root.Random.seeded(17), pickBy: 'edge' });
    root.jQuery('#krg-trace tbody').html(run.trace.map(function (step, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td><td class="mono">' +
        step.merged[1] + ' → ' + step.merged[0] + '</td><td class="mono">' +
        step.remaining + '</td><td class="mono">' + step.edges + '</td></tr>';
    }).join(''));

    const last = run.trace[run.trace.length - 1];
    root.Helpers.setText('krg-trace-note',
      'One run, from a fixed seed so the trace does not change under you. The edge column falls ' +
      'faster than the supernode column because every merge also destroys the self-loops it ' +
      'creates: ' + root.Format.exact(study.graph.edges.length) + ' edges become ' +
      root.Format.exact(last.edges) + ' after ' + root.Format.exact(run.contractions) +
      ' contractions. This run ended at a cut of ' + root.Format.exact(run.cut) +
      ' against the true minimum of ' + root.Format.exact(study.exact.cut) +
      (run.cut === study.exact.cut ? ' — it succeeded.' : ' — it failed, which is the normal case.'));
  }

  function paintChart(app, study) {
    const host = root.jQuery('#krg-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const points = [];
    const predicted = [];
    let successes = 0;
    study.run.history.forEach(function (entry, index) {
      if (entry.cut === study.exact.cut) successes += 1;
      if ((index + 1) % Math.max(1, Math.floor(study.run.trials / 60)) !== 0) return;
      points.push({ x: index + 1, y: successes / (index + 1) });
      predicted.push({ x: index + 1, y: study.run.predictedRate });
    });

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240,
      xLabel: 'runs so far', yLabel: 'fraction of runs finding a minimum cut',
      yMin: 0,
      series: [
        { label: 'measured success rate', points: points },
        { label: 'the 2/(n(n−1)) bound', dashed: true, points: predicted }
      ],
      legendHost: root.jQuery('#krg-legend')[0]
    });

    root.Helpers.setText('krg-chart-note',
      'The measured rate settles at ' + root.Format.percent(study.run.empiricalRate, 2) +
      ' against a bound of ' + root.Format.percent(study.run.predictedRate, 2) +
      '. On the two-clique graph that gap is real slack — the bound is a worst case over all ' +
      'graphs and this one is easy. On the cycle the two lines nearly touch once you ask about ' +
      'a NOMINATED cut rather than any cut, which is the metric tile above; switch the graph and ' +
      'watch the two tiles separate.');
  }

  function paintRules(study, other, current) {
    const rows = current === 'edge'
      ? [{ label: 'uniform over edges (the algorithm)', run: study.run },
        { label: 'uniform over supernodes (the mistake)', run: other.run }]
      : [{ label: 'uniform over edges (the algorithm)', run: other.run },
        { label: 'uniform over supernodes (the mistake)', run: study.run }];

    root.jQuery('#krg-rules tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.exact(row.run.successes) + ' / ' + root.Format.exact(row.run.trials) +
        '</td><td class="mono">' + root.Format.percent(row.run.empiricalRate, 2) +
        '</td><td class="mono">' + root.Format.percent(row.run.predictedRate, 2) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('krg-rules-note',
      'Both rules contract an edge and both look uniform if you describe them in a sentence. ' +
      'Choosing a supernode first and then one of its edges is not the same distribution: a ' +
      'vertex with two edges and a vertex with twenty are equally likely to be chosen, so the ' +
      'sparse side of a cut is contracted far more often than the analysis allows, and the ' +
      'measured rate drops from ' + root.Format.percent(rows[0].run.empiricalRate, 2) + ' to ' +
      root.Format.percent(rows[1].run.empiricalRate, 2) + '. The proof needs the degree bound, ' +
      'and the degree bound is a statement about edges.');
  }

  function paintCost(study) {
    const n = study.graph.n;
    const perRun = n - 2;
    const rate = Math.max(study.run.empiricalRate, 1 / study.run.trials);
    const runs = Math.ceil(Math.log(0.01) / Math.log(1 - rate));
    const boundRuns = root.Karger.trialsFor(n, 0.01);
    const rows = [
      { label: 'plain contraction, measured rate', rate: rate, runs: runs, per: perRun },
      { label: 'plain contraction, at the proven bound', rate: study.run.predictedRate,
        runs: boundRuns, per: perRun },
      { label: 'Karger–Stein, one call', rate: study.stein.predictedRate, runs: 1,
        per: study.stein.contractions }
    ];
    root.jQuery('#krg-cost tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.percent(row.rate, 2) + '</td><td class="mono">' +
        root.Format.exact(row.runs) + '</td><td class="mono">' + root.Format.exact(row.per) +
        '</td><td class="mono">' + root.Format.exact(row.runs * row.per) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('krg-cost-note',
      'The right-hand column is the number that decides whether the algorithm is usable, and it ' +
      'is a product of two things people quote separately. At the proven bound this graph needs ' +
      root.Format.exact(boundRuns) + ' runs of ' + root.Format.exact(perRun) +
      ' contractions each to reach 99% confidence; at the measured rate it needs ' +
      root.Format.exact(runs) + '. Karger–Stein does more work inside one call — ' +
      root.Format.exact(study.stein.contractions) + ' contractions across ' +
      root.Format.exact(study.stein.calls) + ' recursive calls — and buys a success probability ' +
      'that falls like 1/log n instead of 1/n², which is what makes the total O(n² log² n) ' +
      'rather than O(n⁴ log n).');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
