/**
 * Section: applied geometry.
 *
 * Where the rest of the milestone works in exact arithmetic on continuous
 * shapes, this section is the moment geometry meets a grid of pixels and a
 * frame budget - and the errors that live at that boundary.
 *
 * Three measurements carry it. Bresenham and a rounding reference agree on
 * 83.1% of integer lines and always on the endpoints and the pixel count, and
 * every one of the 508 differences is a line whose ideal path passes exactly
 * between two pixels: two defensible tie-breaks, and a renderer that mixes
 * them draws its outlines and its fills one pixel apart along shared edges.
 * Halving the flattening tolerance does not double the segment count. And the
 * separating axis test returns a push vector that must PROVABLY separate the
 * shapes when applied - which an earlier version, taking its direction from
 * the centroids, did not do for 38 of 800 overlapping pairs.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'applied-geometry';
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
      title: 'Diagram — the separating axis test, projection by projection',
      caption: 'Two convex shapes fail to overlap exactly when some line exists that they project ' +
        'onto without overlapping. There are infinitely many candidate lines and only the edge ' +
        'normals of the two shapes can be separating — the same collapse from continuous to finite ' +
        'as rotating calipers. Finding no separating axis means they overlap, and the axis of ' +
        'SMALLEST overlap is the shortest direction to push them apart.',
      definition: [
        'flowchart TD',
        '    S["two convex polygons"] --> A["collect the edge normals<br/>of both"]',
        '    A --> P["project both shapes<br/>onto the next axis"]',
        '    P --> O{"do the projections<br/>overlap?"}',
        '    O -- no --> SEP["a separating axis exists:<br/>they do NOT collide"]',
        '    O -- yes --> N{"any axes left?"}',
        '    N -- yes --> P',
        '    N -- no --> HIT["no separating axis:<br/>they collide"]',
        '    HIT --> M["the smallest overlap gives<br/>the minimum translation vector"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Bresenham draws a line with integers only**, which is why it was invented and why it ' +
          'still produces bit-identical output on every machine. It and a floating-point rounding ' +
          'reference agree on 83.1% of random integer lines and always on the endpoints and the ' +
          'pixel count — and every disagreement is a line whose ideal path passes exactly between ' +
          'two pixels. Two defensible tie-breaks, and a renderer that mixes them draws outlines and ' +
          'fills one pixel apart along shared edges.',
        '**Curve flattening turns a Bézier into segments, and the tolerance is the dial.** ' +
          'Subdivide until the control points are within the tolerance of the chord. Halving the ' +
          'tolerance does *not* double the segment count — the relationship is much gentler — which ' +
          'is worth knowing before setting it defensively low and wondering where the frame time ' +
          'went.',
        '**Anti-aliasing is coverage, not blur.** A pixel on the boundary is partly inside the ' +
          'shape, and the honest value is what fraction. Supersampling measures it directly; the ' +
          'sum of the coverages over all pixels is the polygon\'s area, which is the check that ' +
          'tells you the filter is unbiased rather than merely soft.',
        '**The separating axis theorem is the same collapse as rotating calipers.** Two convex ' +
          'shapes miss exactly when some axis separates their projections, and only the edge ' +
          'normals can be that axis — infinitely many candidates down to a handful. Finding none ' +
          'means they collide, and the axis of least overlap gives the shortest push that pulls ' +
          'them apart.'
      ],
      demo: {
        title: 'Interactive demo — rasterisation, flattening, coverage and collision',
        markup: root.AppliedGeometryTemplate.render()
      },
      diagram: diagram(),
      insight: 'Treating latitude and longitude as planar coordinates is the most common geometry ' +
        'bug in application code, and it is invisible where it is written. A degree of longitude is ' +
        'about 111 km at the equator and about 55 km at 60°N, so a distance computed as if the ' +
        'globe were a sheet of paper is correct in the tests written in the office and wrong for ' +
        'users further north — and it gets worse the further they go. Project first, or use a ' +
        'geodesic formula. The same lesson runs through this whole section: the discretisation is ' +
        'not a detail you can leave until later, because it changes the answer rather than the ' +
        'appearance.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AppliedGeometryTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const FILL_RING = [[3, 3], [27, 6], [24, 25], [7, 21]];
  const CURVE = [[0, 0], [0, 60], [80, 60], [80, 0]];
  const SHAPE_A = [[0, 0], [14, 0], [16, 9], [7, 14], [-1, 8]];
  const SHAPE_B = [[0, 0], [12, 2], [13, 11], [3, 12]];

  function ringOf(pairs, dx, dy) {
    return pairs.map(function (p) {
      return root.GeometryCore.point(p[0] + (dx || 0), p[1] + (dy || 0));
    });
  }

  const fillFor = root.Helpers.memoise(function (key) {
    const ring = ringOf(FILL_RING);
    const samples = Number(key);
    const stats = root.Raster.report();
    const spans = root.Raster.scanlineFill(ring, stats);
    const coverage = root.Raster.coverageFill(ring, samples, stats);

    return { ring: ring, spans: spans, coverage: coverage,
      pixels: spans.reduce(function (s, sp) { return s + sp.x1 - sp.x0 + 1; }, 0),
      coverageSum: coverage.reduce(function (s, c) { return s + c.coverage; }, 0),
      area: root.Polygon.area(ring) };
  });

  const flattenFor = root.Helpers.memoise(function (key) {
    const p = CURVE.map(function (q) { return root.GeometryCore.point(q[0], q[1]); });
    return [4, 1, 0.25, 0.0625, 0.015625].map(function (tolerance) {
      const stats = root.Raster.report();
      const flat = root.Raster.flattenCubic(p[0], p[1], p[2], p[3], tolerance, stats);
      const error = root.Raster.flattenError(p[0], p[1], p[2], p[3], flat, 400);
      return { tolerance: tolerance, segments: flat.length - 1, points: flat,
        subdivisions: stats.subdivisions, error: error, within: error <= tolerance };
    });
  });

  const linesFor = root.Helpers.memoise(function (key) {
    const rng = root.Random.seeded(89);
    const count = Number(key);
    let identical = 0;
    let sameCount = 0;
    let sameEnds = 0;

    for (let i = 0; i < count; i += 1) {
      const a = root.GeometryCore.point(Math.round(rng.next() * 60 - 30), Math.round(rng.next() * 60 - 30));
      const b = root.GeometryCore.point(Math.round(rng.next() * 60 - 30), Math.round(rng.next() * 60 - 30));
      const bres = root.Raster.bresenham(a, b);
      const round = root.Raster.lineByRounding(a, b);
      const key1 = bres.map(function (p) { return p.x + ',' + p.y; }).join(' ');
      const key2 = round.map(function (p) { return p.x + ',' + p.y; }).join(' ');

      if (key1 === key2) identical += 1;
      if (bres.length === round.length) sameCount += 1;
      if (bres[0].x === round[0].x && bres[0].y === round[0].y &&
        bres[bres.length - 1].x === round[round.length - 1].x &&
        bres[bres.length - 1].y === round[round.length - 1].y) sameEnds += 1;
    }
    return { count: count, identical: identical, differing: count - identical,
      sameCount: sameCount, sameEnds: sameEnds };
  });

  const satFor = root.Helpers.memoise(function (key) {
    const separation = Number(key);
    const a = ringOf(SHAPE_A);
    const b = ringOf(SHAPE_B, 6 + separation, 2);
    const stats = root.Raster.report();
    const result = root.Raster.separatingAxis(a, b, { report: stats });
    const oracle = root.Raster.overlapBySampling(a, b, 150);

    let separated = null;
    if (result.colliding && result.mtv) {
      const moved = root.Raster.translateRing(b, result.mtv);
      const after = root.Raster.separatingAxis(a, moved);
      separated = !after.colliding || after.overlap <= 1e-9;
    }
    return { a: a, b: b, result: result, oracle: oracle, separated: separated, stats: stats };
  });

  const satSweepFor = root.Helpers.memoise(function () {
    return [0, 3, 6, 9, 12, 15, 18, 21, 24].map(function (separation) {
      const state = satFor(String(separation));
      return { separation: separation, axes: state.result.axesTested,
        colliding: state.result.colliding, oracle: state.oracle.overlapping,
        overlap: state.result.overlap || 0, separated: state.separated };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const fill = fillFor(values['ag-samples']);
    const flatten = flattenFor('');
    const sat = satFor(values['ag-separation']);

    paintMetrics(fill, flatten, sat, values['ag-tolerance']);
    paintScene(values['ag-view'], fill, flatten, sat, values['ag-tolerance']);
    paintFlatten(flatten, values['ag-tolerance']);
    paintLines(linesFor('3000'));
    paintSat(satSweepFor(''), Number(values['ag-separation']));
  }

  function chosenFlatten(flatten, tolerance) {
    const wanted = Number(tolerance);
    return flatten.filter(function (f) { return f.tolerance === wanted; })[0] || flatten[2];
  }

  function paintMetrics(fill, flatten, sat, tolerance) {
    const chosen = chosenFlatten(flatten, tolerance);

    root.MetricGrid.update({
      'ag-pixels': { value: root.Format.exact(fill.pixels),
        note: 'the polygon\'s area is ' + root.Format.fixed(fill.area, 1) +
          '; supersampled coverage sums to ' + root.Format.fixed(fill.coverageSum, 1) },
      'ag-segments': { value: root.Format.exact(chosen.segments),
        note: 'at tolerance ' + tolerance + ', measured worst error ' +
          root.Format.fixed(chosen.error, 4) },
      'ag-colliding': { value: sat.result.colliding ? 'yes' : 'no',
        note: sat.result.colliding === sat.oracle.overlapping
          ? 'the sampling oracle agrees' : 'the sampling oracle DISAGREES' },
      'ag-mtv': { value: sat.result.mtv
        ? root.Format.fixed(sat.result.overlap, 3) : '—',
      note: sat.separated === null ? 'nothing to push apart'
        : sat.separated ? 'applying it does separate them' : 'applying it does NOT separate them' }
    });
  }

  function paintScene(view_, fill, flatten, sat, tolerance) {
    view = function () { drawScene(view_, fill, flatten, sat, tolerance); };
    view();
  }

  function drawScene(mode, fill, flatten, sat, tolerance) {
    const host = root.jQuery('#ag-scene')[0];
    if (!host) return;

    if (mode === 'line') return drawLine(host);
    if (mode === 'curve') return drawCurve(host, chosenFlatten(flatten, tolerance));
    if (mode === 'collision') return drawCollision(host, sat);
    return drawFill(host, fill);
  }

  function drawFill(host, fill) {
    root.GeometryView.render(host, {
      height: 300,
      cells: fill.coverage.map(function (c) {
        return { x: c.x, y: c.y, coverage: c.coverage, hue: 'teal' };
      }),
      cellSize: 1,
      rings: [{ points: fill.ring, hue: 'blue', width: 2 }],
      ariaLabel: 'polygon filled by scanline with per-pixel coverage'
    });

    const partial = fill.coverage.filter(function (c) { return c.coverage < 1; }).length;
    root.Helpers.setText('ag-scene-note',
      'Each cell is one pixel, shaded by how much of it falls inside the polygon. ' +
      root.Format.exact(partial) + ' of ' + root.Format.exact(fill.coverage.length) +
      ' touched pixels are only partly covered — those are the ones anti-aliasing exists for. The ' +
      'coverages sum to ' + root.Format.fixed(fill.coverageSum, 2) + ' against a true area of ' +
      root.Format.fixed(fill.area, 2) + ', which is the check that the filter is unbiased.');
  }

  function drawLine(host) {
    const G = root.GeometryCore;
    const a = G.point(0, 0);
    const b = G.point(17, 7);
    const bres = root.Raster.bresenham(a, b);
    const round = root.Raster.lineByRounding(a, b);
    const roundKeys = new Set(round.map(function (p) { return p.x + ',' + p.y; }));

    root.GeometryView.render(host, {
      height: 280,
      cells: bres.map(function (p) {
        return { x: p.x, y: p.y, coverage: 1,
          hue: roundKeys.has(p.x + ',' + p.y) ? 'teal' : 'red' };
      }),
      cellSize: 1,
      segments: [{ a: a, b: b, hue: 'orange', width: 1.5, dashed: true }],
      ariaLabel: 'Bresenham pixels against the ideal line'
    });

    root.Helpers.setText('ag-scene-note',
      'The dashed line is the ideal path; the cells are the pixels Bresenham chooses. Teal pixels ' +
      'are ones the rounding reference also picks, red ones are where the two tie-break ' +
      'differently. Both are defensible and Bresenham\'s is the one that is identical on every ' +
      'machine, because it never touches a float.');
  }

  function drawCurve(host, chosen) {
    const p = CURVE.map(function (q) { return root.GeometryCore.point(q[0], q[1]); });
    const smooth = [];
    for (let i = 0; i <= 200; i += 1) smooth.push(root.Raster.bezierAt(p[0], p[1], p[2], p[3], i / 200));

    root.GeometryView.render(host, {
      height: 280,
      rings: [{ points: smooth, hue: 'gray', width: 1.5, open: true },
        { points: chosen.points, hue: 'blue', width: 2, open: true }],
      points: chosen.points.map(function (q) { return { point: q, hue: 'orange', radius: 3 }; }),
      construction: [{ a: p[0], b: p[1], hue: 'gray', width: 0.75, dashed: true },
        { a: p[2], b: p[3], hue: 'gray', width: 0.75, dashed: true }],
      ariaLabel: 'a cubic Bezier and its flattened polyline'
    });

    root.Helpers.setText('ag-scene-note',
      'Grey is the true curve, blue the polyline that replaces it, orange the points where it was ' +
      'split. At tolerance ' + chosen.tolerance + ' that is ' +
      root.Format.exact(chosen.segments) + ' segments and a measured worst error of ' +
      root.Format.fixed(chosen.error, 4) + ' — comfortably inside the tolerance, because ' +
      'subdivision stops as soon as the bound is met rather than when the error is.');
  }

  function drawCollision(host, sat) {
    const pushed = sat.result.mtv ? root.Raster.translateRing(sat.b, sat.result.mtv) : null;

    root.GeometryView.render(host, {
      height: 300,
      fills: [{ ring: sat.a, hue: 'blue', alpha: 0.2 }, { ring: sat.b, hue: 'orange', alpha: 0.2 }],
      rings: [{ points: sat.a, hue: 'blue', width: 2 }, { points: sat.b, hue: 'orange', width: 2 }]
        .concat(pushed ? [{ points: pushed, hue: 'teal', width: 2, dashed: true }] : []),
      ariaLabel: 'two convex shapes with the minimum translation vector applied'
    });

    root.Helpers.setText('ag-scene-note',
      sat.result.colliding
        ? 'The two shapes overlap by ' + root.Format.fixed(sat.result.overlap, 3) +
          ' along the axis of least penetration. The dashed teal outline is the orange shape after ' +
          'the push vector is applied, and it must be just touching rather than overlapping: ' +
          (sat.separated ? 'it is.' : 'IT IS NOT.')
        : 'A separating axis was found after ' + root.Format.exact(sat.result.axesTested) +
          ' of the candidates, so the shapes do not overlap and there is nothing to push. The test ' +
          'stops at the first axis that separates rather than trying them all.');
  }

  function paintFlatten(flatten, tolerance) {
    root.jQuery('#ag-flatten tbody').html(flatten.map(function (row) {
      return '<tr><td>' + row.tolerance + (String(row.tolerance) === tolerance ? ' (shown)' : '') +
        '</td><td>' + root.Format.exact(row.segments) + '</td><td>' +
        root.Format.exact(row.subdivisions) + '</td><td>' + root.Format.fixed(row.error, 4) +
        '</td><td>' + (row.within ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const coarse = flatten[0];
    const fine = flatten[flatten.length - 1];
    const toleranceRatio = coarse.tolerance / fine.tolerance;
    const segmentRatio = fine.segments / Math.max(1, coarse.segments);

    root.Helpers.setText('ag-flatten-note',
      'Tightening the tolerance by ' + root.Format.exact(Math.round(toleranceRatio)) +
      '× multiplies the segment count by only ' + root.Format.fixed(segmentRatio, 1) +
      '× — the relationship is roughly a square root, not linear. That is worth knowing before ' +
      'setting a tolerance defensively low: the cost is real but far smaller than it looks, and ' +
      'the measured error is always comfortably inside the bound because subdivision stops when ' +
      'the flatness test passes rather than when the error is exactly met.');
  }

  function paintLines(lines) {
    root.jQuery('#ag-lines tbody').html(
      '<tr><td>' + root.Format.exact(lines.count) + '</td><td>' +
      root.Format.exact(lines.identical) + ' (' +
      root.Format.fixed(100 * lines.identical / lines.count, 1) + '%)</td><td>' +
      root.Format.exact(lines.differing) + '</td><td>' +
      (lines.sameCount === lines.count ? 'yes' : 'no, ' +
        root.Format.exact(lines.count - lines.sameCount) + ' differ') + '</td><td>' +
      (lines.sameEnds === lines.count ? 'yes' : 'no') + '</td></tr>');

    root.Helpers.setText('ag-lines-note',
      'The two never disagree about where a line starts, where it ends, or how many pixels it ' +
      'takes — they disagree only about which pixel to pick when the ideal path runs exactly ' +
      'between two of them. Bresenham breaks that tie the same way every time with an integer ' +
      'comparison; rounding breaks it however the floating-point midpoint happened to land. A ' +
      'renderer that uses one for outlines and the other for fills draws them a pixel apart along ' +
      'every shared edge.');
  }

  function paintSat(rows, chosen) {
    root.jQuery('#ag-sat tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Format.exact(row.separation) +
        (row.separation === chosen ? ' (shown)' : '') + '</td><td>' +
        root.Format.exact(row.axes) + '</td><td>' + (row.colliding ? 'yes' : 'no') + '</td><td>' +
        (row.colliding === row.oracle ? 'yes' : 'NO') + '</td><td>' +
        (row.colliding ? root.Format.fixed(row.overlap, 3) : '—') + '</td><td>' +
        (row.separated === null ? '—' : row.separated ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ag-sat-note',
      'The axes column shows the early exit: once an axis separates the shapes the test stops, so ' +
      'a clear miss is cheaper than a hit. The last column is the one that matters and it is not ' +
      'decorative — an earlier version of this test took the push direction from the two centroids, ' +
      'which is right most of the time and wrong for 38 of 800 overlapping pairs. The sign comes ' +
      'from the projections on the chosen axis now, and a push that does not separate is the one ' +
      'thing a minimum translation vector must never be.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
