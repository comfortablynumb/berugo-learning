/**
 * Section: convex hulls.
 *
 * Four algorithms for one answer, and the section's job is to make the choice
 * between them a measurement rather than a recitation of bounds. The currency
 * is ORIENTATION TESTS, because that is the operation each one is trying to
 * avoid and it does not depend on a JIT or a cache.
 *
 * The scaling chart is the point. Gift wrapping is O(nh) and that is not a
 * worse bound than O(n log n) - it is a DIFFERENT bound, better when the hull
 * is tiny and catastrophic when every point is on it. Moving the point set
 * from 'uniform' to 'circle' does not change n at all and moves gift wrapping
 * from competitive to unusable, which is a fact about the data rather than
 * about the algorithm.
 *
 * The collinear policy is the section's second job. It is a documented
 * parameter here because getting it wrong breaks something in a different
 * file: keep, and the hull is no longer strictly convex, so rotating calipers
 * can pick two adjacent collinear vertices as an antipodal pair; drop, and
 * points a caller needed to see are gone.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'convex-hulls';
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
      title: 'Diagram — the monotone chain, built in two halves',
      caption: 'Sort the points left to right once. Walk them forward building the lower hull, ' +
        'popping any vertex that would make a right turn; walk them backward building the upper ' +
        'hull the same way. Join the two and drop the shared endpoints. No angular sort, no ' +
        'trigonometry, and no special case for the starting point — which is why this is the ' +
        'practical default.',
      definition: [
        'flowchart TD',
        '    S["points, sorted by x then y"] --> L["walk left to right"]',
        '    S --> U["walk right to left"]',
        '    L --> LP{"do the last two and<br/>the new point turn right?"}',
        '    LP -- yes --> LX["pop the last vertex,<br/>ask again"]',
        '    LX --> LP',
        '    LP -- no --> LK["push the new point"]',
        '    LK --> LOWER["lower hull"]',
        '    U --> UPPER["upper hull,<br/>same rule"]',
        '    LOWER --> J["join, dropping the two<br/>shared endpoints"]',
        '    UPPER --> J',
        '    J --> H["the hull, counter-clockwise"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The convex hull is the smallest convex shape containing every point** — the shape a rubber ' +
        'band would take if you stretched it round them.',
      'Every algorithm here computes the same answer, so the choice between them is entirely about ' +
        'cost. That cost is counted in **orientation tests**: the predicate from the previous ' +
        'section, called over and over.',
      '**`O(n log n)` and `O(nh)` are different bounds, not better and worse ones.** Gift wrapping ' +
        'walks from one hull vertex to the next, scanning every point each time, so it costs `n` ' +
        'per vertex found.',
      'When the hull has four vertices that beats sorting. When every point is on the hull it ' +
        'degenerates to `n²`. The point set decides, and `h` is not something you know before you ' +
        'start.',
      '**Andrew\'s monotone chain is the practical default.** Sort once, sweep twice.',
      'It has no angular sort, so no trigonometry and no comparator that can be made inconsistent ' +
        'by a bad predicate. That is exactly how Graham scan fails: its *sort* calls the orientation ' +
        'test, and an inconsistent comparator can crash the sort itself.',
      '**"Keep or drop collinear points" must be a documented parameter.** A point lying exactly on ' +
        'a hull edge is legitimately on the hull and legitimately not a corner.',
      'Both answers are defensible and each breaks something downstream, so the decision belongs in ' +
        'the signature rather than in whichever loop happened to be written first.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — four algorithms, seven point sets, and the collinear policy',
        markup: root.ConvexHullsTemplate.render()
      },
      diagram: diagram(),
      insight: 'When someone says a hull algorithm is `O(n log n)` and another is `O(nh)`, they ' +
        'have told you almost nothing about which to use. `h` is a property of your data and not of ' +
        'your code. Measure it. If your points come from a sensor sweep or a circular boundary, ' +
        'nearly all of them are on the hull and gift wrapping is quadratic. If they are a cloud, ' +
        '`h` is tiny and it wins. And whichever you pick, write the collinear policy down in the ' +
        'function signature — the bug it causes always appears in a different file.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ConvexHullsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const pointsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GeometryLab.points(parts[0], Number(parts[1]), 21);
  });

  const comparisonFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GeometryLab.compareHulls(pointsFor(parts[0] + '|' + parts[1]), parts[2]);
  });

  const BOUNDS = {
    'monotone-chain': 'O(n log n)',
    'gift-wrapping': 'O(n·h)',
    'graham-scan': 'O(n log n)',
    quickhull: 'O(n log n) expected, O(n²) worst'
  };

  /** How the four scale as the fraction of points on the hull changes. */
  const scalingFor = root.Helpers.memoise(function (key) {
    const collinear = key;
    const sizes = [32, 64, 128, 256, 512, 1024];

    return sizes.map(function (n) {
      const cloud = root.GeometryLab.points('uniform', n, 21);
      const ring = root.GeometryLab.points('circle', n, 21);
      return { n: n, cloud: costOf(cloud, collinear), ring: costOf(ring, collinear),
        cloudHull: hullSize(cloud, collinear), ringHull: hullSize(ring, collinear) };
    });
  });

  function costOf(pts, collinear) {
    const out = {};
    root.ConvexHull.names().forEach(function (name) {
      const stats = root.ConvexHull.report();
      root.ConvexHull.run(name, pts, { collinear: collinear, report: stats });
      out[name] = stats.orient;
    });
    return out;
  }

  function hullSize(pts, collinear) {
    return root.ConvexHull.monotoneChain(pts, { collinear: collinear }).hull.length;
  }

  const degenerateFor = root.Helpers.memoise(function (key) {
    const count = Number(key);
    return ['collinear', 'coincident', 'grid', 'circle', 'near-collinear'].map(function (scene) {
      const pts = root.GeometryLab.points(scene, count, 21);
      const drop = root.GeometryLab.compareHulls(pts, 'drop');
      const keep = root.GeometryLab.compareHulls(pts, 'keep');
      return { scene: scene, points: pts.length,
        drop: drop.rows[0].vertices, keep: keep.rows[0].vertices,
        agree: drop.agree && keep.agree };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['ch-set'] + '|' + values['ch-count'];
    const pts = pointsFor(key);
    const comparison = comparisonFor(key + '|' + values['ch-collinear']);

    paintMetrics(pts, comparison);
    paintScene(pts, comparison, values['ch-show']);
    paintAlgorithms(comparison);
    paintScaling(scalingFor(values['ch-collinear']), app);
    paintDegenerate(degenerateFor(String(Math.min(60, Number(values['ch-count'])))));
  }

  function paintMetrics(pts, comparison) {
    const costs = comparison.rows.map(function (r) { return r.orient; });
    const cheapest = comparison.rows.reduce(function (best, r) {
      return r.orient < best.orient ? r : best;
    });
    const dearest = Math.max.apply(null, costs);
    const verified = comparison.rows.filter(function (r) { return r.ok; }).length;

    root.MetricGrid.update({
      'ch-vertices': { value: root.Format.exact(comparison.rows[0].vertices),
        note: 'of ' + root.Format.exact(pts.length) + ' points — ' +
          root.Format.fixed(100 * comparison.rows[0].vertices / Math.max(1, pts.length), 1) +
          '% are on the hull' },
      'ch-cheapest': { value: cheapest.name,
        note: root.Format.exact(cheapest.orient) + ' orientation tests' },
      'ch-spread': { value: root.Format.fixed(dearest / Math.max(1, cheapest.orient), 2) + '×',
        note: root.Format.exact(dearest) + ' against ' + root.Format.exact(cheapest.orient) },
      'ch-agree': { value: root.Format.exact(verified) + ' of ' +
          root.Format.exact(comparison.rows.length),
        note: comparison.agree ? 'and all four returned the identical hull'
          : 'the four did NOT return the same hull' }
    });
  }

  function paintScene(pts, comparison, shown) {
    view = function () { drawScene(pts, comparison, shown); };
    view();
  }

  function drawScene(pts, comparison, shown) {
    const host = root.jQuery('#ch-scene')[0];
    if (!host) return;
    const row = comparison.rows.filter(function (r) { return r.name === shown; })[0] ||
      comparison.rows[0];

    root.GeometryView.render(host, {
      height: 300,
      fills: row.hull.length >= 3 ? [{ ring: row.hull, hue: 'blue', alpha: 0.1 }] : [],
      rings: row.hull.length >= 2 ? [{ points: row.hull, hue: 'blue', width: 2 }] : [],
      points: pts.map(function (p) { return { point: p, hue: 'gray', radius: 2 }; }),
      highlights: row.hull.map(function (p) {
        return { point: p, hue: 'orange', radius: 4, outline: true };
      }),
      ariaLabel: 'point set with its convex hull'
    });

    root.Helpers.setText('ch-scene-note',
      row.name + ' returned ' + root.Format.exact(row.vertices) + ' vertices from ' +
      root.Format.exact(pts.length) + ' points, using ' + root.Format.exact(row.orient) +
      ' orientation tests' +
      (row.exact ? ' of which ' + root.Format.exact(row.exact) + ' needed exact arithmetic' : '') +
      '. The oracle checks every input point is inside or on the hull and that no vertex is ' +
      'reflex: ' + (row.ok ? 'it passes.' : 'IT FAILS — ' + row.problems.join('; ')));
  }

  function paintAlgorithms(comparison) {
    root.jQuery('#ch-algos tbody').html(comparison.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + BOUNDS[row.name] + '</td><td>' +
        root.Format.exact(row.vertices) + '</td><td>' + root.Format.exact(row.orient) +
        '</td><td>' + root.Format.exact(row.comparisons) + '</td><td>' +
        (row.ok ? 'passes' : 'FAILS') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ch-algos-note',
      'Every row computes the identical hull; the columns are what each one paid for it. Gift ' +
      'wrapping does no sorting at all and pays in orientation tests instead — which is the right ' +
      'trade when the hull is small and the wrong one when it is not.');
  }

  function paintScaling(rows, app) {
    const host = root.jQuery('#ch-chart')[0];
    if (!host) return;

    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      logX: true,
      logY: true,
      height: 230,
      series: [
        { label: 'gift wrapping, cloud (small h)',
          points: rows.map(function (r) { return { x: r.n, y: r.cloud['gift-wrapping'] }; }) },
        { label: 'gift wrapping, circle (h = n)',
          points: rows.map(function (r) { return { x: r.n, y: r.ring['gift-wrapping'] }; }) },
        { label: 'monotone chain, cloud',
          points: rows.map(function (r) { return { x: r.n, y: r.cloud['monotone-chain'] }; }) },
        { label: 'monotone chain, circle',
          points: rows.map(function (r) { return { x: r.n, y: r.ring['monotone-chain'] }; }) }
      ],
      xLabel: 'points',
      yLabel: 'orientation tests',
      legendHost: root.jQuery('#ch-legend')[0],
      ariaLabel: 'orientation tests against point count for two point sets'
    });

    const last = rows[rows.length - 1];
    root.Helpers.setText('ch-chart-note',
      'At ' + root.Format.exact(last.n) + ' points the cloud has ' +
      root.Format.exact(last.cloudHull) + ' hull vertices and the circle has ' +
      root.Format.exact(last.ringHull) + '. Gift wrapping costs ' +
      root.Format.exact(last.cloud['gift-wrapping']) + ' tests on the cloud and ' +
      root.Format.exact(last.ring['gift-wrapping']) + ' on the circle — a ' +
      root.Format.fixed(last.ring['gift-wrapping'] /
        Math.max(1, last.cloud['gift-wrapping']), 1) + '× difference from the same n. The ' +
      'monotone chain barely notices: ' + root.Format.exact(last.cloud['monotone-chain']) +
      ' against ' + root.Format.exact(last.ring['monotone-chain']) + '.');
  }

  function paintDegenerate(rows) {
    root.jQuery('#ch-degenerate tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.scene + '</td><td>' + root.Format.exact(row.points) + '</td><td>' +
        root.Format.exact(row.drop) + '</td><td>' + root.Format.exact(row.keep) + '</td><td>' +
        (row.agree ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ch-degenerate-note',
      'The two policies differ most where points sit exactly on hull edges: a grid has them on ' +
      'every side, and a fully collinear set has no interior at all — there the hull is a segment ' +
      'under drop and the whole sorted run under keep. All four algorithms are required to agree ' +
      'under both policies, which is a stronger contract than "they compute a convex hull" and is ' +
      'the one that actually prevents a downstream surprise.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
