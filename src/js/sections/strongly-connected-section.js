/**
 * Section: strongly connected components.
 *
 * Two algorithms are on the page because they are each other's oracle. They
 * share no code and almost no idea, so a bug in one is very unlikely to be
 * present in the other - and an SCC bug produces a *plausible* partition,
 * which nothing else notices. The agreement is compared as a partition rather
 * than as a labelling, because the component ids are arbitrary.
 *
 * The condensation is checked rather than assumed. "Collapsing the components
 * always gives a DAG" is a theorem, and a broken SCC computation produces a
 * condensation with a cycle in it - so the acyclicity check is the second
 * oracle, and it costs one Kahn sweep.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'strongly-connected';
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
      title: 'Diagram — components, and the DAG they collapse to',
      caption: 'A, B and C can all reach each other, so they are one component; D and E are another. ' +
        'Collapsing each to a single node leaves one edge and no way back — which is why the ' +
        'condensation is always acyclic, whatever the original graph looked like.',
      definition: [
        'flowchart LR',
        '    subgraph one["component 1"]',
        '      A["A"] --> B["B"]',
        '      B --> C["C"]',
        '      C --> A',
        '    end',
        '    subgraph two["component 2"]',
        '      D["D"] --> E["E"]',
        '      E --> D',
        '    end',
        '    C --> D'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Two vertices are in the same strongly connected component when each can reach the ' +
          'other.** The components partition the graph, and collapsing each one to a single node ' +
          '— the **condensation** — always produces a DAG.',
        'That is the whole reason the computation matters. It turns any directed graph into an ' +
          'acyclic one, plus a note about what was inside each blob, and every algorithm that ' +
          'needs acyclicity can then run on it.',
        '**Tarjan does it in one pass**, with two numbers per vertex: `index`, the discovery ' +
          'order, and `lowlink`, the smallest index reachable from this subtree including through ' +
          'one back edge. A vertex whose lowlink equals its own index is the root of a component, ' +
          'and everything above it on the stack belongs to that component.',
        '**Kosaraju does it in two passes** — finish times on the graph, then components on its ' +
          'reverse in decreasing finish order. It is slower by a constant, and far easier to be ' +
          'sure of.',
        '**Both are on the page because an SCC bug produces a plausible partition.** Nothing ' +
          'downstream notices a component that is slightly too large or split in two. The graph ' +
          'still looks like a graph.',
        'So the two are compared as *partitions* rather than as labellings, because the ids are ' +
          'arbitrary. And the condensation is checked for acyclicity, which is a theorem and ' +
          'therefore a second independent oracle.',
        '**The same computation appears under at least four names.** Import-cycle detection. ' +
          'Deadlock detection in a wait-for graph. 2-SAT solving over an implication graph. And ' +
          '"why can this module not be built incrementally". All one SCC computation over ' +
          'different graphs, and recognising that is worth more than any of the four ' +
          'individually.'
      ],
      demo: {
        title: 'Interactive demo — Tarjan against Kosaraju, and the condensation checked',
        markup: root.StronglyConnectedTemplate.render()
      },
      diagram: diagram(),
      insight: 'When two independent implementations of the same thing are cheap, keep both and ' +
        'compare them on every run, rather than choosing the faster one and hoping. It is the ' +
        'single most effective testing technique available for problems whose wrong answers look ' +
        'right. This milestone uses it five times: Tarjan against Kosaraju, bridges against a ' +
        'removal oracle, three MSTs against each other, three LCAs against a naive climb, and ' +
        'contraction hierarchies against Dijkstra. In every one of those, the fast ' +
        'implementation is the one that is subtly wrong.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.StronglyConnectedTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[1]);
    const graph = root.GraphLab.build({ shape: parts[0], n: n, seed: Number(parts[3]),
      m: n * Number(parts[2]), directed: true,
      components: Math.max(2, Math.floor(n / 4)), size: 4 });
    return { graph: graph, run: root.GraphLab.connectivityRun(graph, {}) };
  });

  function keyFor(values) {
    return values['scc-shape'] + '|' + values['scc-size'] + '|' + values['scc-density'] + '|' +
      values['scc-seed'];
  }

  function update() {
    const values = panel.values();
    const state = runFor(keyFor(values));

    paintMetrics(state);
    paintCanvas(state);
    paintMethods(state);
    paintCondensation(state);
    paintSizes(state);
    paintUses();
  }

  function paintMetrics(state) {
    const run = state.run;
    const profile = run.profile;

    root.MetricGrid.update({
      'scc-count': { value: root.Format.exact(profile.count),
        note: run.agree.agree ? 'Tarjan and Kosaraju agree exactly'
          : 'THEY DISAGREE: ' + run.agree.witness },
      'scc-largest': { value: root.Format.exact(profile.largest),
        note: root.Format.fixed(100 * profile.largest / state.graph.n, 1) + '% of the graph' },
      'scc-singletons': { value: root.Format.exact(profile.singletons),
        note: 'vertices on no directed cycle at all' },
      'scc-acyclic': { value: run.acyclic.acyclic ? 'yes' : 'NO',
        note: run.acyclic.acyclic ? 'the theorem holds on this instance'
          : 'THE COMPONENTS ARE WRONG — a condensation cannot have a cycle' }
    });
  }

  function paintCanvas(state) {
    view = function () { drawGraph(state); };
    view();
  }

  function drawGraph(state) {
    const host = root.jQuery('#scc-canvas')[0];

    if (!host) return;
    const components = state.run.tarjan.components;
    const positions = root.GraphView.groupedLayout(components, state.graph.n,
      host.clientWidth || 620, 340);
    const label = state.run.tarjan.component;

    root.GraphView.draw({
      host: host, graph: state.graph, positions: positions, height: 340,
      edgeClass: function (id, edge) {
        return label[edge.from] === label[edge.to] ? 'tree' : null;
      },
      nodeClass: root.GraphView.classByGroup(label)
    });
    root.jQuery('#scc-canvas-note').text('One ring per component, arranged on an outer ring. Highlighted '
      + 'edges stay inside a component; faint ones cross between them, and every one of those crossings '
      + 'points the same way — which is the condensation being acyclic, drawn.');
  }

  function paintMethods(state) {
    const rows = [
      { name: "Tarjan (one pass, lowlink)", run: state.run.tarjan, passes: 1 },
      { name: 'Kosaraju (two passes, reverse graph)', run: state.run.kosaraju, passes: 2 }
    ];
    const html = rows.map(function (row) {
      const report = row.run.report;
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + row.passes + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.components.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(report.nodesVisited) + '</td>' +
        '<td class="mono">' + root.Format.exact(report.edgesExamined) + '</td>' +
        '<td class="mono">' + root.Format.exact(report.maxStack || report.maxDepth) + '</td></tr>';
    }).join('');

    root.jQuery('#scc-methods tbody').html(html);
    root.jQuery('#scc-methods-note').text(state.run.agree.agree
      ? 'The two partitions are identical — compared as partitions, not as labellings, because the '
        + 'component ids are arbitrary and only the grouping is the answer. Kosaraju examines roughly '
        + 'twice the edges because it walks the graph and then its reverse.'
      : 'THE TWO DISAGREE: ' + state.run.agree.witness + '. One of them is wrong, and the partition on '
        + 'this page cannot be trusted until that is resolved.');
  }

  function paintCondensation(state) {
    const condensed = state.run.condensation;
    const rows = [
      { cells: ['nodes in the original', root.Format.exact(state.graph.n), 'vertices'] },
      { cells: ['nodes in the condensation', root.Format.exact(condensed.n),
        'one per component'] },
      { cells: ['edges in the original', root.Format.exact(state.graph.edges.length), ''] },
      { cells: ['edges in the condensation', root.Format.exact(condensed.edges.length),
        'de-duplicated: many crossings collapse to one'] },
      { cells: ['acyclic?', state.run.acyclic.acyclic ? 'yes' : 'NO',
        root.Format.exact(state.run.acyclic.placed) + ' of ' + condensed.n +
        ' placed by a topological sweep'] }
    ];

    root.MatrixView.render(root.jQuery('#scc-condensation')[0], {
      columns: ['Quantity', 'Value', 'Note'],
      rows: rows
    });
    root.jQuery('#scc-condensation-note').text('The condensation is the point of the whole computation: '
      + 'whatever the original graph looked like, this one is a DAG, so every algorithm from 13.2 applies '
      + 'to it. The acyclicity is verified by an actual topological sweep rather than assumed from the '
      + 'theorem — because a broken SCC computation produces a condensation that has a cycle, and nothing '
      + 'else would notice.');
  }

  function paintSizes(state) {
    const sizes = state.run.profile.sizes;
    const html = sizes.map(function (size, i) {
      return '<tr><td class="mono">' + (i + 1) + '</td>' +
        '<td class="mono">' + root.Format.exact(size) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * size / state.graph.n, 2) + '%</td></tr>';
    }).join('');

    root.jQuery('#scc-sizes tbody').html(html);
    root.jQuery('#scc-sizes-note').text('The ten largest of ' +
      root.Format.exact(state.run.profile.count) + ' components. Random digraphs almost always show one '
      + 'giant component and a dust of singletons; the chained-cycles shape gives components of a known '
      + 'size, which is what makes it useful as a fixture rather than as a demonstration.');
  }

  function paintUses() {
    const rows = [
      { problem: 'import-cycle detection', vertices: 'modules, edges are imports',
        meaning: 'a component of size above one is a cycle you cannot build incrementally' },
      { problem: 'deadlock detection', vertices: 'threads, edges are "waits for"',
        meaning: 'a component of size above one is a set of threads waiting on each other' },
      { problem: '2-SAT', vertices: 'literals, edges are implications',
        meaning: 'unsatisfiable exactly when some variable shares a component with its negation' },
      { problem: 'incremental build analysis', vertices: 'targets, edges are dependencies',
        meaning: 'a component must be rebuilt as a unit — nothing inside it can be skipped' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.vertices + '</td>' +
        '<td>' + row.meaning + '</td></tr>';
    }).join('');

    root.jQuery('#scc-uses tbody').html(html);
    root.jQuery('#scc-uses-note').text('Four problems that look unrelated and are one computation over '
      + 'four different graphs. The 2-SAT case is the least obvious and the most striking: building the '
      + 'implication graph is a few lines, and satisfiability then reduces entirely to whether any '
      + 'variable and its negation ended up in the same component.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
