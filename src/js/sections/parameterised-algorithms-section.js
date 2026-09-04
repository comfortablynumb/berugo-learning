/**
 * Section: exact exponential and parameterised algorithms.
 *
 * Three separable effects, measured separately, because a table that mixes
 * them cannot attribute anything. Branching on an arbitrary edge is exactly
 * 2^(k+1) − 1 nodes — the demo measures a base of 2.0030, which is the
 * textbook bound observed rather than quoted. Branching on a highest-degree
 * vertex instead measures 1.4991, just above the 1.4656 the literature proves.
 * And kernelisation is neither: it is a polynomial preprocess whose OUTPUT
 * SIZE does not depend on n at all, which the demo shows by growing the
 * instance fourteenfold and watching the kernel stay at fourteen edges.
 *
 * One measured result needs its context recorded because it looks like a bug.
 * The reduction rules make the search dramatically cheaper at every k, and
 * they also make the measured branching base LOOK worse — 3.0163 instead of
 * 2.0030. That is not a contradiction: the rules fire hardest at small k, so
 * they flatten the left end of the curve and the ratio between consecutive
 * points is inflated across the window. The base is a property of the tail and
 * the window is not the tail; both columns are shown for exactly that reason.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'parameterised-algorithms';
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
      title: 'Diagram — kernelisation, then search: two rules shrink the instance before anything branches',
      caption: 'Both rules are safe in the strong sense: they never change the answer. A vertex ' +
        'of degree above k must be in every cover of size k, because covering its edges one at ' +
        'a time would cost more than k — so committing it loses nothing. An isolated vertex is ' +
        'in no minimal cover, so deleting it loses nothing either. Applied to a fixed point, ' +
        'what survives has every degree at most k, so a cover of k vertices can reach at most k² ' +
        'edges: more than that and the answer is NO without any search at all. What is left is a ' +
        'graph on at most k² + k vertices whose size does not depend on n, which is the ' +
        'fixed-parameter promise as a preprocessing step rather than as an asymptotic.',
      definition: [
        'flowchart TD',
        '    A["instance: graph G, budget k"] --> B{"any vertex with degree > k?"}',
        '    B -- yes --> C["it is in EVERY cover of size k<br/>take it, k := k − 1"]',
        '    C --> B',
        '    B -- no --> D{"any isolated vertex?"}',
        '    D -- yes --> E["it is in NO minimal cover<br/>delete it, k unchanged"]',
        '    E --> B',
        '    D -- no --> F{"edges > k² ?"}',
        '    F -- yes --> G["answer NO<br/>no search needed"]',
        '    F -- no --> H["kernel: ≤ k² edges, ≤ k² + k vertices<br/>size independent of n"]',
        '    H --> I["branch and reduce on the kernel"]'
      ].join('\n')
    };
  }

  function orientationBranching() {
    return [
      '**"NP-hard" is a statement about a family of instances and says nothing about the one in ' +
        'front of you.** Parameterised complexity replaces it with a sharper question.',
      'Pick a number k that describes the part of the problem that is genuinely small: the size ' +
        'of the answer you would accept, the width of the structure, the number of exceptions.',
      'Then ask for f(k)·n^O(1). That is a promise about the SHAPE of the cost rather than a hope ' +
        'about the instance.',
      '**Branch and reduce on vertex cover is three lines and gives 2ᵏ.** Take any uncovered edge. ' +
        'One of its two endpoints is in the cover, so branch on both and drop k by one.',
      'The demo measures the node count as exactly 2^(k+1) − 1 at every k, giving a fitted base of ' +
        '2.0030. That is the bound observed rather than cited.',
      '**Branching on a high-degree vertex instead gives a base below two.** Either the vertex is ' +
        'in the cover, or every one of its neighbours is, and the second branch drops k by the ' +
        'degree rather than by one.',
      'The proved bound is 1.4656ᵏ and the demo measures 1.4991 on its instances, which is a ' +
        'heuristic branching rule landing just above a bound proved for a more careful one.',
      'Same problem, one different choice of what to branch on. At the largest budget the demo can ' +
        'still refute that is 4 095 nodes against 53.'
    ];
  }

  function orientationKernels() {
    return [
      '**Kernelisation is a different kind of win and it happens before any search.** Two safe ' +
        'rules run to a fixed point in polynomial time: commit any vertex of degree above k, and ' +
        'delete any isolated vertex.',
      'What survives has at most k² edges, or the answer is NO.',
      'The output size depends on k alone. The demo shows that by growing the instance from 46 ' +
        'vertices and 137 edges to 646 and 1 953, and watching the kernel go from 13 edges to 14.',
      '**A reduction rule has to be SAFE, and safety is a proof rather than a plausible ' +
        'argument.** "Commit the highest-degree vertex" is not safe, because the optimum need not ' +
        'contain it.',
      '"Commit any vertex of degree above k" is safe, and the proof is one line: covering its ' +
        'edges individually would need more than k vertices.',
      'A rule that is nearly safe returns a smaller cover for an instance that has none, and ' +
        'nothing downstream notices. That is why every rule here is checked against brute force.',
      '**The measured branching base and the proved one are different numbers and both are ' +
        'honest.** With the reduction rules on, the fitted base over the demo’s window reads ' +
        'higher than without them.',
      'The rules fire hardest at small k and flatten the left end of the curve. The node counts ' +
        'are lower everywhere, and the ratio between consecutive points is not.',
      'A single "measured base" column would have to pick one of those to report, so the demo ' +
        'reports both.',
      '**Treewidth is a second parameter, and it is the structure of the graph rather than the ' +
        'size of the answer.** A graph that is nearly a tree admits a dynamic program over a tree ' +
        'decomposition costing 2^(w+1) per bag.',
      'The demo builds a decomposition from a min-degree elimination ordering, which is a ' +
        'heuristic. So the width it reports is an upper bound, and the section says so rather ' +
        'than calling it the treewidth, which is itself NP-hard to compute.',
      '**The W-hierarchy is why not everything is fixed-parameter tractable.** Vertex cover ' +
        'parameterised by k is FPT, and clique parameterised by k is W[1]-hard.',
      'That means an f(k)·n^O(1) algorithm for clique would give one for everything in W[1], and ' +
        'is not expected.',
      'The parameter is not a free choice. It has to be one the problem is actually tractable in, ' +
        'and the hierarchy is the map of which ones are.'
    ];
  }

  function orientation() {
    return orientationBranching().concat(orientationKernels());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — five methods, two branching rules, and a kernel that stops growing',
        markup: root.ParameterisedAlgorithmsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Ask what the parameter is before asking how hard the problem is.** Every ' +
        'production instance of an NP-hard problem has something small in it. It might be the ' +
        'number of machines, the number of exceptions to the rule, the depth of the dependency ' +
        'graph, or the number of constraints that actually bind. The useful question is whether the cost can be ' +
        'pushed into that number and out of the data size. When it can, the algorithm scales with ' +
        'the data and not with the difficulty, which is the property you need in production. And ' +
        'run the kernelisation even when you do not intend to search. It is polynomial, it is ' +
        'safe, and on the demo’s instances it deletes ninety-nine per cent of the graph before ' +
        'anything expensive begins.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ParameterisedAlgorithmsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function graphKey(values) {
    return values['fpt-n'] + '|' + values['fpt-density'] + '|' + values['fpt-seed'];
  }

  const graphFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[0]);
    return root.NpLab.instanceGraph({ n: n, m: Math.round(n * Number(parts[1])),
      seed: Number(parts[2]) });
  });

  const methodsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('#');
    return root.NpLab.vertexCoverStudy({ graph: graphFor(parts[0]), k: Number(parts[1]) });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    return root.NpLab.branchingSweep({ graph: graphFor(key), from: 6, to: 18, step: 1 });
  });

  const kernelsFor = root.Helpers.memoise(function () {
    return root.NpLab.kernelSweep({ k: 12 });
  });

  const treewidthFor = root.Helpers.memoise(function () {
    return root.NpLab.treewidthStudy({ n: 22 });
  });

  function update(app) {
    const values = panel.values();
    const key = graphKey(values);
    const methods = methodsFor(key + '#' + values['fpt-k']);
    const sweep = sweepFor(key);

    paintMetrics(methods, sweep);
    paintChart(app, sweep);
    paintMethods(methods);
    paintBases(sweep);
    paintKernels(kernelsFor(''));
    paintTreewidth(treewidthFor(''));
  }

  function seriesNamed(sweep, rule, reduce) {
    return sweep.series.filter(function (entry) {
      return entry.rule === rule && entry.reduce === reduce;
    })[0];
  }

  function paintMetrics(methods, sweep) {
    const branch = methods.rows[3];
    const kernel = methods.rows[4];
    const degree = seriesNamed(sweep, 'degree', false);

    root.MetricGrid.update({
      'fpt-brute': { value: methods.brute === null ? 'too large'
        : root.Format.exact(methods.brute.examined),
        note: methods.brute === null ? 'brute force is only run below 22 vertices'
          : 'subsets examined; the exact minimum cover is ' +
            root.Format.exact(methods.brute.size) },
      'fpt-branch': { value: root.Format.exact(branch.nodes),
        note: 'degree branching with the reduction rules, answer ' +
          (branch.found ? 'YES' : 'NO') },
      'fpt-base': { value: degree.base === null ? '—' : root.Format.fixed(degree.base, 4),
        note: 'degree branching, no rules, over ' + root.Format.exact(degree.samples) +
          ' NO runs; the proved bound is 1.4656' },
      'fpt-kernel': { value: root.Format.exact(kernel.kernelVertices) + ' vertices, ' +
        root.Format.exact(kernel.kernelEdges) + ' edges',
        note: root.Format.exact(methods.kernel.forced.length) + ' vertices already forced into ' +
          'the cover by the rules' }
    });
  }

  function paintChart(app, sweep) {
    const host = root.jQuery('#fpt-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260, logY: true, yMin: 1,
      xLabel: 'budget k', yLabel: 'search nodes (log scale)',
      series: sweep.series.map(function (entry) {
        return { label: entry.label, dashed: entry.reduce,
          points: entry.runs.map(function (run) { return { x: run.k, y: run.nodes }; }) };
      })
    });

    const edge = seriesNamed(sweep, 'edge', false);
    const degree = seriesNamed(sweep, 'degree', false);
    const at = edge.runs.filter(function (run) { return !run.found && !run.exhausted; });
    const last = at[at.length - 1];
    const degreeAt = degree.runs.filter(function (run) { return run.k === last.k; })[0];

    root.Helpers.setText('fpt-chart-note',
      'Four curves, one problem. The solid lines are branching with no preprocessing: edge ' +
      'branching costs exactly 2^(k+1) − 1 nodes and reads as a straight line on a logarithmic ' +
      'axis, while degree branching is far below it. At k = ' + last.k + ' — the largest budget ' +
      'that is still a NO — edge branching spends ' + root.Format.exact(last.nodes) +
      ' nodes and degree branching spends ' + root.Format.exact(degreeAt.nodes) + '. The dashed ' +
      'lines are the same two rules with the reduction rules on, and they are lower everywhere. ' +
      'The curves flatten on the right because those k values are YES instances, where the ' +
      'search stops at the first answer it finds and the node count measures luck rather than ' +
      'the algorithm — which is why the fitted base below uses only the NO runs.');
  }

  function paintMethods(methods) {
    const rows = methods.rows.map(function (row) {
      return { method: row.method, found: row.found, size: row.size, valid: row.valid,
        nodes: row.nodes, exponent: exponentFor(row.method) };
    });
    if (methods.brute !== null) {
      rows.unshift({ method: 'brute force over every subset', found: methods.brute.found,
        size: methods.brute.size, valid: methods.brute.found, nodes: methods.brute.examined,
        exponent: 'n, the number of vertices' });
    }
    root.jQuery('#fpt-methods tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td class="mono">' +
        (row.found ? 'YES' : 'NO') + '</td><td class="mono">' +
        (row.size === null ? '—' : root.Format.exact(row.size)) + '</td><td class="mono">' +
        (row.valid === null ? '—' : (row.valid ? 'yes' : 'NO — BUG')) + '</td><td class="mono">' +
        root.Format.exact(row.nodes) + '</td><td>' + row.exponent + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fpt-methods-note',
      'Every row answers the same question and every row must give the same answer — the fourth ' +
      'column checks each returned cover against the graph itself, because a cover that misses ' +
      'an edge is smaller than a valid one and would flatter every other column. The last ' +
      'column is the point of the section: brute force is exponential in n, and everything ' +
      'below it is exponential in k. On this instance those are ' +
      (methods.brute === null ? 'different numbers' : root.Format.exact(methods.graph.n) +
        ' and ' + root.Format.exact(methods.k)) + ', and in production they are usually much ' +
      'further apart than that.');
  }

  function exponentFor(method) {
    if (method.indexOf('edge') === 0) return 'k, with base 2 — one endpoint or the other';
    if (method.indexOf('degree') === 0) return 'k, with base below 2 — the vertex or all its neighbours';
    return 'k, but only after a polynomial preprocess whose output does not depend on n';
  }

  function paintBases(sweep) {
    root.jQuery('#fpt-bases tbody').html(sweep.series.map(function (entry) {
      const no = entry.runs.filter(function (run) { return !run.found && !run.exhausted; });
      return '<tr><td class="mono">' + entry.rule + '</td><td class="mono">' +
        (entry.reduce ? 'on' : 'off') + '</td><td class="mono">' +
        (entry.base === null ? '—' : root.Format.fixed(entry.base, 4)) + '</td><td class="mono">' +
        root.Format.exact(entry.samples) + '</td><td class="mono">' +
        (no.length ? root.Format.exact(no[0].nodes) : '—') + '</td><td class="mono">' +
        (no.length ? root.Format.exact(no[no.length - 1].nodes) : '—') + '</td></tr>';
    }).join(''));

    const plainEdge = seriesNamed(sweep, 'edge', false);
    const ruledEdge = seriesNamed(sweep, 'edge', true);
    root.Helpers.setText('fpt-bases-note',
      'Read the third and the last columns together, because on their own they disagree. Edge ' +
      'branching with no rules fits a base of ' + root.Format.fixed(plainEdge.base, 4) +
      ' — that is 2 to four decimal places, and it is the textbook bound measured rather than ' +
      'quoted. Turn the reduction rules on and the fitted base rises to ' +
      root.Format.fixed(ruledEdge.base, 4) + ' while every node count falls: the rules fire ' +
      'hardest at small k, so they flatten the left end of the window and inflate the ratio ' +
      'between consecutive points. The base is a property of the tail; this window is not the ' +
      'tail. Reporting only the fitted base would say preprocessing made things worse, and ' +
      'reporting only the node counts would hide why the base moved.');
  }

  function paintKernels(kernels) {
    root.jQuery('#fpt-kernels tbody').html(kernels.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td><td class="mono">' +
        root.Format.exact(row.edges) + '</td><td class="mono">' +
        root.Format.exact(row.kernelVertices) + '</td><td class="mono">' +
        root.Format.exact(row.kernelEdges) + '</td><td class="mono">' +
        root.Format.exact(row.forced) + '</td><td class="mono">' +
        root.Format.fixed(row.shrink, 1) + '×</td><td class="mono">' +
        root.Format.exact(row.bound) + '</td></tr>';
    }).join(''));

    const first = kernels.rows[0];
    const last = kernels.rows[kernels.rows.length - 1];
    root.Helpers.setText('fpt-kernels-note',
      'Six hubs joined to a growing crowd of leaves, plus fourteen edges scattered among the ' +
      'leaves, at k = ' + root.Format.exact(kernels.k) + '. The instance grows from ' +
      root.Format.exact(first.n) + ' vertices and ' + root.Format.exact(first.edges) +
      ' edges to ' + root.Format.exact(last.n) + ' and ' + root.Format.exact(last.edges) +
      ' — fourteen times the edges — and the kernel goes from ' +
      root.Format.exact(first.kernelEdges) + ' edges to ' +
      root.Format.exact(last.kernelEdges) + '. That is the whole claim of kernelisation, ' +
      'measured: the output size is bounded by a function of k and does not depend on n. The ' +
      'hubs are committed by the high-degree rule, their leaves become isolated and are deleted, ' +
      'and what is left is the scatter that was never near a hub.');
  }

  function paintTreewidth(study) {
    root.jQuery('#fpt-treewidth tbody').html(study.rows.map(function (row) {
      return '<tr><td class="mono">' + row.density + '</td><td class="mono">' +
        root.Format.exact(row.edges) + '</td><td class="mono">' + row.width +
        '</td><td class="mono">' + root.Format.exact(row.bags) + '</td><td class="mono">' +
        root.Format.exact(row.states) + '</td><td class="mono">' + root.Format.exact(row.size) +
        '</td><td class="mono">' + root.Format.exact(row.searchNodes) + '</td></tr>';
    }).join(''));

    const sparse = study.rows[0];
    const dense = study.rows[study.rows.length - 1];
    root.Helpers.setText('fpt-treewidth-note',
      'A completely different parameter on the same problem. The dynamic program over a tree ' +
      'decomposition costs 2^(w+1) states per bag, so it is exponential in the WIDTH and linear ' +
      'in the number of bags. On the sparse graph the width is ' + sparse.width + ' and a bag ' +
      'holds ' + root.Format.exact(sparse.states) + ' states; on the dense one the width is ' +
      dense.width + ' and a bag holds ' + root.Format.exact(dense.states) + '. The width here is ' +
      'found by a min-degree elimination heuristic, so it is an UPPER BOUND on the treewidth ' +
      'rather than the treewidth — computing that exactly is itself NP-hard, and calling the ' +
      'heuristic’s answer "the treewidth" is the standard overclaim. The last column is branch ' +
      'and reduce on the same graphs, for scale: neither parameter dominates, and which one to ' +
      'use is a property of your instances rather than of the problem.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
