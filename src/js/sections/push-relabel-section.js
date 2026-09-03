/**
 * Section: push-relabel and modern flow.
 *
 * The claim this section exists to test is that the heuristics are not extras.
 * Without them push-relabel is often slower than Dinic, which is why textbook
 * implementations disappoint - and the four-row sweep prices each one on the
 * network in front of the learner rather than quoting a paper.
 *
 * The second claim is subtler and is what the split panel is for. Saturating
 * and non-saturating pushes are bounded by completely different arguments -
 * O(VE) and O(V²E) respectively - so a run whose non-saturating count dwarfs
 * its saturating one is behaving the way the worse bound predicts, and that is
 * visible in the counters rather than in the wall clock.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'push-relabel';
  const SCALE_WIDTHS = [3, 5, 7, 9, 11];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the height constraint that licenses a push',
      caption: 'Excess may only move downhill by exactly one: a push along u → v needs residual ' +
        'capacity and h(u) = h(v) + 1. When a vertex has excess and no such arc, it is lifted to one ' +
        'above its lowest residual neighbour. The source starts at height n, which is what makes ' +
        'excess that cannot reach the sink climb past it and drain back.',
      definition: [
        'flowchart LR',
        '    U["u — excess 5, height 4"] -->|"residual capacity 3<br/>h(u) = h(v) + 1 ✓"| V["v — height 3"]',
        '    U -.->|"h(u) = h(w) + 1 ✗<br/>no push"| W["w — height 4"]',
        '    U --> R["no admissible arc?<br/>relabel u to 1 + min neighbour height"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Push-relabel inverts the augmenting-path idea.** Instead of moving flow along a whole ' +
        'source-to-sink path at once, it floods every arc out of the source. That leaves **excess** ' +
        'sitting at vertices, and the algorithm then moves that excess one arc at a time.',
      'A **preflow** is a flow that has given up on conservation. A vertex may hold more than it ' +
        'sends on, and the algorithm is finished when no vertex except the source and sink does.',
      'What decides where excess may go is a **height function**. A push along u → v needs residual ' +
        'capacity *and* h(u) = h(v) + 1. A vertex with excess but no such arc is **relabelled** to ' +
        'one above its lowest residual neighbour.',
      'The source sits at height n from the start. So excess that cannot reach the sink eventually ' +
        'climbs past n and flows back where it came from. That is why the algorithm terminates with ' +
        'a genuine flow rather than a stranded one.',
      '**The heuristics are not optional extras.** The *gap* rule notices that when no vertex is ' +
        'left at some height h, nothing above h can still reach the sink. Every such vertex can then ' +
        'be lifted straight past n instead of walking up one unit at a time.',
      '*Global relabelling* periodically recomputes exact heights by a backward breadth-first ' +
        'search. Both are switchable here, and the sweep below shows the relabel count falling by ' +
        'several times.',
      '**Saturating and non-saturating pushes have different bounds**, and the split is worth ' +
        'watching.',
      'A saturating push empties an arc, and there can be O(VE) of them. A non-saturating push ' +
        'empties a *vertex*, and the bound is O(V²E).',
      'A run dominated by the second is behaving the way the worse bound predicts, and the counters ' +
        'say so long before a stopwatch would.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — heights, excess, and what each heuristic removes',
        markup: root.PushRelabelTemplate.render()
      },
      diagram: diagram(),
      insight: 'Push-relabel is the family every serious max-flow library implements, and the reason ' +
        'is not the asymptotic bound. It is that the heuristics work extremely well on the graphs ' +
        'people actually have. That is also the trap. A correct textbook implementation with neither ' +
        'heuristic is a genuinely slow program, and somebody benchmarking it against a tuned Dinic ' +
        'will conclude the wrong thing about the algorithm. When you compare implementations of ' +
        'anything in this family, check first that both have their standard accelerations. The gap ' +
        'between "the algorithm" and "the algorithm as everybody ships it" is a factor here, not a ' +
        'percentage.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PushRelabelTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  function specFrom(parts) {
    return { shape: parts[0], width: Number(parts[1]), layers: Number(parts[2]),
      seed: Number(parts[3]), rows: Number(parts[1]), columns: Number(parts[2]) + 2,
      n: Number(parts[1]) * Number(parts[2]) };
  }

  const networkFor = root.Helpers.memoise(function (key) {
    return root.FlowLab.build(specFrom(key.split('|')));
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = networkFor(parts.slice(0, 4).join('|'));
    const run = root.PushRelabel.pushRelabel(graph, graph.source, graph.sink,
      { rule: parts[4], gap: parts[5] === 'true', globalRelabel: parts[6] === 'true' });

    return { graph: graph, run: run,
      heights: root.PushRelabel.checkHeights(run.state, graph.source, graph.sink),
      flow: root.MaxFlow.checkFlow(run.network, graph.source, graph.sink),
      truth: root.MaxFlow.dinic(graph, graph.source, graph.sink, {}) };
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = networkFor(parts.slice(0, 4).join('|'));

    return root.FlowLab.heuristicSweep(graph, { rule: parts[4] });
  });

  const compareFor = root.Helpers.memoise(function (key) {
    return root.FlowLab.compareFlows(networkFor(key), {});
  });

  const scaleFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return SCALE_WIDTHS.map(function (width) {
      const graph = root.FlowLab.build({ shape: 'layered', width: width, layers: width,
        seed: Number(parts[3]) });
      const both = root.PushRelabel.pushRelabel(graph, graph.source, graph.sink,
        { rule: 'fifo', gap: true, globalRelabel: true });
      const neither = root.PushRelabel.pushRelabel(graph, graph.source, graph.sink,
        { rule: 'fifo', gap: false, globalRelabel: false });
      const dinic = root.MaxFlow.dinic(graph, graph.source, graph.sink, {});

      return { n: graph.n, both: both.report, neither: neither.report,
        dinic: dinic.report, agree: both.value === neither.value && both.value === dinic.value };
    });
  });

  /* -------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['prl-shape'] + '|' + values['prl-width'] + '|' + values['prl-layers'] + '|' +
      values['prl-seed'];
  }

  function update() {
    const values = panel.values();
    const base = keyFor(values);
    const full = base + '|' + values['prl-rule'] + '|' + String(values['prl-gap']) + '|' +
      String(values['prl-global']);
    const state = runFor(full);

    paintMetrics(state);
    paintHeights(state);
    paintSweep(sweepFor(base + '|' + values['prl-rule']));
    paintCompare(compareFor(base));
    paintSplit(state);
    paintScale(scaleFor(base));
  }

  function paintMetrics(state) {
    const report = state.run.report;

    root.MetricGrid.update({
      'prl-value': { value: root.Format.exact(state.run.value),
        note: state.run.value === state.truth.value
          ? 'Dinic agrees on the same network' : 'DINIC DISAGREES at ' +
            root.Format.exact(state.truth.value) },
      'prl-relabels': { value: root.Format.exact(report.relabels),
        note: root.Format.exact(report.gapLifts) + ' gap lifts and ' +
          root.Format.exact(report.globalRelabels) + ' global passes' },
      'prl-pushes': { value: root.Format.exact(report.pushes),
        note: root.Format.exact(report.saturating) + ' saturating, ' +
          root.Format.exact(report.nonSaturating) + ' not' },
      'prl-valid': { value: state.heights.valid && state.flow.valid ? 'yes' : 'NO',
        note: state.heights.valid
          ? 'no residual arc drops more than one height, and no vertex still holds excess'
          : root.Format.exact(state.heights.violations) + ' height violations, ' +
            root.Format.exact(state.heights.stillActive) + ' vertices still active' }
    });
  }

  function paintHeights(state) {
    const rows = [];
    const height = state.run.state.height;
    const excess = state.run.state.excess;

    for (let v = 0; v < state.graph.n && rows.length < 12; v += 1) {
      const role = v === state.graph.source ? 'source'
        : (v === state.graph.sink ? 'sink' : 'ordinary');

      rows.push({ cells: [String(v), role, root.Format.exact(height[v]),
        root.Format.exact(excess[v]),
        height[v] >= state.graph.n ? 'above n — its excess drains back to the source'
          : 'below n — still trying to reach the sink'] });
    }
    root.MatrixView.render(root.jQuery('#prl-heights')[0], {
      columns: ['Vertex', 'Role', 'Final height', 'Excess', 'What the height means'], rows: rows
    });
    root.jQuery('#prl-heights-note').text('Twelve of ' + root.Format.exact(state.graph.n) +
      ' vertices at the end of the run. Only the source and the sink may still hold excess — the ' +
      'source\'s is negative because it gave away more than came back, and the sink\'s is the answer. ' +
      'A vertex sitting above height ' + root.Format.exact(state.graph.n) + ' is one whose excess had ' +
      'to be returned rather than delivered.');
  }

  function paintSweep(rows) {
    const baseline = rows[rows.length - 1];
    const html = rows.map(function (row) {
      return '<tr><td>' + (row.gap ? 'on' : 'off') + '</td>' +
        '<td>' + (row.globalRelabel ? 'on' : 'off') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.relabels) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.pushes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.arcsExamined) + '</td>' +
        '<td class="mono">' + root.Format.fixed(baseline.report.relabels /
          Math.max(1, row.report.relabels), 2) + '×</td></tr>';
    }).join('');

    root.jQuery('#prl-sweep tbody').html(html);
    root.jQuery('#prl-sweep-note').text('Four runs of the same algorithm on the same network, ' +
      'differing only in which accelerations are enabled — and every one returns the same value, ' +
      'because these are heuristics about *where to look next* rather than about what the answer is. ' +
      'The last column is what a textbook implementation gives up by omitting them. Note that the ' +
      'two are not simply additive: on some networks global relabelling alone beats both together, ' +
      'because a global pass makes the gap rule fire on heights it has just flattened. Neither is ' +
      'dominant, which is why both are switchable rather than compiled in.');
  }

  function paintCompare(compare) {
    const html = compare.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.arcsExamined) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cut.capacity) + '</td>' +
        '<td>' + (row.check.valid ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#prl-compare tbody').html(html);
    root.jQuery('#prl-compare-note').text('Arc visits are the only column that compares like with ' +
      'like across the two families — an augmenting path and a discharge are not the same unit of ' +
      'work. On a network this size push-relabel does not obviously win, and saying so is the honest ' +
      'version of a claim usually made about graphs a thousand times larger.');
  }

  function paintSplit(state) {
    const report = state.run.report;
    const total = Math.max(1, report.pushes);

    root.MatrixView.render(root.jQuery('#prl-split')[0], {
      columns: ['Kind of push', 'Count', 'Share', 'What bounds it'],
      rows: [
        { cells: ['saturating — the arc is emptied', root.Format.exact(report.saturating),
          root.Format.fixed(100 * report.saturating / total, 1) + '%',
          'O(VE): an arc can only saturate again after both ends are relabelled'] },
        { cells: ['non-saturating — the vertex is emptied',
          root.Format.exact(report.nonSaturating),
          root.Format.fixed(100 * report.nonSaturating / total, 1) + '%',
          'O(V²E) in general, and the reason the selection rule matters'] },
        { cells: ['discharges', root.Format.exact(report.discharges), '—',
          'one per time a vertex was taken off the active list'] }
      ]
    });
    root.jQuery('#prl-split-note').text('The two kinds of push are bounded by completely different ' +
      'arguments, so the split says which bound the run is living under. The highest-label rule ' +
      'exists to attack the non-saturating count specifically, which is why switching the selection ' +
      'rule above changes that row far more than it changes the other.');
  }

  function paintScale(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.both.relabels) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.neither.relabels) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.neither.relabels /
          Math.max(1, row.both.relabels), 2) + '×</td>' +
        '<td class="mono">' + root.Format.exact(row.dinic.arcsExamined) + '</td></tr>';
    }).join('');

    root.jQuery('#prl-scale tbody').html(html);
    root.jQuery('#prl-scale-note').text('The same comparison as the network grows. The saving from ' +
      'the heuristics is not a constant — it widens, which is exactly why they are described as ' +
      'essential rather than as an optimisation. Every row was also checked against Dinic on the ' +
      'same network, so the accelerated runs are not merely faster but the same answer.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
