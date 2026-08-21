/**
 * Section: shortest paths I.
 *
 * The claim the page has to make concrete is that **Dijkstra with a negative
 * edge does not error** - it returns a plausible wrong distance. Building an
 * instance that actually demonstrates that took three attempts, and the
 * reason is worth carrying into the prose: a lazy heap updates the distance
 * array even for a settled vertex, so an instance where the negative edge
 * merely lowers a settled vertex's own distance comes out right by accident.
 * The error has to *propagate*, and the tell is that the vertex the negative
 * edge points at is correct while its successor is not.
 *
 * Every path on the page is re-walked edge by edge with `pathCost`. A
 * distance is a number with nothing to compare it against; a path can be
 * checked against the graph, and a parent array corrupted by a lazy-deletion
 * bug produces a path whose cost is not the reported distance.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'shortest-paths-basics';
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
      title: 'Diagram — the relaxation step, and the invariant it rests on',
      caption: 'Settling u fixes its distance forever. That is only sound if no path through an unsettled ' +
        'vertex can arrive cheaper — which needs every edge to be non-negative, because a negative edge ' +
        'can reduce a total after the fact.',
      definition: [
        'flowchart LR',
        '    S["settled set — distances final"] --> U["u: the smallest tentative distance"]',
        '    U --> R{"d[u] + w(u,v) < d[v]?"}',
        '    R -->|yes| I["improve d[v], record u as its parent"]',
        '    R -->|no| K["leave it"]',
        '    I --> C["settle u: no cheaper route can appear — IF every w >= 0"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'On an unweighted graph, **BFS is the shortest-path algorithm** - it settles vertices in ' +
          'non-decreasing distance because the queue holds at most two distinct distances at once. Once ' +
          'weights appear that stops being true and something has to keep the frontier sorted, which is ' +
          'what the priority queue in Dijkstra is for.',
        '**Dijkstra rests on one invariant**: the unsettled vertex with the smallest tentative distance is ' +
          'final. The argument is that any remaining path to it must leave the settled set through some ' +
          'frontier vertex whose distance is at least as large, and adding a non-negative edge cannot make ' +
          'it smaller. That last clause carries the entire proof, and it is exactly what a negative edge ' +
          'takes away.',
        '**A negative edge does not raise an error.** It returns a plausible number, and the failure is ' +
          'subtler than it first looks: a lazy implementation updates the distance array even for an ' +
          'already-settled vertex, so an instance where the negative edge only lowers that vertex\'s own ' +
          'distance comes out right by accident. The error has to propagate past the settled vertex, and ' +
          'the tell is that the vertex the negative edge points at is *correct* while its successor is ' +
          'not. The panel below shows that instance with the two answers side by side.',
        '**When the weights are only 0 and 1, a deque replaces the heap entirely.** Push a zero edge to ' +
          'the front and a one edge to the back and the deque stays sorted with no comparisons at all: ' +
          'O(n + m) rather than O(m log n), and exact rather than approximate. It is a narrow case and it ' +
          'is extremely common - "free" and "costs one" is what most reachability-with-a-toll problems ' +
          'reduce to.'
      ],
      demo: {
        title: 'Interactive demo — the settled set, the path re-walked, and the invariant broken',
        markup: root.ShortestPathsBasicsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Any quantity that can go negative — a refund, a rebate, a delta, a score that rewards as ' +
        'well as penalises — makes Dijkstra unsound on that graph, and it will not tell you. The two ' +
        'correct responses are Bellman-Ford, which is slower and handles it, or a potential transform that ' +
        'shifts every weight non-negative while preserving shortest paths, which is what Johnson\'s ' +
        'algorithm in the next section does. The wrong response, and the common one, is to notice that the ' +
        'numbers look reasonable.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ShortestPathsBasicsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const side = parts[0];
    const graph = root.GraphCore.grid(side, side,
      { random: parts[2] > 1 ? root.Random.seeded(parts[1]) : null, weightRange: parts[2] });
    const target = Math.min(graph.n - 1, Math.max(1, Math.floor(graph.n * parts[3] / 100) - 1));
    const adjacency = root.GraphCore.adjacencyList(graph);
    const dijkstra = root.ShortestPaths.dijkstra(adjacency, 0, {});
    const path = root.ShortestPaths.pathTo(dijkstra.parent, 0, target);
    return { graph: graph, adjacency: adjacency, target: target, dijkstra: dijkstra, path: path,
      compare: root.GraphLab.compareShortestPaths(graph, 0, {}),
      pathCost: root.ShortestPaths.pathCost(adjacency, path) };
  });

  const zeroOneFor = root.Helpers.memoise(function (key) {
    const side = Number(key);
    const random = root.Random.seeded(11);
    const base = root.GraphCore.grid(side, side, {});
    const edges = base.edges.map(function (edge) {
      return { from: edge.from, to: edge.to, weight: random.int(2) };
    });
    const graph = root.GraphCore.createGraph(base.n, edges, { name: '0-1 grid' });
    const adjacency = root.GraphCore.adjacencyList(graph);
    return { graph: graph,
      deque: root.ShortestPaths.zeroOneBfs(adjacency, 0, {}),
      heap: root.ShortestPaths.dijkstra(adjacency, 0, {}),
      truth: root.ShortestPaths.bellmanFord(graph.edges, graph.n, 0, {}) };
  });

  function keyFor(values) {
    return values['spb-rows'] + '|' + values['spb-seed'] + '|' + values['spb-range'] + '|' +
      values['spb-target'];
  }

  function update() {
    const values = panel.values();
    const state = runFor(keyFor(values));

    paintMetrics(state);
    paintCanvas(state);
    paintMethods(state);
    paintNegative();
    paintHeap(state);
    paintZeroOne(zeroOneFor(String(Math.min(30, values['spb-rows']))));
  }

  function paintMetrics(state) {
    const distance = state.dijkstra.distance[state.target];
    const truth = state.compare.truth.distance[state.target];

    root.MetricGrid.update({
      'spb-distance': { value: root.Format.exact(distance),
        note: distance === truth ? 'Bellman-Ford agrees' : 'BELLMAN-FORD DISAGREES' },
      'spb-settled': { value: root.Format.exact(state.dijkstra.report.settled),
        note: 'of ' + root.Format.exact(state.graph.n) + ' nodes in the grid' },
      'spb-stale': { value: root.Format.exact(state.dijkstra.report.staleSkipped),
        note: root.Format.fixed(100 * state.dijkstra.report.staleSkipped /
          Math.max(1, state.dijkstra.report.pops), 1) + '% of the pops did nothing' },
      'spb-pathcost': { value: state.pathCost === null ? 'no path' : root.Format.exact(state.pathCost),
        note: state.pathCost === distance ? 'matches the reported distance exactly'
          : 'DOES NOT MATCH THE REPORTED DISTANCE' }
    });
  }

  function paintCanvas(state) {
    view = function () { drawGrid(state); };
    view();
  }

  function drawGrid(state) {
    const host = root.jQuery('#spb-canvas')[0];

    if (!host) return;
    const positions = root.GraphView.fixedLayout(state.graph, host.clientWidth || 620, 340);
    const onPath = new Set(state.path || []);

    root.GraphView.draw({
      host: host, graph: state.graph, positions: positions, height: 340,
      path: state.path,
      nodeClass: function (v) {
        if (onPath.has(v)) return 'path';

        if (v === state.target) return 'cut';
        return state.dijkstra.settled[v] ? 'settled' : null;
      }
    });
    root.jQuery('#spb-canvas-note').text('Settled nodes are shaded and the path is drawn over them. ' +
      'Dijkstra settled ' + state.dijkstra.report.settled + ' of ' + state.graph.n + ' — running to '
      + 'completion rather than stopping at the target, which is what makes the next two sections worth '
      + 'having.');
  }

  function paintMethods(state) {
    const html = state.compare.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.distance[state.target]) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.settled || row.report.rounds) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.relaxations) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.disagreements) + '</td></tr>';
    }).join('');

    root.jQuery('#spb-methods tbody').html(html);
    root.jQuery('#spb-methods-note').text('Bellman-Ford is the reference: it is slower and it is right on '
      + 'every graph these controls can produce. The disagreement column is zero here because the weights '
      + 'are non-negative — the panel below is the same table on a graph where it is not.');
  }

  /* The instance where Dijkstra is wrong, with both answers shown. */
  function paintNegative() {
    const graph = root.ShortestPaths.negativeExample();
    const adjacency = root.GraphCore.adjacencyList(graph);
    const dijkstra = root.ShortestPaths.dijkstra(adjacency, 0, {});
    const truth = root.ShortestPaths.bellmanFord(graph.edges, graph.n, 0, {});
    const rows = [0, 1, 2, 3].map(function (v) {
      return { cells: ['distance to ' + v, root.Format.exact(dijkstra.distance[v]),
        root.Format.exact(truth.distance[v]),
        dijkstra.distance[v] === truth.distance[v] ? '' : 'WRONG'] };
    });

    root.MatrixView.render(root.jQuery('#spb-negative')[0], {
      columns: ['Vertex', 'Dijkstra', 'Bellman-Ford', ''],
      rows: rows
    });
    root.jQuery('#spb-negative-note').text('Four vertices: 0→1 costs 2, 0→2 costs 3, 2→1 costs −2 and '
      + '1→3 costs 1. Vertex 1 is settled at 2 and relaxes 1→3, giving d[3] = 3. Only then is vertex 2 '
      + 'popped, and its −2 edge lowers d[1] to 1 — but 1 is already settled, so its outgoing edge is '
      + 'never relaxed again. Note that d[1] ends up CORRECT and d[3] does not: the error propagates past '
      + 'the settled vertex, which is why a smaller counter-example does not work and why this failure is '
      + 'so easy to miss.');
  }

  function paintHeap(state) {
    const report = state.dijkstra.report;
    const rows = [
      { name: 'pushes', count: report.pushes, cost: 'one per improvement, not one per vertex' },
      { name: 'pops', count: report.pops, cost: 'every push comes back out' },
      { name: 'stale pops skipped', count: report.staleSkipped,
        cost: 'work an indexed heap with decrease-key would not do' },
      { name: 'vertices settled', count: report.settled, cost: 'the useful pops' },
      { name: 'relaxations', count: report.relaxations, cost: 'one per edge examined' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.count) + '</td><td>' + row.cost + '</td></tr>';
    }).join('');

    root.jQuery('#spb-heap tbody').html(html);
    root.jQuery('#spb-heap-note').text('The lazy heap pushes a new entry instead of decreasing a key, so '
      + 'the heap holds ' + root.Format.exact(report.pushes) + ' entries for ' +
      root.Format.exact(report.settled) + ' vertices and skips ' +
      root.Format.exact(report.staleSkipped) + ' of them on the way out. That is the price of not '
      + 'maintaining handles, and on a sparse graph it is usually worth paying — the M05 indexed heap is '
      + 'the alternative, and it is more code.');
  }

  function paintZeroOne(state) {
    const agree = state.deque.distance.every(function (d, v) { return d === state.truth.distance[v]; }) &&
      state.heap.distance.every(function (d, v) { return d === state.truth.distance[v]; });
    const rows = [
      { name: '0-1 BFS', structure: 'a deque; zero to the front, one to the back',
        comparisons: 0, complexity: 'O(n + m)' },
      { name: 'Dijkstra', structure: 'a binary heap',
        comparisons: state.heap.report.pops, complexity: 'O(m log n)' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + row.structure + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + row.complexity + '</td>' +
        '<td>' + (agree ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#spb-zeroone tbody').html(html);
    root.jQuery('#spb-zeroone-note').text('The same grid with every weight redrawn as 0 or 1. The deque '
      + 'needs no comparisons at all: a zero edge cannot increase the distance, so it belongs at the '
      + 'front, and a one edge belongs exactly one level back. Both give the same '
      + root.Format.exact(state.graph.n) + ' distances, and the deque does it without a heap.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
