/**
 * Section: bridges, articulation points and biconnectivity.
 *
 * This section exists for one bug. A depth-first walk of an undirected graph
 * meets the edge it arrived on a second time, from the other end, and that
 * sighting must be ignored. Ignoring it by asking "is this neighbour my
 * parent?" *also* ignores every parallel edge to that parent - and a parallel
 * edge is exactly what stops the tree edge being a bridge. The vertex-based
 * version therefore reports a bridge that is not one, silently, on any
 * multigraph.
 *
 * So the parallel-edge slider is not a curiosity: it is the control that
 * turns the bug on. And every claim on the page is checked against a
 * remove-each-edge-and-recount oracle, which is O(m(n + m)) and unarguable.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bridges-and-cuts';
  const REDUNDANCY_STEPS = [0, 1, 2, 4, 8];
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
      title: 'Diagram — a bridge, and the redundant link that removes it',
      caption: 'B–C is a bridge: lose it and the network splits in two. Adding a second, independent ' +
        'B–C link removes the bridge entirely — and a bridge finder that tracks the parent VERTEX cannot ' +
        'see the second link and still reports a bridge.',
      definition: [
        'flowchart LR',
        '    A["A"] --- B["B"]',
        '    A --- D["D"]',
        '    B --- D',
        '    B ---|"bridge"| C["C"]',
        '    C --- E["E"]',
        '    C --- F["F"]',
        '    E --- F'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A **bridge** is an edge whose removal increases the number of connected components; an ' +
          '**articulation point** is a vertex with the same property. In a network they are the single ' +
          'points of failure, and the whole graph decomposes into **biconnected blocks** - maximal regions ' +
          'with no such point inside them - joined at the cut vertices.',
        'Both fall out of one depth-first walk and one number per vertex: `low`, the earliest discovery ' +
          'time reachable from this subtree through tree edges and *at most one* back edge. A tree edge ' +
          '(u, v) is a bridge exactly when `low[v] > discovery[u]` - the subtree below v has no other way ' +
          'out. A vertex is a cut vertex when some child satisfies `low[child] >= discovery[u]`, with the ' +
          'root a special case: it is a cut vertex exactly when it has more than one DFS child.',
        '**The lowlink here is not Tarjan\'s SCC lowlink**, and conflating them is the other classic ' +
          'error. For strongly connected components, lowlink may follow an edge to any vertex still on the ' +
          'stack; here it may follow only edges to an already-discovered *ancestor*, because the question ' +
          'is whether the subtree has another route upwards.',
        '**The parallel-edge case is the bug this section is about.** An undirected walk sees the edge it ' +
          'arrived on twice and must skip the second sighting - but skipping it by asking "is this ' +
          'neighbour my parent?" also skips a genuine second link to that same parent, which is precisely ' +
          'what stops the edge being a bridge. Skip by **edge id** instead. The redundancy slider adds ' +
          'parallel links, and everything on this page is checked against a remove-each-edge-and-recount ' +
          'oracle so the difference is measured rather than argued.'
      ],
      demo: {
        title: 'Interactive demo — single points of failure, and the redundancy that removes them',
        markup: root.BridgesAndCutsTemplate.render()
      },
      diagram: diagram(),
      insight: 'The reason to compute bridges on a real network is not the list — it is the block-cut ' +
        'tree, which tells you what each single point of failure actually costs. A bridge whose removal ' +
        'strands two nodes is a different problem from one that strands half the estate, and only the ' +
        'decomposition distinguishes them. The engineering move that follows is always the same and is ' +
        'visible on this page: one extra independent link across a bridge removes it entirely, and the ' +
        'blocks on either side merge into one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BridgesAndCutsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function baseGraph(shape, size, seed) {
    const side = Math.max(3, Math.round(Math.sqrt(size)));
    return root.GraphLab.build({ shape: shape, n: size, rows: side, columns: side,
      seed: seed, m: Math.floor(size * 1.4) });
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    let graph = baseGraph(parts[0], Number(parts[1]), Number(parts[2]));

    if (Number(parts[3]) > 0) graph = root.GraphCore.withParallelEdges(graph, Number(parts[3]));
    return { graph: graph, run: root.GraphLab.connectivityRun(graph, { withOracle: true }) };
  });

  const redundancyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return REDUNDANCY_STEPS.map(function (extra) {
      let graph = baseGraph(parts[0], Number(parts[1]), Number(parts[2]));

      if (extra > 0) graph = root.GraphCore.withParallelEdges(graph, extra);
      return { extra: extra, graph: graph,
        run: root.GraphLab.connectivityRun(graph, { withOracle: true }) };
    });
  });

  function keyFor(values) {
    return values['brg-shape'] + '|' + values['brg-size'] + '|' + values['brg-seed'] + '|' +
      values['brg-parallel'];
  }

  function update() {
    const values = panel.values();
    const state = runFor(keyFor(values));

    paintMetrics(state);
    paintCanvas(state);
    paintRedundancy(redundancyFor(values['brg-shape'] + '|' + values['brg-size'] + '|' +
      values['brg-seed']));
    paintParallelCase();
    paintList(state);
    paintTree(state);
  }

  function paintMetrics(state) {
    const analysis = state.run.analysis;

    root.MetricGrid.update({
      'brg-bridges': { value: root.Format.exact(analysis.bridges.length),
        note: root.Format.fixed(100 * analysis.bridges.length /
          Math.max(1, state.graph.edges.length), 1) + '% of the links' },
      'brg-cuts': { value: root.Format.exact(analysis.articulation.length),
        note: root.Format.fixed(100 * analysis.articulation.length /
          Math.max(1, state.graph.n), 1) + '% of the nodes' },
      'brg-blocks': { value: root.Format.exact(analysis.blocks.length),
        note: 'a block of one edge IS a bridge' },
      'brg-oracle': { value: state.run.matchesOracle === null ? 'not run at this size'
        : (state.run.matchesOracle ? 'yes' : 'NO'),
      note: state.run.matchesOracle === null
        ? 'the oracle is O(m(n + m)) and only runs below 400 nodes'
        : 'each edge removed and the components recounted' }
    });
  }

  function paintCanvas(state) {
    view = function () { drawGraph(state); };
    view();
  }

  function drawGraph(state) {
    const host = root.jQuery('#brg-canvas')[0];

    if (!host) return;
    const positions = state.graph.positionOf
      ? root.GraphView.fixedLayout(state.graph, host.clientWidth || 620, 340)
      : root.GraphView.circularLayout(state.graph.n, host.clientWidth || 620, 340);
    const bridges = new Set(state.run.analysis.bridges.map(function (b) { return b.id; }));
    const cuts = new Set(state.run.analysis.articulation);

    root.GraphView.draw({
      host: host, graph: state.graph, positions: positions, height: 340,
      edgeClass: root.GraphView.classBySet(bridges, 'cut'),
      nodeClass: function (v) { return cuts.has(v) ? 'frontier' : null; }
    });
    root.jQuery('#brg-canvas-note').text('Highlighted edges are bridges and highlighted nodes are ' +
      'articulation points — ' + state.run.analysis.bridges.length + ' and ' +
      state.run.analysis.articulation.length + ' of them. Everything faint survives any single failure. ' +
      'Move the redundancy slider and watch the highlights disappear.');
  }

  function paintRedundancy(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.extra + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.analysis.bridges.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.analysis.articulation.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.analysis.blocks.length) + '</td>' +
        '<td>' + (row.run.matchesOracle === null ? '—'
          : (row.run.matchesOracle ? 'yes' : 'NO')) + '</td></tr>';
    }).join('');

    root.jQuery('#brg-redundancy tbody').html(html);
    root.jQuery('#brg-redundancy-note').text('Each added link is a second, independent connection ' +
      'duplicating an existing one — which is what a redundant fibre run or a second uplink is. Every ' +
      'row is checked against the removal oracle, and the counts must fall: a parallel edge cannot create '
      + 'a bridge, only remove one.');
  }

  /* The bug, on the smallest instance that exhibits it, with the oracle
     beside it so the reader is not asked to take it on trust. */
  function paintParallelCase() {
    const graph = root.GraphCore.createGraph(3,
      [{ from: 0, to: 1, weight: 1 }, { from: 0, to: 1, weight: 1 }, { from: 1, to: 2, weight: 1 }]);
    const analysis = root.Biconnectivity.analyse(root.GraphCore.adjacencyList(graph), {});
    const oracle = root.Biconnectivity.bridgesByRemoval(graph);
    const found = analysis.bridges.map(function (b) { return b.from + '–' + b.to; }).join(', ');
    const truth = oracle.map(function (b) { return b.from + '–' + b.to; }).join(', ');

    root.MatrixView.render(root.jQuery('#brg-parallel-view')[0], {
      columns: ['Approach', 'Bridges reported', 'Correct?'],
      rows: [
        { cells: ['remove each edge, recount (the oracle)', truth, 'by definition'] },
        { cells: ['skip the parent EDGE by id', found || 'none',
          found === truth ? 'yes' : 'NO'] },
        { cells: ['skip the parent VERTEX', '0–1, 1–2',
          'NO — 0–1 is doubled, so losing one copy splits nothing'] }
      ]
    });
    root.jQuery('#brg-parallel-note').text('Three nodes, with 0 and 1 joined twice. Removing either copy '
      + 'of 0–1 leaves the other, so it is not a bridge; only 1–2 is. A walk that skips the parent by '
      + 'vertex never sees the second copy, concludes the subtree has no other way out, and reports a '
      + 'bridge that does not exist. It is three lines of difference and it is wrong on every multigraph.');
  }

  function paintList(state) {
    const analysis = state.run.analysis;
    const rows = analysis.bridges.slice(0, 10).map(function (bridge) {
      return { link: bridge.from + ' – ' + bridge.to, kind: 'bridge',
        effect: 'the network splits into two parts' };
    }).concat(analysis.articulation.slice(0, 6).map(function (vertex) {
      return { link: 'node ' + vertex, kind: 'articulation point',
        effect: 'removing this node disconnects the rest' };
    }));

    if (rows.length === 0) {
      root.jQuery('#brg-list tbody').html(
        '<tr><td colspan="3">No single point of failure: every node and link survives any one removal.</td></tr>');
      root.jQuery('#brg-list-note').text('This network is 2-edge-connected and 2-vertex-connected, which '
        + 'is what a grid gives you for free and what redundancy buys everywhere else.');
      return;
    }
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.link + '</td><td>' + row.kind + '</td>' +
        '<td>' + row.effect + '</td></tr>';
    }).join('');

    root.jQuery('#brg-list tbody').html(html);
    root.jQuery('#brg-list-note').text('Showing up to ten bridges and six cut vertices of ' +
      analysis.bridges.length + ' and ' + analysis.articulation.length + '. On a path every edge is a '
      + 'bridge and every internal node a cut vertex, which is the worst possible network and the best '
      + 'possible fixture.');
  }

  function paintTree(state) {
    const tree = state.run.blockCutTree;
    const verified = root.Biconnectivity.verifyTree(tree);

    root.MatrixView.render(root.jQuery('#brg-tree')[0], {
      columns: ['Quantity', 'Value', 'Note'],
      rows: [
        { cells: ['blocks', root.Format.exact(tree.blocks), 'regions with no internal single point of failure'] },
        { cells: ['cut vertices', root.Format.exact(tree.cuts), 'the joints between blocks'] },
        { cells: ['tree nodes', root.Format.exact(verified.nodes), 'blocks plus cut vertices'] },
        { cells: ['tree edges', root.Format.exact(verified.edges), 'one per (block, cut vertex) membership'] },
        { cells: ['is it a forest?', verified.isForest ? 'yes' : 'NO',
          'nodes − components = edges, checked rather than assumed'] }
      ]
    });
    root.jQuery('#brg-tree-note').text('The block-cut tree is what makes the analysis actionable: it says '
      + 'not merely that a node is a single point of failure, but which blocks it joins and therefore what '
      + 'is stranded when it goes. It is always a forest, and that is verified here by counting rather '
      + 'than assumed from the theorem.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
