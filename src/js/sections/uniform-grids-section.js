/**
 * Section: uniform grids and spatial hashing.
 *
 * The demo runs the worked example's parameters - 20 000 points in a
 * 1 000 x 1 000 domain, 200 radius-25 queries - so the numbers on screen are
 * the numbers the prose quotes. The two measurements are memoised separately,
 * because moving the hash table size must not re-run the whole cell sweep.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'uniform-grids';
  const COUNT = 20000;
  const QUERIES = 200;
  const CELL_SIZES = [5, 10, 15, 20, 25, 35, 50, 75, 100, 150, 200];
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
        'A grid has no tree, nothing to balance and nothing to compare: two divisions give the cell, the ' +
          'bucket is an array offset, and a query reads only the cells its own box touches. On evenly dense ' +
          'data that constant factor beats every tree in this milestone. 20 000 uniform points in a ' +
          '1 000 × 1 000 domain with 25-unit cells answer a radius-25 query by reading 9 cells and testing ' +
          '109.98 points to return 38.48 — against a prediction of 112.50 from density alone.',
        'The cell size is a genuine minimum rather than a rule of thumb. Small cells scan many nearly empty ' +
          'buckets and large cells scan few buckets full of far-away objects, so the total has a knee: the ' +
          'measured optimum here is a cell of 15 at 101.06 units of work, against 118.98 at the folklore c = r ' +
          'and 1 150.00 at c = 200. The prediction is exact when the cell divides the query diameter and an ' +
          'over-estimate otherwise, because it is a worst case over alignments.',
        'Everything a grid gets wrong follows from the cells being fixed before the data arrives. Cluster the ' +
          'same 20 000 points and the sizing formula still says 112.50 while the measurement says 148.19, ' +
          'because a query meets local density and the formula knows only the mean — one bucket holds 269 ' +
          'points against a mean of 12.5. Hashing the cell coordinate removes the bounded domain and adds ' +
          'collisions: at 1 600 occupied cells and a 256-entry table, 86.3% of everything a query touches is a ' +
          'phantom.'
      ],
      demo: { title: 'Interactive demo — the cells, the sweep and the prediction', markup: root.UniformGridsTemplate.render() },
      diagram: {
        title: 'Diagram — a query circle overlapping four cells',
        caption: 'The query reads whole cells, so it tests every object in all nine cells its bounding box ' +
          'touches and then measures each against the circle. The ratio of the two is the only number that ' +
          'says whether the cell size is right.',
        definition: [
          'flowchart LR',
          '    Q["radius query at (x, y)"] --> B["bounding box x±r, y±r"]',
          '    B --> C["cells ⌊(x−r)/c⌋ … ⌊(x+r)/c⌋"]',
          '    C --> S1["cell (3,4): 12 points"]',
          '    C --> S2["cell (4,4): 14 points"]',
          '    C --> S3["cell (3,5): 11 points"]',
          '    C --> S4["cell (4,5): 13 points"]',
          '    S1 --> T["50 candidates measured against the circle"]',
          '    S2 --> T',
          '    S3 --> T',
          '    S4 --> T',
          '    T --> R["38 results returned"]'
        ].join('\n')
      },
      insight: 'For uniformly dense data a grid beats every tree in this milestone, and the trees earn their ' +
        'keep only when density varies. The cheapest way to know which case you are in costs one line: compute ' +
        'what a uniform grid should test from density and radius, and compare it with what it actually tested. ' +
        'Agreement means the grid is the right structure; disagreement is the signal to move to a quadtree or a ' +
        'k-d tree, and it arrives long before a user notices a slow tail.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.UniformGridsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const pointsFor = root.Helpers.memoise(function (kind) {
    return root.SpatialLab.points({ kind: kind, count: COUNT, seed: 1, bounds: root.SpatialLab.BOUNDS });
  });

  const queriesFor = root.Helpers.memoise(function () {
    return root.SpatialLab.queries({ count: QUERIES, bounds: root.SpatialLab.BOUNDS, seed: 1 });
  });

  /* Keyed on the three controls the sweep depends on. Changing the hash table
     size must not re-run eleven grids over 20 000 points. */
  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SpatialLab.cellSweep({
      points: pointsFor(parts[0]), queries: queriesFor('q'),
      radius: Number(parts[1]), cellSizes: CELL_SIZES,
      bounds: root.SpatialLab.BOUNDS, mode: 'grid'
    });
  });

  /* The drawn grid is rebuilt only when the distribution or the cell size
     moves; 20 000 insertions on every slider tick is visible as a stutter. */
  const drawnGrid = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const index = root.SpatialHash.create({
      cellSize: Number(parts[1]), bounds: root.SpatialLab.BOUNDS, mode: 'grid'
    });
    index.insertAll(pointsFor(parts[0]));
    return index;
  });

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SpatialLab.compareIndexes({
      points: pointsFor(parts[0]), queries: queriesFor('q'), radius: Number(parts[1]),
      bounds: root.SpatialLab.BOUNDS, cellSize: Number(parts[2]), kinds: ['grid', 'quadtree', 'kdtree']
    });
  });

  const hashedFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const index = root.SpatialHash.create({
      cellSize: Number(parts[1]), bounds: root.SpatialLab.BOUNDS, mode: 'hash', buckets: Number(parts[3])
    });
    index.insertAll(pointsFor(parts[0]));
    const run = root.SpatialLab.runQueries({
      index: index, points: pointsFor(parts[0]), queries: queriesFor('q'), radius: Number(parts[2])
    });
    return { run: run, occupancy: index.occupancy() };
  });

  function update(app) {
    const values = panel.values();
    const kind = values['ug-kind'];
    const cell = Number(values['ug-cell']);
    const radius = Number(values['ug-radius']);
    const hashed = values['ug-mode'] === 'hash';
    const sweep = sweepFor(kind + '|' + radius);
    const row = closest(sweep.rows, cell);
    const extra = hashed ? hashedFor(kind + '|' + cell + '|' + radius + '|' + values['ug-buckets']) : null;

    paintMetrics(row, extra, hashed);
    paintSweepTable(sweep, row);
    paintCompare(compareFor(kind + '|' + radius + '|' + cell));
    drawSweep(app, sweep, row);
    drawMap(app, kind, { cell: cell, radius: radius, row: row });
  }

  function closest(rows, cell) {
    let best = rows[0];
    rows.forEach(function (row) {
      if (Math.abs(row.cellSize - cell) < Math.abs(best.cellSize - cell)) best = row;
    });
    return best;
  }

  function paintMetrics(row, extra, hashed) {
    const candidates = hashed ? extra.run.candidatesPerQuery : row.candidatesPerQuery;
    const memory = hashed ? extra.occupancy.bytes : row.occupancy.bytes;
    root.MetricGrid.update({
      'ug-candidates': {
        value: root.Format.fixed(candidates, 2),
        note: hashed
          ? 'plus ' + root.Format.fixed(extra.run.phantomCandidates / QUERIES, 2) + ' phantoms from bucket collisions'
          : root.Format.fixed(row.cellsScanned / QUERIES, 2) + ' cells read per query'
      },
      'ug-selectivity': {
        value: root.Format.fixed(candidates / Math.max(row.resultsPerQuery, 1e-9), 2) + '×',
        note: root.Format.fixed(row.resultsPerQuery, 2) + ' results returned per query'
      },
      'ug-predicted': {
        value: root.Format.fixed(row.predictedCandidates, 2),
        note: 'measured is ' + root.Format.percent((row.candidatesPerQuery - row.predictedCandidates) /
          row.predictedCandidates, 1) + ' from it'
      },
      'ug-memory': {
        value: root.Format.bytes(memory),
        note: hashed
          ? root.Format.exact(extra.occupancy.used) + ' of ' + root.Format.exact(extra.occupancy.buckets) + ' buckets used'
          : root.Format.exact(row.occupancy.used) + ' of ' + root.Format.exact(row.occupancy.buckets) + ' cells occupied'
      }
    });
  }

  function paintSweepTable(sweep, current) {
    const rows = sweep.rows.map(function (row) {
      const here = row.cellSize === current.cellSize;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.cellSize + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.cellsScanned / QUERIES, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.candidatesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.predictedCandidates, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.resultsPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.candidatesPerQuery / Math.max(row.resultsPerQuery, 1e-9), 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.work, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#ug-sweep-table tbody').html(rows);
    root.jQuery('#ug-sweep-table-note').text('The predicted column is computed from the point density and the ' +
      'query radius alone and knows nothing about where the points are. It agrees with the measurement to ' +
      'within a few percent exactly when the cell divides the query diameter — the formula rounds the scanned ' +
      'region out to whole cells, so it is a worst case over alignments everywhere else. On clustered points ' +
      'it stays where it was and the measurement leaves it, which is the whole diagnostic.');
  }

  function paintCompare(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.kind + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.candidatesPerQuery, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.candidatesPerResult, 2) + '</td>' +
        '<td class="mono">' + root.Format.bytes(row.bytes) + '</td>' +
        '<td class="mono">' + row.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#ug-compare tbody').html(html);
    root.jQuery('#ug-compare-note').text('Every row returns the identical answer — the "wrong answers" column ' +
      'is the count of queries that disagreed with a brute-force scan, and it is zero for all three. The ' +
      'ordering flips with the distribution: on uniform points the grid is within 1.5× of the trees at a ' +
      'fraction of the memory, and on clustered points it tests two and a half times as many candidates as ' +
      'either of them.');
  }

  function drawSweep(app, sweep, current) {
    chart = root.ErrorBandView.curve(root.jQuery('#ug-sweep-chart')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      logY: true,
      legendHost: root.jQuery('#ug-sweep-legend')[0],
      xLabel: 'cell size',
      yLabel: 'per query (log scale)',
      markers: [{ x: sweep.best.cellSize, label: 'minimum at ' + sweep.best.cellSize }],
      series: [
        { label: 'cells read', points: sweep.rows.map(function (row) { return { x: row.cellSize, y: row.cellsScanned / QUERIES }; }) },
        { label: 'candidates tested', points: sweep.rows.map(function (row) { return { x: row.cellSize, y: row.candidatesPerQuery }; }) },
        { label: 'total work', points: sweep.rows.map(function (row) { return { x: row.cellSize, y: row.work }; }), width: 3 },
        { label: 'results returned', points: sweep.rows.map(function (row) { return { x: row.cellSize, y: row.resultsPerQuery }; }), dashed: true }
      ]
    });

    root.jQuery('#ug-sweep-note').text('The two costs move in opposite directions, so the total really has a ' +
      'minimum — here at a cell of ' + sweep.best.cellSize + ', costing ' + root.Format.fixed(sweep.best.work, 2) +
      ' against ' + root.Format.fixed(current.work, 2) + ' at the selected size. The dashed line is the answer ' +
      'itself, which is flat: every cell size returns the same points and only the work to find them changes.');
  }

  function drawMap(app, kind, view) {
    const points = pointsFor(kind);
    const centre = queriesFor('q')[0];
    const index = drawnGrid(kind + '|' + view.cell);
    index.resetStats();
    const rect = {
      minX: centre.x - view.radius, minY: centre.y - view.radius,
      maxX: centre.x + view.radius, maxY: centre.y + view.radius
    };
    const results = index.queryRadius(centre, view.radius);

    map = root.SpatialView.render(root.jQuery('#ug-map')[0], {
      height: 320,
      bounds: root.SpatialLab.BOUNDS,
      points: points,
      results: results,
      scanned: index.cellsFor(rect),
      query: { kind: 'circle', x: centre.x, y: centre.y, r: view.radius },
      summary: 'A ' + view.cell + '-unit grid over ' + root.Format.exact(points.length) +
        ' points, with the cells one radius-' + view.radius + ' query reads shaded.'
    });

    root.jQuery('#ug-map-note').text('The shaded squares are the cells this query reads; the highlighted ' +
      'points are what it returns. Everything else inside a shaded cell was taken out of a bucket, measured ' +
      'against the circle and thrown away — ' + root.Format.fixed(index.stats().candidatesTested, 0) +
      ' candidates for ' + results.length + ' results on this one query.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
