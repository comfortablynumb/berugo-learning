/**
 * Section: space-filling curves.
 *
 * The default window is the worked example's - an 18 x 17 rectangle at (9, 5)
 * on a 64 x 64 grid - so the 45 Morton ranges and 22 Hilbert ranges on screen
 * are the ones the prose quotes. The locality table exists because the usual
 * one-line summary of this subject is false under the obvious metric, and both
 * measurements are shown rather than the convenient one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'space-filling-curves';
  const BUDGETS = [2, 4, 8, 16, 32, 64];
  const LONDON = { lat: 51.5007, lon: -0.1246 };
  let panel = null;
  let map = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (map) map.redraw(); });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Interleave the bits of two coordinates and you have one integer that mostly preserves ' +
          'nearness. That is what lets a key-value store with no spatial support serve spatial ' +
          'queries. The curve index becomes the sort key, a rectangle becomes a set of key ranges, ' +
          'and a range scan is the one operation every ordered store already does well. DynamoDB, ' +
          'Bigtable, Elasticsearch and Redis geo layouts are Z-order or S2 underneath.',
        'The problem is that a rectangle is almost never one contiguous run. An 18 × 17 window of ' +
          '306 cells on a 64 × 64 grid decomposes into 45 separate Z-order ranges spanning 772 ' +
          'indices, or 22 Hilbert ranges spanning 758. So an exact answer means 45 round trips, ' +
          'and one scan of the whole span means reading 772 cells to get 306. Every real query ' +
          'planner is negotiating between those two numbers with a range budget.',
        'The sentence "Hilbert has better locality" is false under the obvious metric and true ' +
          'under the one that decides query cost. The mean index gap between two cells that are ' +
          'neighbours in space is 39.05 for Hilbert and 32.50 for Z-order. The worst is 3 413 ' +
          'against 1 366, so Z-order wins both. But the number a query pays is contiguous runs per ' +
          'window, and there a 16 × 16 window costs 15.68 Hilbert ranges against 29.49 Morton ' +
          'ones. Both statements are about locality and they point opposite ways.'
      ],
      demo: { title: 'Interactive demo — the curve, the window and the range budget', markup: root.SpaceFillingCurvesTemplate.render() },
      diagram: {
        title: 'Diagram — bit interleaving producing a Morton code',
        caption: 'x contributes the even bit positions and y the odd ones, from the most significant end down. ' +
          'That is why a prefix of the code is a bounding box: dropping trailing bits drops precision from ' +
          'both axes at once.',
        definition: [
          'flowchart LR',
          '    X["x = 5 = 1 0 1"] --> S["spread x → _1_0_1"]',
          '    Y["y = 3 = 0 1 1"] --> T["spread y → 0_1_1_"]',
          '    S --> O["OR"]',
          '    T --> O',
          '    O --> C["code = 0 1 1 0 1 1 = 27"]',
          '    C --> P["prefix 01 → the quadrant x∈[4,7], y∈[0,3]"]'
        ].join('\n')
      },
      insight: 'This is how a key-value store with no spatial index still serves spatial queries, and it is why ' +
        'geohash, S2 and H3 exist. Two things are worth carrying away. First, the decomposition is ' +
        'the whole problem: the encoding is ten lines and the range count is what a query costs. ' +
        'Second, when someone says a curve has "better locality", ask which metric. The two ' +
        'obvious ones disagree here, and only one of them is in anybody\'s cost model.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SpaceFillingCurvesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const pathFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SpaceFilling.path({ order: Number(parts[0]), curve: parts[1] });
  });

  const localityFor = root.Helpers.memoise(function (order) {
    return ['morton', 'hilbert'].map(function (curve) {
      return Object.assign(
        root.SpaceFilling.locality({ order: Number(order), curve: curve }),
        { windows: [4, 8, 16].map(function (side) {
          return root.SpaceFilling.windowRanges({ order: Number(order), curve: curve, side: side });
        }) }
      );
    });
  });

  function rectFor(values, side) {
    const grid = 1 << Number(values['sfc-order']);
    const width = Math.min(Number(values['sfc-side']), grid);
    const height = Math.min(side, grid);
    const x0 = Math.min(Number(values['sfc-x']), grid - width);
    const y0 = Math.min(Number(values['sfc-y']), grid - height);
    return { x0: x0, y0: y0, x1: x0 + width - 1, y1: y0 + height - 1 };
  }

  function update(app) {
    const values = panel.values();
    const order = Number(values['sfc-order']);
    /* The worked example's window is 18 wide and 17 tall; one slider drives
       the width and the height follows it so the default reproduces exactly. */
    const rect = rectFor(values, Number(values['sfc-side']) - 1);
    const budget = Number(values['sfc-budget']);

    const decompositions = {};
    ['morton', 'hilbert'].forEach(function (curve) {
      decompositions[curve] = root.SpaceFilling.decompose(rect, { order: order, curve: curve });
    });
    const chosen = decompositions[values['sfc-curve']];
    const merged = root.SpaceFilling.coalesce(chosen, budget);

    paintMetrics(chosen, merged);
    paintBudgets(decompositions, budget);
    paintLocality(localityFor(String(order)));
    paintGeohash();
    drawMap(app, { order: order, curve: values['sfc-curve'], rect: rect, merged: merged });
  }

  function paintMetrics(exact, merged) {
    root.MetricGrid.update({
      'sfc-ranges': {
        value: root.Format.exact(exact.ranges),
        note: 'for ' + root.Format.exact(exact.cells) + ' cells spanning ' + root.Format.exact(exact.span) + ' index positions'
      },
      'sfc-scanned': {
        value: root.Format.exact(merged.scanned),
        note: 'merged down to ' + root.Format.exact(merged.ranges) + ' ranges'
      },
      'sfc-waste': {
        value: root.Format.exact(merged.falsePositives),
        note: root.Format.percent(merged.falsePositives / Math.max(1, merged.cells), 1) + ' more than the window holds'
      },
      'sfc-locality': {
        value: root.Format.fixed(exact.cells / exact.ranges, 2),
        note: 'cells per range in the exact decomposition'
      }
    });
  }

  function paintBudgets(decompositions, current) {
    const html = BUDGETS.map(function (budget) {
      const m = root.SpaceFilling.coalesce(decompositions.morton, budget);
      const h = root.SpaceFilling.coalesce(decompositions.hilbert, budget);
      const here = budget === current;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + budget + '</td>' +
        '<td class="mono">' + m.ranges + '</td>' +
        '<td class="mono">' + root.Format.exact(m.scanned) + '</td>' +
        '<td class="mono">' + root.Format.percent(m.falsePositives / Math.max(1, m.cells), 1) + '</td>' +
        '<td class="mono">' + h.ranges + '</td>' +
        '<td class="mono">' + root.Format.exact(h.scanned) + '</td>' +
        '<td class="mono">' + root.Format.percent(h.falsePositives / Math.max(1, h.cells), 1) + '</td></tr>';
    }).join('');

    root.jQuery('#sfc-budget-table tbody').html(html);
    root.jQuery('#sfc-budget-note').text('Merging is cheapest-gap-first, so the curve is steep at the low end ' +
      'and flat afterwards: going from four ranges to eight roughly halves the waste and going from sixteen to ' +
      'thirty-two barely changes it. A store that charges per request rather than per row would rather read a ' +
      'few extra cells than issue forty scans, and this table is that decision with numbers in it.');
  }

  function paintLocality(rows) {
    const morton = rows[0];
    const hilbert = rows[1];
    const entries = [
      ['mean index gap between adjacent cells', morton.neighbourMean, hilbert.neighbourMean, 2, false],
      ['worst index gap between adjacent cells', morton.neighbourMax, hilbert.neighbourMax, 0, false],
      ['largest step along the curve', morton.jumpMax, hilbert.jumpMax, 2, false],
      ['mean ranges for a 4 × 4 window', morton.windows[0].meanRanges, hilbert.windows[0].meanRanges, 2, false],
      ['mean ranges for an 8 × 8 window', morton.windows[1].meanRanges, hilbert.windows[1].meanRanges, 2, false],
      ['mean ranges for a 16 × 16 window', morton.windows[2].meanRanges, hilbert.windows[2].meanRanges, 2, false]
    ];

    root.jQuery('#sfc-locality-table tbody').html(entries.map(function (entry) {
      const winner = entry[1] < entry[2] ? 'Morton' : (entry[2] < entry[1] ? 'Hilbert' : 'tie');
      return '<tr><td>' + entry[0] + '</td>' +
        '<td class="mono">' + root.Format.fixed(entry[1], entry[3]) + '</td>' +
        '<td class="mono">' + root.Format.fixed(entry[2], entry[3]) + '</td>' +
        '<td>' + winner + ' (lower is better)</td></tr>';
    }).join(''));

    root.jQuery('#sfc-metrics-note').text('The first two rows are the metric everyone pictures when they say ' +
      '"locality", and Z-order wins both. The third is the property that makes people believe the opposite — ' +
      'the Hilbert curve never jumps, and Z-order crosses the whole grid at every power-of-two boundary. The ' +
      'last three are the metric a query planner actually contains, and Hilbert wins those by close to a ' +
      'factor of two, growing with the window. Naming the metric is the whole discipline here.');
  }

  function paintGeohash() {
    const full = root.SpaceFilling.geohash(LONDON, 9);
    const lines = [1, 3, 5, 7, 9].map(function (precision) {
      const box = root.SpaceFilling.geohashDecode(full.hash.slice(0, precision));
      const latKm = (box.latRange[1] - box.latRange[0]) * 111.32;
      const lonKm = (box.lonRange[1] - box.lonRange[0]) * 111.32 * Math.cos(LONDON.lat * Math.PI / 180);
      return '  ' + String(precision).padStart(2) + '  ' + full.hash.slice(0, precision).padEnd(10) +
        '  ' + root.Format.fixed(latKm, 4).padStart(10) + ' km tall  ' +
        root.Format.fixed(lonKm, 4).padStart(10) + ' km wide';
    });

    root.jQuery('#sfc-geohash').text([
      'The point 51.5007 N, 0.1246 W encodes to ' + full.hash,
      '',
      '  chars  prefix          cell height        cell width'
    ].concat(lines).join('\n'));

    root.jQuery('#sfc-geohash-note').text('Each character is five bits split between the two axes, so a prefix ' +
      'of a geohash *is* a bounding box and truncating the string is zooming out. That makes "everything near ' +
      'here" a prefix scan in any ordered store. It also inherits Z-order\'s weakness intact: two points a ' +
      'metre apart either side of a cell boundary share no prefix at all, which is why every geohash proximity ' +
      'recipe tells you to query the cell and its eight neighbours — and why leaving that step out produces a ' +
      '"nearby" list that mysteriously omits things across the street.');
  }

  function drawMap(app, view) {
    const laid = pathFor(view.order + '|' + view.curve);
    const curve = view.curve;
    const wanted = [];
    for (let y = view.rect.y0; y <= view.rect.y1; y += 1) {
      for (let x = view.rect.x0; x <= view.rect.x1; x += 1) wanted.push({ x: x, y: y });
    }

    const scanned = [];
    view.merged.runs.forEach(function (run) {
      for (let index = run.start; index <= run.end; index += 1) {
        if (laid.cells[index]) scanned.push(laid.cells[index]);
      }
    });

    map = root.SpatialView.curve(root.jQuery('#sfc-map')[0], {
      height: 340,
      side: laid.side,
      cells: laid.cells,
      wanted: wanted,
      scanned: scanned,
      rect: { minX: view.rect.x0, minY: view.rect.y0, maxX: view.rect.x1 + 1, maxY: view.rect.y1 + 1 },
      summary: 'The ' + curve + ' curve over a ' + laid.side + ' × ' + laid.side +
        ' grid, with the query window outlined and the cells a ' + view.merged.ranges + '-range scan reads shaded.'
    });

    root.jQuery('#sfc-map-note').text('The outlined rectangle is the query; the blue cells are what it ' +
      'contains and the amber ones are everything a ' + view.merged.ranges + '-range scan reads. The amber ' +
      'cells outside the rectangle are the false positives — ' + root.Format.exact(view.merged.falsePositives) +
      ' of them here — and being able to point at them is why the picture exists.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
