/**
 * Section: Splay trees and self-adjustment.
 *
 * The claim under test is the working-set property: on a skewed access
 * pattern a splay tree should beat a balanced tree, because the hot keys end
 * up near the root. The demo measures the access phase only — charging the
 * build to the access phase would swamp the effect the section exists to show.
 *
 * The skew slider is the honest part. At skew 0.6 the pattern is nearly
 * uniform and splaying loses; the crossover is on the chart rather than in the
 * prose.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'splay-trees';
  const DRAW_LIMIT = 63;
  let panel = null;
  let costChart = null;
  let treeChart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (costChart) costChart.redraw();
      if (treeChart) treeChart.redraw();
    });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A splay tree has no balance rule and no per-node bookkeeping. Every access — read or ' +
          'write — rotates the touched node all the way to the root, in pairs: zig when it is a ' +
          'child of the root, zig-zig when the node and its parent lean the same way, zig-zag when ' +
          'they do not.',
        'Doing the pairs in that order is the whole algorithm. Repeatedly rotating a node with its ' +
          'parent also brings it to the root and gives no amortised bound at all; splaying halves ' +
          'the depth of everything on the path, which is what the potential argument needs. The ' +
          'result is O(log n) amortised, plus two properties no balanced tree has: the working-set ' +
          'property, and static optimality.',
        'The cost is that a read is a write. That rules the structure out of anything concurrent, ' +
          'memory-mapped or shared — and it is why the measurement below is about a skewed workload, ' +
          'because on a uniform one there is nothing to win.'
      ],
      demo: { title: 'Interactive demo — the workload decides', markup: root.SplayTreesTemplate.render() },
      diagram: {
        title: 'Diagram — zig-zig against zig-zag',
        caption: 'zig-zig rotates the parent first. That ordering is what halves the path depth.',
        definition: [
          'flowchart LR',
          '    subgraph zz["zig-zig: x and p lean the same way"]',
          '        G1(("g")) --> P1(("p")) --> X1(("x"))',
          '        Z1["rotate p above g, then x above p"]',
          '    end',
          '    subgraph zg["zig-zag: x and p lean opposite ways"]',
          '        G2(("g")) --> P2(("p"))',
          '        P2 --> X2(("x"))',
          '        Z2["rotate x above p, then x above g"]',
          '    end'
        ].join('\n')
      },
      insight: 'Splaying writes on read, which makes it a poor fit for concurrent or memory-mapped ' +
        'structures no matter how good the amortised bound is. Two threads reading the same tree ' +
        'both want to restructure it, so every read needs the write lock — and a read-only page ' +
        'cannot be splayed at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SplayTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /** Build the tree, then draw the accesses. Measurement starts after the build. */
  function operationsFor(values, skew) {
    if (values['splay-pattern'] === 'zipf') {
      return root.TreeLab.operations({
        kind: 'zipf',
        count: values['splay-accesses'],
        span: values['splay-span'],
        skew: skew,
        rng: root.Random.seeded(values['splay-seed'])
      });
    }

    const rng = root.Random.seeded(values['splay-seed']);
    const build = root.TreeLab.shuffle(
      Array.from({ length: values['splay-span'] }, function (_, i) { return i; }), rng
    ).map(function (key) { return { op: 'insert', key: key }; });

    for (let i = 0; i < values['splay-accesses']; i += 1) {
      const key = values['splay-pattern'] === 'sequential'
        ? i % values['splay-span']
        : rng.int(values['splay-span']);
      build.push({ op: 'find', key: key });
    }
    return build;
  }

  function measure(values, skew) {
    const operations = operationsFor(values, skew);
    const from = root.TreeLab.firstAccess(operations);
    const rows = root.TreeLab.compare({
      builders: [
        { create: function () { return root.Splay.create({}); } },
        { create: function () { return root.Avl.create({}); } }
      ],
      operations: operations,
      measureFrom: from
    });
    return { splay: rows[0], avl: rows[1], accesses: operations.length - from };
  }

  function update(app) {
    const values = panel.values();
    const result = measure(values, values['splay-skew']);
    const ratio = result.splay.stats.comparisons / result.avl.stats.comparisons;

    root.MetricGrid.update({
      'splay-cost': {
        value: root.Format.exact(result.splay.stats.comparisons),
        note: root.Format.fixed(result.splay.stats.comparisons / result.accesses, 2) + ' per access'
      },
      'splay-avl': {
        value: root.Format.exact(result.avl.stats.comparisons),
        note: root.Format.fixed(result.avl.stats.comparisons / result.accesses, 2) + ' per access'
      },
      'splay-ratio': {
        value: root.Format.fixed(ratio, 3),
        note: ratio < 1
          ? root.Format.percent(1 - ratio, 1) + ' cheaper than the balanced tree'
          : root.Format.percent(ratio - 1, 1) + ' more expensive — the pattern is too flat to pay for the rotations'
      },
      'splay-height': {
        value: root.Format.exact(result.splay.height),
        note: 'the AVL tree is ' + result.avl.height + ' deep and stays there'
      }
    });

    paintSteps(result);
    drawTree(app, values);
    drawCurve(app, values);
  }

  function paintSteps(result) {
    const stats = result.splay.stats;
    const rows = [
      { label: 'zig', count: stats.zig, rotations: 1, why: 'the node is a child of the root' },
      { label: 'zig-zig', count: stats.zigzig, rotations: 2, why: 'node and parent lean the same way — the parent rotates first' },
      { label: 'zig-zag', count: stats.zigzag, rotations: 2, why: 'they lean opposite ways — the node rotates twice' }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.count) + '</td>' +
        '<td class="mono">' + row.rotations + '</td>' +
        '<td class="note">' + row.why + '</td></tr>';
    }).join('');

    root.jQuery('#splay-steps tbody').html(rows);
    root.jQuery('#splay-steps-note').text(root.Format.exact(stats.rotations) + ' rotations over ' +
      root.Format.exact(result.accesses) + ' accesses — ' +
      root.Format.fixed(stats.rotations / Math.max(1, result.accesses), 2) +
      ' per read. Every one of them is a write to a tree somebody else may be reading.');
  }

  function drawTree(app, values) {
    const small = Math.min(values['splay-span'], DRAW_LIMIT);
    const tree = root.Splay.create({});
    const rng = root.Random.seeded(values['splay-seed']);
    root.TreeLab.shuffle(Array.from({ length: small }, function (_, i) { return i; }), rng)
      .forEach(function (key) { tree.insert(key, key); });

    const table = root.TreeLab.zipfTable(small, values['splay-skew']);
    for (let i = 0; i < 400; i += 1) tree.has(root.TreeLab.zipfPick(table, rng));

    root.jQuery('#splay-tree-note').text('A ' + small + '-key tree after 400 accesses at the same ' +
      'skew. Key 0 is the hottest, and it has been rotated to (or near) the root.');

    treeChart = root.TreeView.render(root.jQuery('#splay-tree')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      snapshot: tree.snapshot({ maxDepth: 12 }),
      highlight: [0, 1, 2],
      summary: function () {
        return 'A splay tree of ' + small + ' keys after 400 skewed accesses: the hot keys sit near ' +
          'the root and the cold ones have been pushed down.';
      }
    });
  }

  /** Cost ratio across the skew range, so the crossover is visible. */
  function drawCurve(app, values) {
    const splay = [];
    const avl = [];

    for (let skew = 0.6; skew <= 2.001; skew += 0.2) {
      const point = measure(Object.assign({}, values, { 'splay-pattern': 'zipf' }), skew);
      splay.push({ x: Number(skew.toFixed(1)), y: point.splay.stats.comparisons / point.accesses });
      avl.push({ x: Number(skew.toFixed(1)), y: point.avl.stats.comparisons / point.accesses });
    }

    costChart = root.GrowthPlot.render(root.jQuery('#splay-chart')[0], {
      lazyLib: app.lazyLib,
      height: 230,
      series: [
        { label: 'splay comparisons per access', points: splay, dots: true },
        { label: 'AVL comparisons per access', points: avl, dots: true }
      ],
      xLabel: 'Zipf skew',
      yLabel: 'comparisons per access',
      legendHost: root.jQuery('#splay-legend')[0],
      summary: function () {
        return 'Comparisons per access for a splay tree and an AVL tree over Zipf skews from 0.6 to ' +
          '2.0. The lines cross where the access pattern becomes concentrated enough to pay for the ' +
          'rotations.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
