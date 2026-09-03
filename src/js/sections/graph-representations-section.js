/**
 * Section: representations and traversal.
 *
 * The memory table is the point of the first half, and it has to be bytes
 * rather than adjectives: "the matrix does not scale" is unfalsifiable, and
 * "165 888 bytes against 9 028 for the same 144-node grid" is the same claim
 * with the argument attached.
 *
 * The second half is edge classification, and the honest fact it has to carry
 * is that an *undirected* graph has only two kinds. Every non-tree edge is a
 * back edge; forward and cross edges exist only in a directed walk. A DFS
 * that reports forward edges on an undirected graph is counting each edge
 * twice from opposite ends, which is a bug rather than a discovery.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'graph-representations';
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
      title: 'Diagram — the four edge kinds a directed DFS finds',
      caption: 'A back edge points at an ancestor still on the stack, which is exactly a cycle. A forward ' +
        'edge is a shortcut into your own subtree; a cross edge points at a finished subtree elsewhere. ' +
        'Colour alone cannot separate the last two — that needs the discovery times.',
      definition: [
        'flowchart TD',
        '    A["A"] -->|tree| B["B"]',
        '    B -->|tree| C["C"]',
        '    C -->|"back — C reaches an<br/>ancestor, so there is a<br/>cycle"| A',
        '    A -->|"forward — a shortcut<br/>into A\'s own subtree"| C',
        '    A -->|tree| D["D"]',
        '    D -->|"cross — B is finished<br/>and elsewhere"| B'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A graph has three usual representations, and they differ by orders of magnitude in ' +
          'memory rather than in asymptotics.**',
        'An **adjacency list** is an array of arrays: simple, and every neighbour lookup is a ' +
          'pointer chase into a separately allocated block. An **adjacency matrix** is n² entries ' +
          'whatever the edge count, which buys O(1) edge tests and is unusable past a few ' +
          'thousand nodes. **CSR** is two typed arrays — offsets and targets — so a neighbour ' +
          'scan is a contiguous read of memory that is already in cache.',
        '**CSR is what every serious graph library stores**, and the reason is the scan rather ' +
          'than the byte count. Traversal becomes a sequential walk of two flat arrays with no ' +
          'indirection at all.',
        'The list-of-arrays version has the same complexity and is several times slower on real ' +
          'hardware. That is the M02 lesson about layout, applied to a different structure.',
        '**BFS and DFS differ in what they hold, not in what they cost.** Both visit every node ' +
          'once and examine every edge once. BFS holds a frontier, which on a wide graph can be ' +
          'enormous. DFS holds a stack, which is the depth.',
        'On a path those numbers are 1 and n. On a star they are n and 1. The demo reports both, ' +
          'because the peak is the memory and only the peak varies.',
        '**In an undirected graph there are only two kinds of edge: tree and back.** Forward and ' +
          'cross edges are directed phenomena. An undirected walk meets every non-tree edge twice, ' +
          'once from each end, and classifying both sightings gives an equal number of spurious ' +
          '"forward" edges.',
        'That is why the second sighting is dropped **by edge id and not by parent vertex**. ' +
          'Dropping it by vertex also drops genuine parallel edges, and that is the bug 13.4 is ' +
          'entirely about.'
      ],
      demo: {
        title: 'Interactive demo — three representations, two walks, four edge kinds',
        markup: root.GraphRepresentationsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Before optimising a graph algorithm, look at how the graph is stored. A ' +
        'five-times speed-up is routinely available from moving an adjacency list into CSR, and ' +
        'it costs no change to the algorithm at all. The loop body is identical, and the memory ' +
        'it touches is contiguous instead of scattered. The corollary is that a benchmark ' +
        'comparing two graph algorithms on different representations is measuring the ' +
        'representation. That mistake is easy to make and impossible to see in the numbers ' +
        'afterwards.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GraphRepresentationsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const size = Number(parts[1]);
    const side = Math.max(3, Math.round(Math.sqrt(size)));
    const graph = root.GraphLab.build({ shape: parts[0], n: size, rows: side, columns: side,
      seed: Number(parts[2]), m: size * 2 });
    const source = Math.min(Number(parts[3]), graph.n - 1);
    return { graph: graph, source: source, describe: root.GraphLab.describe(graph),
      run: root.GraphLab.traversalRun(graph, source) };
  });

  function keyFor(values) {
    return values['gr-shape'] + '|' + values['gr-size'] + '|' + values['gr-seed'] + '|' +
      values['gr-source'];
  }

  function update() {
    const values = panel.values();
    const state = runFor(keyFor(values));

    paintMetrics(state);
    paintCanvas(state);
    paintMemory(state);
    paintWalks(state);
    paintEdges(state);
    paintStructure(state);
  }

  function paintMetrics(state) {
    const memory = state.describe.memory;

    root.MetricGrid.update({
      'gr-nodes': { value: root.Format.exact(state.graph.n) + ' / ' +
        root.Format.exact(state.graph.edges.length),
      note: 'mean degree ' + root.Format.fixed(state.describe.degrees.mean, 2) +
        ', largest ' + state.describe.degrees.max },
      'gr-csr': { value: root.Format.bytes(memory.csr),
        note: 'offsets of ' + root.Format.exact(state.graph.n + 1) + ' plus the targets' },
      'gr-matrix': { value: root.Format.bytes(memory.adjacencyMatrix),
        note: root.Format.exact(state.graph.n) + '² entries, however few edges there are' },
      'gr-ratio': { value: root.Format.fixed(memory.adjacencyMatrix / memory.csr, 1) + '×',
        note: 'and it grows with n / density' }
    });
  }

  function paintCanvas(state) {
    view = function () { drawGraph(state); };
    view();
  }

  function drawGraph(state) {
    const host = root.jQuery('#gr-canvas')[0];

    if (!host) return;
    const positions = state.graph.positionOf
      ? root.GraphView.fixedLayout(state.graph, host.clientWidth || 620, 340)
      : root.GraphView.circularLayout(state.graph.n, host.clientWidth || 620, 340);
    const treeEdges = new Set();

    state.run.bfs.parentEdge.forEach(function (id) { if (id !== -1) treeEdges.add(id); });
    const drawn = root.GraphView.draw({
      host: host, graph: state.graph, positions: positions,
      edgeClass: root.GraphView.classBySet(treeEdges, 'tree'),
      nodeClass: function (v) { return v === state.source ? 'path' : null; },
      height: 340
    });

    root.jQuery('#gr-canvas-note').text(drawn && drawn.truncated
      ? 'Drawing the first ' + root.Format.exact(root.GraphView.MAX_EDGES) + ' edges; the counters below '
        + 'cover the whole graph.'
      : 'The highlighted edges are the BFS tree from the marked source — one edge per reachable node, '
        + 'which is why there are exactly ' + root.Format.exact(treeEdges.size) + ' of them. Everything '
        + 'else is faint: those are the edges BFS examined and did not need.');
  }

  function paintMemory(state) {
    const memory = state.describe.memory;
    const rows = [
      { name: 'adjacency list', bytes: memory.adjacencyList,
        scan: 'a pointer chase per node', test: 'O(degree)' },
      { name: 'adjacency matrix', bytes: memory.adjacencyMatrix,
        scan: 'O(n) per node, mostly empty', test: 'O(1)' },
      { name: 'CSR', bytes: memory.csr,
        scan: 'a contiguous read of two typed arrays', test: 'O(degree)' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.bytes(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bytes / memory.csr, 2) + '×</td>' +
        '<td>' + row.scan + '</td><td class="mono">' + row.test + '</td></tr>';
    }).join('');

    root.jQuery('#gr-memory tbody').html(html);
    root.jQuery('#gr-memory-note').text('Density here is ' +
      root.Format.fixed(100 * memory.density, 2) + '%, so the matrix spends almost all of its ' +
      root.Format.bytes(memory.adjacencyMatrix) + ' storing the absence of edges. The O(1) edge test is '
      + 'the only thing it buys, and it is rarely the operation that dominates.');
  }

  function paintWalks(state) {
    const rows = [
      { name: 'BFS', report: state.run.bfs.report, peak: state.run.bfs.report.maxFrontier,
        meaning: 'the frontier — every node at the current distance' },
      { name: 'DFS (iterative)', report: state.run.dfs.report, peak: state.run.dfs.report.maxDepth,
        meaning: 'the stack — the current root-to-node path' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.nodesVisited) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.edgesExamined) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.peak) + '</td>' +
        '<td>' + row.meaning + '</td></tr>';
    }).join('');

    root.jQuery('#gr-walks tbody').html(html);
    root.jQuery('#gr-walks-note').text('Both visit the same nodes and examine the same edges — the work is '
      + 'identical and only the peak differs, which is the memory. The DFS here is iterative with an '
      + 'explicit stack: a path of a million nodes is a recursion a million deep, and the path shape in '
      + 'the selector produces exactly that.');
  }

  function paintEdges(state) {
    const counts = state.run.classification;
    const directed = state.graph.directed;
    const rows = [
      { kind: 'tree', count: counts.tree, meaning: 'the DFS tree — one per node discovered' },
      { kind: 'back', count: counts.back,
        meaning: directed ? 'points at an ancestor still on the stack — this IS a cycle'
          : 'points at an ancestor; in an undirected graph every non-tree edge is one' },
      { kind: 'forward', count: counts.forward,
        meaning: directed ? 'a shortcut into your own subtree'
          : 'does not exist in an undirected graph' },
      { kind: 'cross', count: counts.cross,
        meaning: directed ? 'points into a finished subtree elsewhere'
          : 'does not exist in an undirected graph' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.kind + '</td>' +
        '<td class="mono">' + root.Format.exact(row.count) + '</td><td>' + row.meaning + '</td></tr>';
    }).join('');

    root.jQuery('#gr-edges tbody').html(html);
    root.jQuery('#gr-edges-note').text(directed
      ? 'A single back edge is a cycle, which is why 13.2 detects cycles by looking for one.'
      : counts.tree + ' tree edges plus ' + counts.back + ' back edges is exactly the ' +
        state.graph.edges.length + ' edges in the graph — every edge is classified once, and forward '
        + 'and cross are both zero because an undirected walk cannot produce them.');
  }

  function paintStructure(state) {
    const components = state.run.components;
    const bipartite = state.run.bipartite;
    const rows = [
      { cells: ['connected components', root.Format.exact(components.count),
        'largest ' + root.Format.exact(Math.max.apply(null, components.sizes))] },
      { cells: ['reachable from the source',
        root.Format.exact(state.run.bfs.report.nodesVisited),
        'of ' + root.Format.exact(state.graph.n) + ' nodes'] },
      { cells: ['eccentricity of the source', root.Format.exact(state.run.bfs.report.maxDepth),
        'the farthest node, in edges'] }
    ];

    if (bipartite) {
      rows.push({ cells: ['bipartite?', bipartite.bipartite ? 'yes' : 'no',
        bipartite.bipartite ? 'no odd cycle exists'
          : 'an odd cycle of ' + bipartite.oddCycle.length + ' nodes through edge ' +
            bipartite.conflict.from + '–' + bipartite.conflict.to] });
    }

    root.MatrixView.render(root.jQuery('#gr-structure')[0], {
      columns: ['Property', 'Value', 'Detail'],
      rows: rows
    });
    root.jQuery('#gr-structure-note').text(bipartite && !bipartite.bipartite
      ? 'Two-colouring failed, and the witness is the odd cycle above rather than a bare "no" — which is '
        + 'the difference between a checker that tells you a constraint is unsatisfiable and one that '
        + 'tells you which constraint.'
      : 'A graph is two-colourable exactly when it has no odd cycle, so a grid is bipartite and a triangle '
        + 'is not. When it fails the demo reports the offending edge and the odd cycle through it, because '
        + '"not bipartite" on its own is not actionable.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
