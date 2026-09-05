/**
 * Section: quadtrees, octrees and loose quadtrees.
 *
 * The demo uses the worked examples' parameters - 20 000 clustered points, a
 * capacity sweep from 2 to 64, 200 radius-25 queries - so the table on screen
 * is the table the prose quotes. The coincident-point panel is the one that
 * matters: it is the input for which the textbook split rule does not
 * terminate, and the depth cap is shown doing nothing except stopping it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'quadtrees';
  const COUNT = 20000;
  const QUERIES = 200;
  const CAPACITIES = [2, 4, 8, 16, 32, 64];
  const DEPTH_CAPS = [8, 12, 16, 20];
  const BOXES = 5000;
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
        'A quadtree subdivides *space* rather than the data. A node owns a square, and when it ' +
          'holds more than its capacity it splits into four children of a quarter the area. That ' +
          'is the one structural difference from a k-d tree, and everything else follows from it. ' +
          'The square is computable from the path with nothing stored, the tree adapts to where ' +
          'the points are, and the depth is unbounded when points crowd together. At capacity 8, ' +
          '20 000 clustered points build 7 721 nodes and reach depth 11; the same count uniform ' +
          'reaches depth 7.',
        'The capacity is not really a query-cost dial. Across a 32-fold change the candidates a ' +
          'query tests move from 50.31 to 87.73, a factor of 1.74. Over the same range the node ' +
          'count falls 25×, the memory falls 3.6× and the node visits fall 7.4×. Anything between ' +
          'about 4 and 16 is defensible, and the choice should be made on what a node costs in ' +
          'your memory layout rather than on the candidate column.',
        'The depth cap is a correctness requirement, not a tuning knob. Coincident points never separate, so ' +
          '"split until a leaf holds at most `capacity`" has no fixed point and recurses until the stack dies. ' +
          'The fix is two rules together: cap the depth *and* let the leaf bucket overflow once the cap is ' +
          'reached. Raising the cap on 20 000 points sitting on three locations adds 12 nodes per level and ' +
          'leaves the same 6 667-point leaf at every setting.'
      ],
      demo: { title: 'Interactive demo — subdivision, capacity and the degenerate input', markup: root.QuadtreesTemplate.render() },
      diagram: {
        title: 'Diagram — quadrant subdivision mapped to the plane',
        caption: 'Each node owns a square and splits into four of a quarter the area. A node\'s square is ' +
          'implied by its path from the root, which is why nothing has to be stored for it — and why the ' +
          'splits cannot move to follow the data.',
        definition: [
          'flowchart TD',
          '    R["root — 0,0 to 1000,1000<br/>28 points, capacity 8"] --> NW["NW — 0,500 to 500,1000<br/>3 points"]',
          '    R --> NE["NE — 500,500 to 1000,1000<br/>21 points → splits"]',
          '    R --> SW["SW — 0,0 to 500,500<br/>2 points"]',
          '    R --> SE["SE — 500,0 to 1000,500<br/>2 points"]',
          '    NE --> A["NE.NW — 6 points"]',
          '    NE --> B["NE.NE — 9 points → splits"]',
          '    NE --> C["NE.SW — 4 points"]',
          '    NE --> D["NE.SE — 2 points"]'
        ].join('\n')
      },
      insight: 'Coincident points are what actually breaks quadtrees in production, and they are ' +
        'not exotic. Rounded GPS fixes, default positions, grid-snapped level data and any integer ' +
        'coordinate system produce them by the thousand. A depth cap with an overflowing bucket is ' +
        'not an optimisation; it is what makes insertion terminate. A test suite for a quadtree ' +
        'that has no coincident-point case has not tested the thing most likely to take it down.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.QuadtreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const pointsFor = root.Helpers.memoise(function (kind) {
    return root.SpatialLab.points({
      kind: kind, count: COUNT, seed: 1, distinct: 3, bounds: root.SpatialLab.BOUNDS
    });
  });

  const queriesFor = root.Helpers.memoise(function () {
    return root.SpatialLab.queries({ count: QUERIES, bounds: root.SpatialLab.BOUNDS, seed: 1 });
  });

  const boxesFor = root.Helpers.memoise(function () {
    return root.SpatialLab.rectangles({ count: BOXES, seed: 2, bounds: root.SpatialLab.BOUNDS, size: 60 });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return CAPACITIES.map(function (capacity) {
      const tree = root.Quadtree.create({
        bounds: root.SpatialLab.BOUNDS, capacity: capacity, maxDepth: Number(parts[1])
      });
      tree.insertAll(pointsFor(parts[0]));
      const run = root.SpatialLab.runQueries({
        index: tree, points: pointsFor(parts[0]), queries: queriesFor('q'), radius: Number(parts[2])
      });
      return { capacity: capacity, shape: tree.shape(), run: run, tree: tree };
    });
  });

  const coincidentFor = root.Helpers.memoise(function (capacity) {
    const list = root.SpatialLab.points({
      kind: 'coincident', count: COUNT, distinct: 3, seed: 2, bounds: root.SpatialLab.BOUNDS
    });
    return DEPTH_CAPS.map(function (cap) {
      const tree = root.Quadtree.create({
        bounds: root.SpatialLab.BOUNDS, capacity: Number(capacity), maxDepth: cap
      });
      tree.insertAll(list);
      return { cap: cap, shape: tree.shape() };
    });
  });

  const looseFor = root.Helpers.memoise(function () {
    const boxes = boxesFor('b');
    const windows = root.SpatialLab.windows({ count: 100, bounds: root.SpatialLab.BOUNDS, seed: 2, side: 60 });
    return [1, 1.5, 2].map(function (looseness) {
      const tree = root.Quadtree.create({
        bounds: root.SpatialLab.BOUNDS, capacity: 8, maxDepth: 12, looseness: looseness
      });
      tree.insertAll(boxes);
      const run = root.SpatialLab.runQueries({ index: tree, points: boxes, queries: windows });
      return { looseness: looseness, shape: tree.shape(), run: run };
    });
  });

  function update(app) {
    const values = panel.values();
    const kind = values['qt-kind'];
    const capacity = Number(values['qt-capacity']);
    const depth = Number(values['qt-depth']);
    const radius = Number(values['qt-radius']);
    const sweep = sweepFor(kind + '|' + depth + '|' + radius);
    const current = nearestCapacity(sweep, capacity);

    paintMetrics(current, depth);
    paintSweepTable(sweep, current);
    paintCoincident(coincidentFor(String(capacity)));
    paintLoose(looseFor('l'), Number(values['qt-loose']));
    drawSweep(app, sweep, current);
    drawMap(app, { kind: kind, capacity: capacity, depth: depth, radius: radius });
  }

  function nearestCapacity(sweep, capacity) {
    let best = sweep[0];
    sweep.forEach(function (row) {
      if (Math.abs(row.capacity - capacity) < Math.abs(best.capacity - capacity)) best = row;
    });
    return best;
  }

  function paintMetrics(row, depthCap) {
    root.MetricGrid.update({
      'qt-nodes': {
        value: root.Format.exact(row.shape.nodes),
        note: root.Format.exact(row.shape.emptyLeaves) + ' of ' + root.Format.exact(row.shape.leaves) + ' leaves hold nothing'
      },
      'qt-depth-reached': {
        value: row.shape.maxDepth + ' of ' + depthCap,
        note: 'largest leaf holds ' + root.Format.exact(row.shape.largestLeaf) + ' points'
      },
      'qt-candidates': {
        value: root.Format.fixed(row.run.candidatesPerQuery, 2),
        note: root.Format.fixed(row.run.nodesVisited / QUERIES, 2) + ' nodes visited, ' +
          root.Format.fixed(row.run.nodesPruned / QUERIES, 2) + ' pruned'
      },
      'qt-bytes': {
        value: root.Format.fixed(row.shape.bytesPerItem, 1) + ' B',
        note: root.Format.bytes(row.shape.bytes) + ' for ' + root.Format.exact(row.shape.items) + ' points'
      }
    });
  }

  function paintSweepTable(sweep, current) {
    const html = sweep.map(function (row) {
      const here = row.capacity === current.capacity;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.capacity + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.leaves) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.emptyLeaves) + '</td>' +
        '<td class="mono">' + row.shape.maxDepth + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.largestLeaf) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.run.candidatesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.run.nodesVisited / QUERIES, 2) + '</td>' +
        '<td class="mono">' + root.Format.bytes(row.shape.bytes) + '</td></tr>';
    }).join('');

    root.jQuery('#qt-sweep-table tbody').html(html);
    root.jQuery('#qt-sweep-table-note').text('Read the candidate column against the node column. The first ' +
      'barely moves and the second changes by more than an order of magnitude, which is what makes the ' +
      'capacity a memory-and-traversal decision rather than a query-cost one. The empty-leaf column is the ' +
      'quadtree\'s characteristic waste: a split is triggered by one crowded quadrant and pays for all four.');
  }

  function paintCoincident(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.cap + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.nodes) + '</td>' +
        '<td class="mono">' + row.shape.maxDepth + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.largestLeaf) + '</td>' +
        '<td class="mono">' + root.Format.bytes(row.shape.bytes) + '</td></tr>';
    }).join('');

    root.jQuery('#qt-coincident tbody').html(html);
    root.jQuery('#qt-coincident-note').text('20 000 points on three distinct locations, at the leaf capacity ' +
      'the slider is set to. The largest leaf never shrinks however deep the tree is allowed to go, because ' +
      'the subdivision is of space and the points occupy none. Every extra level costs four nodes per ' +
      'distinct site and buys nothing at all — which is exactly why the cap belongs in the correctness ' +
      'argument rather than the tuning section.');
  }

  function paintLoose(rows, chosen) {
    const lines = rows.map(function (row) {
      const marker = row.looseness === chosen ? ' ←' : '';
      return 'looseness ' + row.looseness.toFixed(1) +
        '   nodes ' + String(row.shape.nodes).padStart(5) +
        '   items held above a leaf ' + root.Format.percent(row.shape.itemsAtInternal / BOXES, 1).padStart(7) +
        '   candidates/query ' + root.Format.fixed(row.run.candidatesPerQuery, 2).padStart(9) + marker;
    });

    root.jQuery('#qt-loose-report').text([
      String(BOXES) + ' boxes of side about 60 in a 1 000-unit world, capacity 8, depth cap 12',
      ''
    ].concat(lines).concat([
      '',
      'results per query: ' + root.Format.fixed(rows[0].run.resultsPerQuery, 2) + ' — identical for all three'
    ]).join('\n'));

    root.jQuery('#qt-loose-note').text('An object with size does not fit any child once it crosses a midline, ' +
      'so a tight tree strands it at the parent and every query near that boundary tests it. Inflating the ' +
      'boxes pushes most of them back down, at the cost of siblings that now overlap — and the two effects ' +
      'fight, so the result is not monotone in the looseness. Note the node counts: five levels whatever the ' +
      'depth cap says, because in a loose tree an object\'s level is set by its size.');
  }

  function drawSweep(app, sweep, current) {
    chart = root.ErrorBandView.curve(root.jQuery('#qt-sweep-chart')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      logY: true,
      legendHost: root.jQuery('#qt-sweep-legend')[0],
      xLabel: 'leaf capacity',
      yLabel: 'per query, and nodes (log scale)',
      markers: [{ x: current.capacity, label: 'capacity ' + current.capacity }],
      series: [
        { label: 'candidates per query', points: sweep.map(function (r) { return { x: r.capacity, y: r.run.candidatesPerQuery }; }), width: 3 },
        { label: 'nodes visited per query', points: sweep.map(function (r) { return { x: r.capacity, y: r.run.nodesVisited / QUERIES }; }) },
        { label: 'nodes in the tree', points: sweep.map(function (r) { return { x: r.capacity, y: r.shape.nodes }; }), dashed: true }
      ]
    });

    root.jQuery('#qt-sweep-note').text('On a log axis the flatness of the candidate curve against the slope ' +
      'of the node curve is the whole point: the leaf bucket is a memory dial that costs a little accuracy at ' +
      'the leaves, not a query-cost dial.');
  }

  function drawMap(app, view) {
    const points = pointsFor(view.kind);
    const tree = root.Quadtree.create({
      bounds: root.SpatialLab.BOUNDS, capacity: view.capacity, maxDepth: view.depth
    });
    tree.insertAll(points);
    const centre = queriesFor('q')[0];
    const results = tree.queryRadius(centre, view.radius);
    const boxes = tree.snapshot(6000).map(function (node) { return node.box; });

    map = root.SpatialView.render(root.jQuery('#qt-map')[0], {
      height: 320,
      bounds: root.SpatialLab.BOUNDS,
      boxes: boxes,
      points: points,
      results: results,
      query: { kind: 'circle', x: centre.x, y: centre.y, r: view.radius },
      summary: 'The quadtree subdivision over ' + root.Format.exact(points.length) +
        ' points at capacity ' + view.capacity + ', with one radius-' + view.radius + ' query drawn.'
    });

    root.jQuery('#qt-map-note').text('Every rectangle is a node. Where the points crowd, the squares get ' +
      'small; where they do not, one square covers everything — which is the adaptation a grid cannot make. ' +
      'The drawing is capped at 6 000 boxes, and at capacity 1 or 2 the tree has more than that, so the ' +
      'deepest nodes are not all shown.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
