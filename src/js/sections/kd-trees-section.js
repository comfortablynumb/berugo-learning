/**
 * Section: k-d trees and nearest neighbours.
 *
 * The demo's default is the worked example's setup - 20 000 clustered points,
 * leaf size 8, 500 queries - and the bound selector includes the broken
 * variant on purpose. 'descent' is the tree with the backtrack deleted: it is
 * fourteen times cheaper, returns a plausible point on every query, and is
 * wrong three times in five. A section that only describes that is asking to
 * be believed; this one makes the learner watch the wrong-answer counter move.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'kd-trees';
  const COUNT = 20000;
  const QUERIES = 500;
  const VERIFY = 200;
  const BOUNDS = ['descent', 'plane', 'box'];
  const DIMS = [2, 4, 8, 16, 32, 64, 128];
  let panel = null;
  let chart = null;
  let map = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
      if (map) map.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A k-d tree splits at a *data point* rather than at the middle of a box, alternating axes ' +
          'as it descends. Choosing the median is what makes it balanced on any distribution. At ' +
          'leaf size 8, 20 000 clustered points build 8 191 nodes at depth exactly 12, from ' +
          '720 512 comparisons. It is also why the tree cannot be rebalanced cheaply afterwards, ' +
          'because moving a split moves every point that split classified.',
        'The descent finds a candidate and the backtrack makes it correct. Walking to the leaf the ' +
          'query falls in costs 4.87 distance computations and returns a point on every query. It ' +
          'is wrong on 60.2% of them, and reports a mean neighbour distance of 60.272 where the ' +
          'truth is 42.701. Nothing about the output looks broken. Adding the backtrack — ' +
          're-examining the far side of every split whose plane is closer than the best distance ' +
          'so far — costs 69.28 distance computations and is never wrong.',
        'Which bound the backtrack uses is a free 3.5×. The splitting plane is the textbook test ' +
          'and costs one subtraction. The distance to the far subtree\'s bounding box is never ' +
          'weaker, because the subtree lies inside the box and the box lies beyond the plane. ' +
          'Measured on the same 500 queries: 69.28 distance computations with the plane and 19.77 ' +
          'with the box, for identical answers.'
      ],
      demo: { title: 'Interactive demo — the planes, the backtrack and the dimension wall', markup: root.KdTreesTemplate.render() },
      diagram: {
        title: 'Diagram — the split dimension and value at each node',
        caption: 'Axes alternate with depth and each split value is a coordinate of a real point, so the two ' +
          'halves hold the same number of points whatever the distribution looks like.',
        definition: [
          'flowchart TD',
          '    R["depth 0 · split x = 508.3<br/>20 000 points"] --> L["depth 1 · split y = 341.7<br/>10 000 points"]',
          '    R --> Rr["depth 1 · split y = 663.2<br/>10 000 points"]',
          '    L --> LL["depth 2 · split x = 214.9<br/>5 000"]',
          '    L --> LR["depth 2 · split x = 297.5<br/>5 000"]',
          '    Rr --> RL["depth 2 · split x = 742.0<br/>5 000"]',
          '    Rr --> RR["depth 2 · split x = 811.6<br/>5 000"]',
          '    LL --> Leaf["… depth 12 · leaf of ≤ 8 points"]'
        ].join('\n')
      },
      insight: 'The descent finds a good candidate; the backtrack is what makes it correct. Nearly ' +
        'every buggy k-d tree returns a plausible wrong answer — a nearby point, at a believable ' +
        'distance, on every single query. No smoke test and no eyeball ever catches it. The only ' +
        'acceptable check is agreement with brute force over thousands of randomised queries, and ' +
        'it belongs in the test suite rather than in a review comment.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.KdTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const pointsFor = root.Helpers.memoise(function (kind) {
    return root.SpatialLab.points({ kind: kind, count: COUNT, seed: 1, bounds: root.SpatialLab.BOUNDS });
  });

  const queriesFor = root.Helpers.memoise(function () {
    return root.SpatialLab.queries({ count: QUERIES, bounds: root.SpatialLab.BOUNDS, seed: 3 });
  });

  /**
   * All three bounds in one measurement, because the table shows all three and
   * the tree build is the expensive part they share.
   *
   * The box-bound run is scored against brute force on a prefix - a full
   * oracle over 500 queries costs more than everything else here put together.
   * It is exact, so its answers then serve as the oracle for the other two,
   * which is what lets the deliberately broken descent be scored over its
   * whole query set rather than a sample: the wrong-answer count on screen is
   * the one the prose quotes.
   */
  const runsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const shared = {
      points: pointsFor(parts[0]), queries: queriesFor('q'),
      k: Number(parts[1]), leafSize: Number(parts[2])
    };
    const exact = root.SpatialLab.nearestRun(
      Object.assign({ pruneWith: 'box', verify: VERIFY }, shared));

    return BOUNDS.map(function (bound) {
      if (bound === 'box') return Object.assign(exact, { bound: bound });
      return Object.assign(root.SpatialLab.nearestRun(
        Object.assign({ pruneWith: bound, reference: exact.distances }, shared)), { bound: bound });
    });
  });

  const dimensionsFor = root.Helpers.memoise(function () {
    return root.SpatialLab.dimensionSweep({ count: 4000, queries: 50, dims: DIMS, seed: 3 });
  });

  function update(app) {
    const values = panel.values();
    const runs = runsFor(values['kdt-kind'] + '|' + values['kdt-k'] + '|' + values['kdt-leaf']);
    const chosen = runs.filter(function (run) { return run.bound === values['kdt-prune']; })[0];

    paintMetrics(chosen);
    paintBounds(runs, chosen);
    paintDimensions(dimensionsFor('d'));
    drawDimensions(app, dimensionsFor('d'));
    drawMap(app, values['kdt-kind'], Number(values['kdt-leaf']), chosen);
  }

  function paintMetrics(run) {
    root.MetricGrid.update({
      'kdt-distances': {
        value: root.Format.fixed(run.distancesPerQuery, 2),
        note: root.Format.percent(run.scanFraction, 3) + ' of the ' + root.Format.exact(COUNT) + ' points'
      },
      'kdt-wrong': {
        value: run.wrong + ' of ' + run.verified,
        note: run.wrong ? root.Format.percent(run.wrong / run.verified, 1) + ' of the verified queries returned the wrong point'
          : 'every verified answer matched brute force exactly'
      },
      'kdt-nodes': {
        value: root.Format.fixed(run.nodesVisited / QUERIES, 2),
        note: root.Format.fixed(run.nodesPruned / QUERIES, 2) + ' subtrees pruned, ' +
          root.Format.fixed(run.leavesVisited / QUERIES, 2) + ' leaves read'
      },
      'kdt-reported': {
        value: root.Format.fixed(run.meanNearest, 3),
        note: 'the distance the structure reports, right or wrong'
      }
    });
  }

  function paintBounds(runs, chosen) {
    const html = runs.map(function (run) {
      const here = run.bound === chosen.bound;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + labelFor(run.bound) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.distancesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.nodesVisited / QUERIES, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.leavesVisited / QUERIES, 2) + '</td>' +
        '<td class="mono">' + root.Format.percent(run.scanFraction, 3) + '</td>' +
        '<td class="mono">' + run.wrong + ' of ' + run.verified + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.meanNearest, 3) + '</td></tr>';
    }).join('');

    root.jQuery('#kdt-bounds tbody').html(html);
    root.jQuery('#kdt-bounds-note').text('Read the first row against the last column. The descent is the ' +
      'cheapest thing in the table by an order of magnitude and its reported distances are plausible — larger ' +
      'than the truth, but not obviously so, and on individual queries indistinguishable. That is why the ' +
      'wrong-answer column exists at all: it is the only signal, and it needs an oracle to produce. The box ' +
      'row is scored against brute force on the first ' + VERIFY + ' queries; being exact, it is then the ' +
      'oracle for the other two over all ' + QUERIES + '. The plane and box rows are identical on answers and ' +
      'differ by 3.5× on cost.');
  }

  function labelFor(bound) {
    if (bound === 'descent') return 'descent only — no backtrack';
    if (bound === 'plane') return 'splitting plane';
    return 'subtree bounding box';
  }

  function paintDimensions(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.dims + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.distancesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.scanFraction, 1) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.prunedPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.nodes) + '</td></tr>';
    }).join('');

    root.jQuery('#kdt-dims-table tbody').html(html);
    root.jQuery('#kdt-dims-table-note').text('The pruned column is the mechanism failing rather than the ' +
      'symptom: it rises to a peak at eight dimensions and then collapses to zero, because the volume of a ' +
      'ball of the search radius becomes a vanishing fraction of the box that contains it and every subtree ' +
      'intersects it. The tree, the algorithm and the bound are unchanged throughout — only the dimension ' +
      'moves.');
  }

  function drawDimensions(app, rows) {
    chart = root.ErrorBandView.curve(root.jQuery('#kdt-dims-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logX: true,
      yMax: 1,
      legendHost: root.jQuery('#kdt-dims-legend')[0],
      xLabel: 'dimensions (log scale)',
      yLabel: 'fraction of the data touched',
      markers: [{ x: 16, label: '99.5% at d = 16' }],
      series: [
        { label: 'fraction of 4 000 points measured', points: rows.map(function (r) { return { x: r.dims, y: r.scanFraction }; }), width: 3 }
      ]
    });

    root.jQuery('#kdt-dims-note').text('Same 4 000 points, same correct algorithm, same leaf size — only the ' +
      'dimension changes. The curve reaches 1.0 and stays there, which means the index is a linear scan with ' +
      'a tree walk added on top. That is the point at which 8.8 stops asking for exactness.');
  }

  function drawMap(app, kind, leafSize, run) {
    const points = pointsFor(kind);
    const tree = root.KdTree.build(points, { leafSize: leafSize });
    const centre = queriesFor('q')[0];
    const found = tree.kNearest(centre.p, 10, run.bound);

    map = root.SpatialView.render(root.jQuery('#kdt-map')[0], {
      height: 320,
      bounds: root.SpatialLab.BOUNDS,
      segments: root.SpatialView.planeSegments(tree.planes(4000)),
      points: points,
      results: found.map(function (entry) { return entry.point; }),
      query: { kind: 'circle', x: centre.x, y: centre.y, r: found.length ? found[found.length - 1].distance : 1 },
      summary: 'The splitting planes of a k-d tree over ' + root.Format.exact(points.length) +
        ' points, with the ten nearest neighbours of one query highlighted.'
    });

    root.jQuery('#kdt-map-note').text('Every line is a splitting plane, clipped to the box of the subtree it ' +
      'divides; the circle is the distance to the tenth nearest neighbour found. On collinear points the ' +
      'planes on one axis do nothing at all, which is the degenerate case worth looking at — the tree is ' +
      'still balanced and half its levels are wasted.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
