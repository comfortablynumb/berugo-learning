/**
 * Section: maximum flow.
 *
 * One claim, made six ways and checked three: every algorithm here returns the
 * same value, that value equals the capacity of the cut its own residual graph
 * defines, and the flow satisfies capacity and conservation at every edge and
 * vertex. A flow algorithm fails by returning a plausible number, so the
 * agreement column is the section rather than a footnote.
 *
 * The back-edge panel ships the wrong algorithm deliberately. Path filling
 * without a residual twin is what everybody writes first, and on the classic
 * four-vertex instance it returns 1 999 against 2 000 - a shortfall of one
 * unit out of two thousand, which is exactly the kind of error that survives
 * every test written against small examples.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'maximum-flow';
  const CAPACITY_STEPS = [1, 4, 16, 64, 256];
  let panel = null;
  let view = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (view) view(); });
  }

  function diagram() {
    return {
      title: 'Diagram — the residual arc pair',
      caption: 'Pushing f along an arc leaves capacity − f forward and adds f backward. The backward ' +
        'arc does not exist in the input at all: it is the permission to undo, and it is the only ' +
        'reason a greedy sequence of augmenting paths reaches the maximum rather than getting stuck.',
      definition: [
        'flowchart LR',
        '    U["u"] -->|"capacity 7, flow 4<br/>residual forward 3"| V["v"]',
        '    V -.->|"residual backward 4<br/>(does not exist in the<br/>input)"| U',
        '    V --> W["a later path may take the backward arc<br/>and reroute the earlier 4 units"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A **flow** assigns a number to every arc subject to two rules: nothing exceeds its capacity, ' +
          'and everything that enters a vertex leaves it again — except at the source and the sink. ' +
          'The maximum flow is the largest total that can leave the source, and every algorithm here ' +
          'finds it the same way: repeatedly find a path from source to sink with capacity to spare, ' +
          'push as much as the tightest arc allows, and repeat.',
        '**The residual graph is the whole idea.** Pushing f units along an arc leaves `capacity − f` ' +
          'available forward *and adds f available backward*. That backward arc is not in the input; ' +
          'it is the permission for a later path to route flow back out of a vertex an earlier path ' +
          'filled badly. Without it, path filling is not a slower algorithm but a wrong one — the ' +
          'panel below runs it and gets 1 999 where the answer is 2 000.',
        'The four augmenting-path algorithms differ only in *which* path they take. **Ford-Fulkerson** ' +
          'takes any; its path count depends on the order the arcs happen to be in and on irrational ' +
          'capacities it need not terminate at all. **Edmonds-Karp** always takes the shortest, which ' +
          'bounds the count at O(VE) independently of the capacities. **Dinic** builds a level graph ' +
          'and saturates a whole blocking flow per phase. **Capacity scaling** only considers arcs ' +
          'with at least delta left, halving delta each round, so every path found is fat.',
        '**The cut is the proof.** When no augmenting path remains, the vertices still reachable from ' +
          'the source in the residual graph form one side of a cut, every original arc leaving that ' +
          'side is saturated, and the cut\'s capacity equals the flow. That is max-flow min-cut, and ' +
          'it is checked on every run here — a value that does not equal its own cut capacity is a ' +
          'bug the value alone would never reveal.'
      ],
      demo: {
        title: 'Interactive demo — six algorithms, one network, and the residual beside it',
        markup: root.MaximumFlowTemplate.render()
      },
      diagram: diagram(),
      insight: 'When you meet a problem that looks like flow, the thing to get right is not the ' +
        'algorithm — any of these four is a page of code and they all agree — it is the *model*. ' +
        'Which vertices, which capacities, and which two terminals? Almost every real use of maximum ' +
        'flow in an engineering setting is a modelling exercise followed by a library call, and the ' +
        'next two sections are entirely about what the cut then means. Learn the residual argument ' +
        'well enough to trust the library, and spend the rest of your attention on the reduction.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MaximumFlowTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- fixtures */

  function specFrom(parts) {
    return { shape: parts[0], width: Number(parts[1]), layers: Number(parts[2]),
      capacity: Number(parts[3]), seed: Number(parts[4]),
      rows: Number(parts[1]), columns: Number(parts[2]) + 2,
      n: Number(parts[1]) * Number(parts[2]), m: Number(parts[1]) * Number(parts[2]) * 3 };
  }

  const networkFor = root.Helpers.memoise(function (key) {
    return root.FlowLab.build(specFrom(key.split('|')));
  });

  const compareFor = root.Helpers.memoise(function (key) {
    return root.FlowLab.compareFlows(networkFor(key), {});
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = networkFor(parts.slice(0, 5).join('|'));
    return { graph: graph, run: root.FlowLab.singleRun(graph, { algorithm: parts[5] }) };
  });

  const backEdgeFor = root.Helpers.memoise(function () {
    const graph = root.MaxFlow.backEdgeExample(1000);
    const greedy = root.MaxFlow.greedyNoResidual(graph, graph.source, graph.sink, {});
    const proper = root.MaxFlow.fordFulkerson(graph, graph.source, graph.sink, {});
    let short = 0;
    let worst = 0;

    for (let seed = 1; seed <= 20; seed += 1) {
      const network = root.FlowLab.build({ shape: 'layered', seed: seed });
      const rough = root.MaxFlow.greedyNoResidual(network, network.source, network.sink, {}).value;
      const truth = root.MaxFlow.dinic(network, network.source, network.sink, {}).value;

      if (rough >= truth) continue;
      short += 1;
      worst = Math.max(worst, 100 * (truth - rough) / truth);
    }
    return { graph: graph, greedy: greedy, proper: proper, short: short, worst: worst };
  });

  const scalingFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return CAPACITY_STEPS.map(function (capacity) {
      const graph = root.FlowLab.build({ shape: parts[0], width: Number(parts[1]),
        layers: Number(parts[2]), capacity: capacity, seed: Number(parts[4]) });
      const source = graph.source;
      const sink = graph.sink;

      return { capacity: capacity,
        ford: root.MaxFlow.fordFulkerson(graph, source, sink, {}),
        karp: root.MaxFlow.edmondsKarp(graph, source, sink, {}),
        dinic: root.MaxFlow.dinic(graph, source, sink, {}),
        scaling: root.MaxFlow.capacityScaling(graph, source, sink, {}) };
    });
  });

  /* -------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['mfl-shape'] + '|' + values['mfl-width'] + '|' + values['mfl-layers'] + '|' +
      values['mfl-capacity'] + '|' + values['mfl-seed'];
  }

  function update() {
    const values = panel.values();
    const base = keyFor(values);
    const state = runFor(base + '|' + values['mfl-pick']);
    const compare = compareFor(base);

    paintMetrics(state, compare);
    paintMap(state);
    paintResidual(state);
    paintCompare(compare);
    paintBackEdge(backEdgeFor('fixed'));
    paintScaling(scalingFor(base));
  }

  function paintMetrics(state, compare) {
    root.MetricGrid.update({
      'mfl-value': { value: root.Format.exact(state.run.value),
        note: 'the cut crossing ' + root.Format.exact(state.run.cut.edges.length) +
          ' arcs has capacity ' + root.Format.exact(state.run.cut.capacity) },
      'mfl-paths': { value: root.Format.exact(state.run.report.augmentingPaths),
        note: state.run.report.phases > 0
          ? root.Format.exact(state.run.report.phases) + ' blocking-flow phases'
          : root.Format.exact(state.run.report.arcsExamined) + ' arc visits' },
      'mfl-agree': { value: compare.agree ? 'yes' : 'NO',
        note: compare.agree ? 'six algorithms, one value, every cut tight'
          : root.Format.exact(compare.disagreements) + ' value disagreements and ' +
            root.Format.exact(compare.cutMismatches) + ' loose cuts' },
      'mfl-valid': { value: state.run.check.valid ? 'yes' : 'NO',
        note: state.run.check.valid
          ? 'no arc over capacity, no vertex out of balance'
          : root.Format.exact(state.run.check.imbalanced) + ' vertices out of balance' }
    });
  }

  function paintMap(state) {
    view = function () { drawMap(state); };
    view();
  }

  function drawMap(state) {
    const host = root.jQuery('#mfl-map')[0];

    if (!host) return;

    root.FlowView.draw({ host: host, graph: state.graph, flows: state.run.flows,
      cut: state.run.cut.edges, cutSide: state.run.cut.side,
      width: host.clientWidth || 620, height: 320 });
    root.jQuery('#mfl-map-note').text('Source and sink are the larger nodes; an arc carrying its full ' +
      'capacity is drawn strongly and one carrying nothing is faint. The highlighted arcs are the ' +
      'minimum cut — every one of them is saturated, and their capacities sum to ' +
      root.Format.exact(state.run.cut.capacity) + ', which is exactly the flow. That equality is the ' +
      'max-flow min-cut theorem, checked rather than quoted.');
  }

  function paintResidual(state) {
    const residual = root.FlowView.residualEdges(state.run.flows);
    const back = residual.filter(function (arc) { return arc.kind === 'back'; });
    const rows = residual.slice(0, 12).map(function (arc) {
      return { cells: [arc.from + ' → ' + arc.to, arc.kind,
        root.Format.exact(arc.capacity),
        arc.kind === 'back' ? 'exists only because flow was pushed the other way'
          : 'what is left of the original arc'] };
    });

    root.MatrixView.render(root.jQuery('#mfl-residual')[0], {
      columns: ['Arc', 'Kind', 'Residual capacity', 'Where it came from'], rows: rows
    });
    root.jQuery('#mfl-residual-note').text('Twelve of ' + root.Format.exact(residual.length) +
      ' residual arcs, of which ' + root.Format.exact(back.length) + ' are backward arcs that appear ' +
      'in no input file anywhere. They are the algorithm\'s permission to change its mind, and the ' +
      'minimum cut is read off this graph rather than the original one: everything still reachable ' +
      'from the source here is on the source side.');
  }

  function paintCompare(compare) {
    const html = compare.rows.map(function (row) {
      const work = row.report.augmentingPaths !== undefined && row.report.augmentingPaths > 0
        ? root.Format.exact(row.report.augmentingPaths) + ' paths' +
          (row.report.phases ? ' / ' + root.Format.exact(row.report.phases) + ' phases' : '')
        : root.Format.exact(row.report.relabels) + ' relabels / ' +
          root.Format.exact(row.report.pushes) + ' pushes';

      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.value) + '</td>' +
        '<td class="mono">' + work + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.arcsExamined) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cut.capacity) + '</td>' +
        '<td>' + (row.check.valid ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mfl-compare tbody').html(html);
    root.jQuery('#mfl-compare-note').text('Same value in every row, same cut capacity in every row, ' +
      'and a valid flow in every row — three separate checks, because a flow algorithm fails by ' +
      'returning a well-formed wrong answer. What differs is the work: the arc-visit column is where ' +
      'the algorithms actually separate, and on a network this small the ranking is not the one the ' +
      'complexity table predicts.');
  }

  function paintBackEdge(state) {
    root.MatrixView.render(root.jQuery('#mfl-backedge')[0], {
      columns: ['Approach', 'Value', 'Paths found', 'Correct?'],
      rows: [
        { cells: ['path filling with no back edge', root.Format.exact(state.greedy.value),
          root.Format.exact(state.greedy.report.augmentingPaths), 'NO — one unit short'] },
        { cells: ['the same search with residual arcs', root.Format.exact(state.proper.value),
          root.Format.exact(state.proper.report.augmentingPaths), 'yes'] },
        { cells: ['random layered networks', 'short on ' + root.Format.exact(state.short) + ' of 20',
          'worst shortfall ' + root.Format.fixed(state.worst, 1) + '%',
          'no arrangement needed'] }
      ]
    });
    root.jQuery('#mfl-backedge-note').text('Four vertices: two arcs of 1 000 out of the source, two ' +
      'into the sink, and one arc of capacity 1 across the middle. A depth-first search takes the ' +
      'middle arc on its first path, and without a backward arc those 999 units on each side can ' +
      'never be rerouted — so the run stops at 1 999 and reports nothing unusual. The third row is ' +
      'the same failure on networks nobody arranged.');
  }

  function paintScaling(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.capacity) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.dinic.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.ford.report.augmentingPaths) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.karp.report.augmentingPaths) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.dinic.report.phases) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.scaling.report.scalingRounds) + '</td></tr>';
    }).join('');

    root.jQuery('#mfl-scaling tbody').html(html);
    root.jQuery('#mfl-scaling-note').text('The same network with the capacities scaled up. Dinic\'s ' +
      'phase count is bounded by the graph rather than by the numbers in it, and on a layered network ' +
      'it is 1 at every capacity — every source-to-sink path has the same length, so one blocking ' +
      'flow saturates a cut and the level graph never deepens. The scaling rounds are log2 of the ' +
      'largest capacity by construction. Ford-Fulkerson is the row to watch: its path count has no ' +
      'bound mentioning only the graph, which is why the classic pathological example uses two ' +
      'enormous capacities and one small one rather than random ones.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
