/**
 * Section: R-trees and rectangle indexes.
 *
 * Five builds of one rectangle set at one fan-out, so the only thing that
 * varies is the heuristic - which is what makes "overlap decides query cost,
 * not height" a measurement rather than an assertion. The demo runs the worked
 * example's parameters: 20 000 rectangles of side about 12 and 200 window
 * queries of side 60.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'r-trees';
  const COUNT = 20000;
  const QUERIES = 200;
  const BUILDS = ['firstfit', 'linear', 'quadratic', 'rstar', 'str'];
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
        'An R-tree *covers* space rather than partitioning it: every node stores the smallest rectangle ' +
          'containing its children, and two siblings are allowed to overlap. That single difference decides ' +
          'everything. A quadtree or a k-d tree sends a point query down one path; an R-tree may have to follow ' +
          'several, so the height is nearly irrelevant and the overlap is decisive — and the split heuristic, ' +
          'which is what creates the overlap, is the whole design.',
        'Four heuristics on the same 20 000 rectangles at the same fan-out produce the same height 6 and a 9.7× ' +
          'range in node visits, ordered exactly by overlap: 113.69% for a naive first-fit cut, 57.67% linear, ' +
          '59.58% quadratic and 24.49% for R*. Note the pair in the middle. Guttman argued the O(M²) quadratic ' +
          'pick was worth its cost; on this data the O(M) linear pick beats it on both overlap and query cost, ' +
          'which is worth checking on your own rectangles before paying for it.',
        'Bulk loading removes the splits rather than improving them. Sort-tile-recursive packing fills pages to ' +
          '98.6% against an incremental build\'s 69.7%, so the tree is one level shorter, and it answers the ' +
          'same queries in 28.43 node visits against 85.32 — a factor of three, and effectively a draw with a ' +
          'properly tuned R*. Since every insertion adds overlap and nothing removes it, most systems schedule ' +
          'a rebuild rather than tune the split further.'
      ],
      demo: { title: 'Interactive demo — five builds, one rectangle set', markup: root.RTreesTemplate.render() },
      diagram: {
        title: 'Diagram — nested MBRs across two levels',
        caption: 'Sibling rectangles may intersect. A query landing in the shaded intersection has to descend ' +
          'into both subtrees, which is why the total sibling overlap predicts the query cost and the height ' +
          'does not.',
        definition: [
          'flowchart TD',
          '    R["root MBR<br/>0,0 – 1000,1000"] --> A["child A<br/>0,0 – 560,520"]',
          '    R --> B["child B<br/>440,0 – 1000,520<br/>overlaps A on x 440–560"]',
          '    R --> C["child C<br/>0,480 – 1000,1000"]',
          '    A --> A1["leaf · 9 rectangles"]',
          '    A --> A2["leaf · 8 rectangles"]',
          '    B --> B1["leaf · 9 rectangles"]',
          '    B --> B2["leaf · 7 rectangles"]',
          '    Q["point query in the 440–560 strip"] --> A',
          '    Q --> B'
        ].join('\n')
      },
      insight: 'R-tree query cost is governed by MBR overlap, not by height — two trees with the same data, the ' +
        'same fan-out and the same height can differ tenfold. And bulk loading beats incremental insertion so ' +
        'consistently that most systems rebuild rather than maintain: insertion adds overlap monotonically, ' +
        'nothing removes it, and a periodic O(n log n) rebuild is cheaper than the accumulated tax. If you are ' +
        'tuning a split heuristic before you have measured the overlap, you are tuning the wrong thing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const rectanglesFor = root.Helpers.memoise(function (size) {
    return root.SpatialLab.rectangles({
      count: COUNT, seed: 4, bounds: root.SpatialLab.BOUNDS, size: Number(size)
    });
  });

  const windowsFor = root.Helpers.memoise(function (side) {
    return root.SpatialLab.windows({
      count: QUERIES, bounds: root.SpatialLab.BOUNDS, seed: 4, side: Number(side)
    });
  });

  /* All five builds in one memoised measurement: the table shows all of them,
     and building four trees over 20 000 rectangles is the expensive part. */
  const buildsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const rects = rectanglesFor(parts[1]);
    const windows = windowsFor(parts[2]);
    return BUILDS.map(function (build) {
      const tree = build === 'str'
        ? root.RTree.bulkLoad(rects, { maxEntries: Number(parts[0]) })
        : insertAll(rects, Number(parts[0]), build);
      /* Captured before the query run: runQueries resets the counters, so
         reading them afterwards reports zero splits for every build. */
      const built = tree.stats();
      const run = root.SpatialLab.runQueries({ index: tree, points: rects, queries: windows });
      return { build: build, tree: tree, shape: tree.shape(), run: run, stats: built };
    });
  });

  function insertAll(rects, maxEntries, split) {
    const tree = root.RTree.create({ maxEntries: maxEntries, split: split });
    tree.insertAll(rects);
    return tree;
  }

  function update(app) {
    const values = panel.values();
    const builds = buildsFor(values['rt-fanout'] + '|' + values['rt-size'] + '|' + values['rt-window']);
    const chosen = builds.filter(function (row) { return row.build === values['rt-split']; })[0];

    paintMetrics(chosen);
    paintCompare(builds, chosen);
    paintReport(chosen, values);
    drawChart(app, builds, chosen);
    drawMap(app, chosen, {
      level: Number(values['rt-level']), side: values['rt-window'], size: values['rt-size']
    });
  }

  function labelFor(build) {
    return {
      firstfit: 'first-fit (naive)', linear: 'Guttman linear', quadratic: 'Guttman quadratic',
      rstar: 'R* with reinsertion', str: 'STR bulk load'
    }[build];
  }

  function paintMetrics(row) {
    root.MetricGrid.update({
      'rt-overlap': {
        value: root.Format.percent(row.shape.overlapRatio, 2),
        note: root.Format.exact(row.shape.overlap) + ' units of intersecting area over ' +
          root.Format.exact(row.shape.siblingPairs) + ' sibling pairs'
      },
      'rt-visits': {
        value: root.Format.fixed(row.run.nodesVisited / QUERIES, 2),
        note: 'height ' + row.shape.height + ', ' + root.Format.exact(row.shape.nodes) + ' nodes'
      },
      'rt-fill': {
        value: root.Format.percent(row.shape.fill, 1),
        note: root.Format.exact(row.shape.leaves) + ' leaves at ' + row.tree.maxEntries + ' entries each'
      },
      'rt-candidates': {
        value: root.Format.fixed(row.run.candidatesPerQuery, 2),
        note: root.Format.fixed(row.run.resultsPerQuery, 2) + ' results — ' +
          root.Format.fixed(row.run.candidatesPerResult, 2) + ' tested per result'
      }
    });
  }

  function paintCompare(builds, chosen) {
    const html = builds.map(function (row) {
      const here = row.build === chosen.build;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + labelFor(row.build) + '</td>' +
        '<td class="mono">' + row.shape.height + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.nodes) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.shape.fill, 1) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.shape.overlapRatio, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.run.nodesVisited / QUERIES, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.run.candidatesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.run.resultsPerQuery, 2) + '</td>' +
        '<td class="mono">' + row.run.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#rt-compare tbody').html(html);
    root.jQuery('#rt-compare-note').text('Every row holds the same rectangles and returns the same answers — ' +
      'the "wrong" column is queries that disagreed with a brute-force scan, and it is zero throughout. The ' +
      'incremental builds all reach the same height, so nothing in the cost column is explained by depth. ' +
      'Sort the table mentally by overlap and by nodes visited: the two orders are the same.');
  }

  function paintReport(row, values) {
    root.jQuery('#rt-report').text([
      labelFor(row.build) + ', fan-out ' + row.tree.maxEntries + ', minimum fill ' + row.tree.minEntries,
      '',
      '  rectangles indexed:   ' + root.Format.exact(row.shape.items) + ' of side about ' + values['rt-size'],
      '  tree:                 ' + root.Format.exact(row.shape.nodes) + ' nodes, ' +
        root.Format.exact(row.shape.leaves) + ' leaves, height ' + row.shape.height,
      '  leaf fill:            ' + root.Format.percent(row.shape.fill, 1),
      '  sibling overlap:      ' + root.Format.exact(row.shape.overlap) + ' area units, ' +
        root.Format.percent(row.shape.overlapRatio, 2) + ' of coverage',
      '  splits performed:     ' + root.Format.exact(row.stats.splits),
      '  forced reinsertions:  ' + root.Format.exact(row.stats.reinsertions),
      '  memory:               ' + root.Format.bytes(row.shape.bytes),
      '',
      '  window queries:       ' + QUERIES + ' of side ' + values['rt-window'],
      '  nodes visited:        ' + root.Format.fixed(row.run.nodesVisited / QUERIES, 2) + ' per query',
      '  rectangles tested:    ' + root.Format.fixed(row.run.candidatesPerQuery, 2) + ' per query',
      '  results returned:     ' + root.Format.fixed(row.run.resultsPerQuery, 2) + ' per query',
      '  disagreements with brute force: ' + row.run.wrong
    ].join('\n'));

    root.jQuery('#rt-report-note').text('The reinsertion line is only non-zero for R*, and it is where most of ' +
      'that build\'s advantage comes from: a split can only divide the entries a node happens to hold, so a ' +
      'rectangle placed badly when the tree was small stays badly placed and is split around forever. STR ' +
      'reports no splits at all, because it never performs one — and it deliberately leaves the last page of ' +
      'each slice short, so Guttman\'s minimum-fill invariant does not apply to it.');
  }

  function drawChart(app, builds, chosen) {
    chart = root.ErrorBandView.curve(root.jQuery('#rt-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      legendHost: root.jQuery('#rt-chart-legend')[0],
      xLabel: 'sibling overlap as a fraction of coverage',
      yLabel: 'nodes visited per query',
      markers: [{ x: chosen.shape.overlapRatio, label: labelFor(chosen.build) }],
      series: [{
        label: 'the five builds, ordered by overlap',
        width: 3,
        points: builds.slice().sort(function (a, b) { return a.shape.overlapRatio - b.shape.overlapRatio; })
          .map(function (row) {
            return { x: row.shape.overlapRatio, y: row.run.nodesVisited / QUERIES };
          })
      }]
    });

    root.jQuery('#rt-chart-note').text('Five builds of one rectangle set, plotted as overlap against query ' +
      'cost. The relationship is close to linear and it is the reason overlap is the number to watch: it is ' +
      'computable from the tree alone, without running a single query, which makes it a health metric an index ' +
      'can export.');
  }

  function drawMap(app, row, view) {
    const levels = row.tree.levels();
    const depth = Math.min(view.level, levels.length - 1);
    const rects = rectanglesFor(view.size);
    const box = windowsFor(view.side)[0];

    /* Every twelfth rectangle, and the bounding boxes drawn in the strong
       tone: 20 000 centres at this scale are a solid grey mass that the MBRs -
       the entire subject of the picture - disappear into. */
    const sample = rects.filter(function (rect, index) { return index % 12 === 0; })
      .map(function (rect) { return { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 }; });

    map = root.SpatialView.render(root.jQuery('#rt-map')[0], {
      height: 340,
      bounds: root.SpatialLab.BOUNDS,
      boxes: levels[depth],
      boxTone: 'strong',
      points: sample,
      query: Object.assign({ kind: 'rect' }, box),
      pointRadius: 1,
      summary: 'The ' + labelFor(row.build) + ' tree\'s bounding rectangles at level ' + depth +
        ', over a twelfth of the ' + root.Format.exact(rects.length) + ' indexed rectangles.'
    });

    root.jQuery('#rt-map-note').text('Level ' + depth + ' of ' + (levels.length - 1) + ': ' +
      root.Format.exact(levels[depth].length) + ' bounding rectangles, over a sample of the indexed ' +
      'rectangles\' centres. Switch between first-fit and R* at level 2 or 3 and the difference is visible ' +
      'without reading a number — first-fit produces long thin rectangles that cross the whole domain, and ' +
      'every one of them is a subtree some query landing in it has to enter.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
