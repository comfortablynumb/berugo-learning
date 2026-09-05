/**
 * Section: persistence — path copying, fat nodes and node copying.
 *
 * Every strategy runs the same key stream and every version of every strategy
 * is replayed against a model, because a persistent structure that is right at
 * the head and wrong three versions back passes every test that only checks
 * the end state. The defaults are the worked example's: 400 updates over a
 * pool of 1 200 keys, leaving 344 live keys in a treap of depth 18.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'persistence-basics';
  /* The DAG scores every version as it is built, which is quadratic in the
     number of versions; 240 of them is a legible picture and a fast one. */
  const DAG_VERSIONS = 240;
  let panel = null;
  let picture = null;
  let dag = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (picture) picture.redraw();
      if (dag) dag.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one insert, one new path',
      caption: 'Inserting a key into version 4 rebuilds only the nodes on the path from the root to the new ' +
        'leaf. Everything hanging off that path is shared by pointer, which is why the new version costs the ' +
        'depth rather than the size — and why the old root keeps answering exactly as it did.',
      definition: [
        'flowchart TD',
        '    R4["root · v4"] --> A["A"]',
        '    R4 --> B["B"]',
        '    A --> C["C"]',
        '    A --> D["D"]',
        '    R5["root\' · v5"] --> A2["A\' (copied)"]',
        '    R5 --> B',
        '    A2 --> C',
        '    A2 --> E["new leaf"]',
        '    N["B, C and D are the same objects in both versions"] -.-> B'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A persistent structure keeps every version it has ever had, and the only reason that is affordable is ' +
          'that consecutive versions overlap almost entirely. Inserting into a 344-key tree changes one ' +
          'root-to-leaf path and nothing else, so the new version can point at the old subtrees instead of ' +
          'copying them. On 400 updates that is 13.12 new nodes per version rather than 344. The ' +
          'whole history costs 156 720 bytes, against the 5 504 000 that copying every version ' +
          'would.',
        'Path copying is the version everyone reaches for first: rebuild the path, share the rest. ' +
          'Fat nodes refuse to copy anything and instead append a (version, value) pair to the ' +
          'field being changed, so a write costs 0.86 new nodes and 76 448 bytes. Node copying is ' +
          'Driscoll, Sarnak, Sleator and Tarjan\'s answer: a fixed number of spare boxes per node, ' +
          'and a copy only when they fill. It lands at 5.14 nodes per update and 126 944 bytes.',
        'The column that decides between them is the one a space comparison omits. A read on the ' +
          'path-copying and node-copying trees costs 8.61 probes, exactly what the ephemeral tree ' +
          'costs. On the fat-node tree it costs 16.66, because every pointer traversal becomes a ' +
          'binary search over that field\'s history. Fat nodes save 2.05× the memory and cost ' +
          '1.94× the read, so the answer is a property of the workload rather than of the ' +
          'structure.'
      ],
      demo: {
        title: 'Interactive demo — three strategies, one history, every version checked',
        markup: root.PersistenceBasicsTemplate.render()
      },
      diagram: diagram(),
      insight: 'The three strategies are not three implementations of one idea. They are three ' +
        'different trades between write cost, space and read cost, and the demo measures all ' +
        'three. What none of them trade away is correctness at old versions. The wrong-versions ' +
        'column stays at zero for every strategy and every setting, and it is the column to watch ' +
        'when a persistence scheme is being hand-rolled. The failure mode that ends up in ' +
        'production is a structure that shares a node it also mutates. That is invisible until ' +
        'someone reads a snapshot and gets data that never existed.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PersistenceBasicsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const keys = root.VersionLab.keyStream({ count: parts[0], seed: 1, universe: parts[0] * parts[1] });
    return {
      space: root.VersionLab.persistenceCompare({ keys: keys }),
      reads: root.VersionLab.readProbes({ keys: keys })
    };
  });

  const dagFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.VersionLab.versionDag({
      strategy: parts[0],
      keys: root.VersionLab.keyStream({ count: Number(parts[1]), seed: 1, universe: Number(parts[1]) * Number(parts[2]) })
        .slice(0, DAG_VERSIONS)
    });
  });

  const pairFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.VersionLab.versionPair({ strategy: parts[0], version: Number(parts[1]) });
  });

  function update(app) {
    const values = panel.values();
    const strategy = values['pb-strategy'];
    const measured = compareFor(values['pb-count'] + '|' + values['pb-spread']);
    const row = measured.space.filter(function (entry) { return entry.strategy === strategy; })[0];
    const read = measured.reads.filter(function (entry) { return entry.strategy === strategy; })[0];

    paintMetrics(row, read);
    paintCompare(measured, strategy);
    drawTree(pairFor(strategy + '|' + values['pb-draw']));
    drawDag(dagFor(strategy + '|' + values['pb-count'] + '|' + values['pb-spread']), row);
  }

  function labelFor(strategy) {
    return { 'path-copying': 'path copying', 'fat-node': 'fat nodes', 'node-copying': 'node copying' }[strategy];
  }

  function paintMetrics(row, read) {
    const copying = root.VersionLab.copyingCost(row.shape.versions, row.shape.liveKeys);

    root.MetricGrid.update({
      'pb-nodes': {
        value: root.Format.exact(row.shape.distinctNodes),
        note: 'over ' + root.Format.exact(row.shape.versions) + ' versions of ' +
          root.Format.exact(row.shape.liveKeys) + ' live keys'
      },
      'pb-per-update': {
        value: root.Format.fixed(row.shape.nodesPerUpdate, 2),
        note: 'the tree is ' + root.Format.exact(row.shape.depth) + ' deep'
      },
      'pb-bytes': {
        value: root.Format.exact(row.shape.bytes),
        note: root.Format.fixed(copying / Math.max(1, row.shape.bytes), 1) + '× smaller than copying every version'
      },
      'pb-probes': {
        value: root.Format.fixed(read.probes, 2),
        note: read.versionLookups > 0.01
          ? root.Format.fixed(read.versionLookups, 2) + ' of them are version-list searches'
          : 'exactly what the ephemeral tree costs'
      }
    });
  }

  function paintCompare(measured, strategy) {
    const html = measured.space.map(function (row) {
      const read = measured.reads.filter(function (entry) { return entry.strategy === row.strategy; })[0];
      const copying = root.VersionLab.copyingCost(row.shape.versions, row.shape.liveKeys);
      return '<tr' + (row.strategy === strategy ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + labelFor(row.strategy) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.distinctNodes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.shape.nodesPerUpdate, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.bytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(copying / Math.max(1, row.shape.bytes), 1) + '×</td>' +
        '<td class="mono">' + root.Format.fixed(read.probes, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.wrongVersions) + '</td></tr>';
    }).join('');

    root.jQuery('#pb-compare tbody').html(html);
    root.jQuery('#pb-compare-note').text('The last column is the one that matters most and moves least: every ' +
      'version of every strategy is replayed against a model, and any number but zero there would mean a ' +
      'snapshot returning data that never existed. Read the last two columns together — fat nodes win the ' +
      'bytes column and lose the probes column by almost the same factor, which is the whole trade.');
  }

  function drawTree(pair) {
    picture = root.DagView.tree(root.jQuery('#pb-tree')[0], {
      height: 300,
      structure: pair.current,
      previous: pair.previous,
      summary: 'Version ' + pair.version + ' of a 24-key tree: ' + pair.copied + ' nodes built, ' +
        pair.shared + ' inherited.'
    });

    root.jQuery('#pb-tree-note').text('Inserting key ' + pair.key + ' produced version ' + pair.version +
      '. The accent nodes are the ones this update had to build — ' + pair.copied + ' of ' +
      (pair.copied + pair.shared) + ' — and the muted ones are the same objects the previous version was ' +
      'already using. On path copying that accent is a single root-to-leaf line; switch the strategy and ' +
      'watch it shrink to almost nothing for fat nodes, at the read cost the table records.');
  }

  function drawDag(rows, row) {
    dag = root.DagView.dag(root.jQuery('#pb-dag')[0], {
      height: 240,
      rows: rows.rows,
      summary: 'One column per version: total nodes, with the part this version built picked out.'
    });

    root.jQuery('#pb-dag-note').text('One column per version, for the first ' + rows.rows.length + ' of them. The grey column is everything ' +
      'reachable from the newest version and the ' +
      'accent band at its foot is what that version had to build. The band stays flat while the structure ' +
      'grows, which is the sentence "an update costs the depth, not the size" drawn rather than asserted — ' +
      'here it settles at ' + root.Format.fixed(row.shape.nodesPerUpdate, 2) + ' nodes against a live set of ' +
      root.Format.exact(row.shape.liveKeys) + '.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
