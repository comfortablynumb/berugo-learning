/**
 * Section: zippers — a cursor into an immutable structure.
 *
 * The measurement is deliberately narrow, because the whole claim is narrow:
 * a zipper does not make edits cheaper, it makes *consecutive edits in one
 * place* cheaper, by rebuilding the path once at the end instead of once per
 * edit. Both runs perform the same edits on the same tree and produce the same
 * result; only the number of nodes rebuilt differs.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'zippers';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A zipper is a structure turned inside out at one point: the node you are looking at, plus ' +
          'enough context to put the rest back together. For a tree that context is a list of ' +
          'frames, one per level, each holding the parent\'s value and the siblings on either ' +
          'side. Moving down pushes a frame and moving up pops one and rebuilds that parent. The ' +
          'focused node is reachable in O(1) rather than by a search from the root.',
        'The payoff is not the navigation, it is the deferral. Editing a node 12 levels deep by ' +
          'descending from the root each time rebuilds 12 nodes per edit — 600 for 50 edits. The ' +
          'same 50 edits through a zipper rebuild 12 nodes in total, because the path is ' +
          'reconstructed once, when the cursor finally walks back out. That is 50× fewer nodes for ' +
          'identical results, and the factor is the number of edits rather than the depth.',
        'What a zipper does not do is make a single edit cheaper. It also does not help when ' +
          'consecutive edits are in unrelated parts of the structure. The cursor then walks up and ' +
          'down between them and pays the path each way. It is the right tool for a ' +
          'text buffer, an editor\'s selection, a tree rewriting pass or a focus that moves ' +
          'locally. It is the wrong one for scattered random updates, where a plain path-copying ' +
          'insert is both simpler and no worse.'
      ],
      demo: {
        title: 'Interactive demo — the same edits, with and without a cursor',
        markup: root.ZippersTemplate.render()
      },
      diagram: {
        title: 'Diagram — focus and context',
        caption: 'The zipper is the focused subtree plus a list of frames. Each frame remembers everything the ' +
          'parent had except the child being visited, so moving up is a rebuild of exactly one node and no ' +
          'search is ever needed.',
        definition: [
          'flowchart LR',
          '    F["focus: the node being edited"] --> C1["frame: parent value + siblings"]',
          '    C1 --> C2["frame: grandparent value + siblings"]',
          '    C2 --> C3["frame: … up to the root"]',
          '    E["edit"] -.-> F',
          '    U["up / toRoot"] -.-> C1',
          '    N["nothing above the focus is rebuilt until the cursor leaves"] -.-> C2'
        ].join('\n')
      },
      insight: 'A zipper is the data-structure form of an idea that shows up everywhere: batch the writes that ' +
        'share a path and pay for the path once. The same reasoning is behind a transient vector, a write ' +
        'buffer in front of a B-tree and a rebase that squashes commits. The condition is locality — the edits ' +
        'must share a prefix — and the moment they do not, the cursor is pure overhead. Measure the ratio ' +
        'before reaching for one: if it is near 1, the zipper is a data structure you now have to maintain in ' +
        'exchange for nothing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ZippersTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const costFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.zipperCost({ depth: parts[0], edits: parts[1] });
  });

  const curveFor = root.Helpers.memoise(function (key) {
    const edits = Number(key);
    const points = [];
    for (let depth = 4; depth <= 20; depth += 2) {
      points.push(root.VersionLab.zipperCost({ depth: depth, edits: edits }));
    }
    return points;
  });

  function update(app) {
    const values = panel.values();
    const run = costFor(values['zip-depth'] + '|' + values['zip-edits']);

    paintMetrics(run);
    paintCompare(run);
    paintContext(run);
    drawChart(app, curveFor(values['zip-edits']), run);
  }

  function paintMetrics(run) {
    root.MetricGrid.update({
      'zip-rebuilt': {
        value: root.Format.exact(run.zipper.nodesRebuilt),
        note: root.Format.exact(run.zipper.rebuilds) + ' walk back to the root, after all ' +
          root.Format.exact(run.edits) + ' edits'
      },
      'zip-naive': {
        value: root.Format.exact(run.pathCopying.nodesRebuilt),
        note: root.Format.exact(run.pathCopying.rebuilds) + ' walks, one per edit'
      },
      'zip-ratio': {
        value: root.Format.fixed(run.ratio, 0) + '×',
        note: 'fewer nodes rebuilt, for identical results'
      },
      'zip-moves': {
        value: root.Format.exact(run.zipper.moves),
        note: 'against ' + root.Format.exact(run.pathCopying.moves) + ' without the cursor'
      }
    });
  }

  function paintCompare(run) {
    const rows = [
      { label: 'zipper: descend once, edit, walk out', stats: run.zipper },
      { label: 'descend from the root for every edit', stats: run.pathCopying }
    ];

    const html = rows.map(function (row, index) {
      return '<tr' + (index === 0 ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.nodesRebuilt) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.moves) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.rebuilds) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.stats.nodesRebuilt / Math.max(1, run.edits), 2) + '</td></tr>';
    }).join('');

    root.jQuery('#zip-compare tbody').html(html);
    root.jQuery('#zip-compare-note').text('Both rows perform the same ' + root.Format.exact(run.edits) +
      ' edits at the same node and produce the same tree. The last column is the honest summary: with a cursor ' +
      'the cost per edit is ' + root.Format.fixed(run.zipper.nodesRebuilt / Math.max(1, run.edits), 2) +
      ' nodes and without it it is the depth, every time. Drop the edit count to 1 and the two rows meet — ' +
      'the zipper wins nothing on a single edit, which is exactly what it claims.');
  }

  function paintContext(run) {
    const rows = [];
    for (let level = 0; level < Math.min(run.depth, 6); level += 1) {
      rows.push({
        level: level,
        focus: level === 0 ? 'the root' : 'child 0 of level ' + (level - 1),
        context: level === 0 ? 'nothing — this is the top' : level + ' frame' + (level === 1 ? '' : 's') +
          ', each holding a parent value and its other children',
        cost: level === 0 ? '—' : '1 node rebuilt per level popped'
      });
    }

    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.level + '</td><td>' + row.focus + '</td>' +
        '<td>' + row.context + '</td><td class="mono">' + row.cost + '</td></tr>';
    }).join('');

    root.jQuery('#zip-context tbody').html(html);
    root.jQuery('#zip-context-note').text('The context is the part people get wrong when they write one by ' +
      'hand: a frame has to hold everything the parent had *except* the child being visited, or moving up ' +
      'rebuilds a parent that has lost a sibling. The check is that a walk down and straight back up with no ' +
      'edit returns a tree equal to the one you started with — which is the first test in this section\'s ' +
      'exercise, for exactly that reason.');
  }

  function drawChart(app, curve, run) {
    chart = root.ErrorBandView.curve(root.jQuery('#zip-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      legendHost: root.jQuery('#zip-chart-legend')[0],
      xLabel: 'depth of the edited node',
      yLabel: 'nodes rebuilt (log scale)',
      series: [
        { label: 'zipper', width: 3,
          points: curve.map(function (row) { return { x: row.depth, y: Math.max(row.zipper.nodesRebuilt, 0.5) }; }) },
        { label: 'from the root, per edit', dashed: true,
          points: curve.map(function (row) { return { x: row.depth, y: Math.max(row.pathCopying.nodesRebuilt, 0.5) }; }) }
      ]
    });

    root.jQuery('#zip-chart-note').text('Both lines are linear in the depth; they differ by the constant, ' +
      'which is the number of edits — ' + root.Format.exact(run.edits) + ' here. That is the shape of the ' +
      'whole idea: the zipper does not change the asymptotics of reaching a node, it changes how many times ' +
      'you pay them. Raise the edit count and the gap widens; lower it to one and the lines coincide.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
