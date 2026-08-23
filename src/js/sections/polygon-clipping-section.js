/**
 * Section: boolean operations and clipping.
 *
 * Sutherland-Hodgman is correct when the clip polygon is convex, because a
 * convex region is exactly the intersection of the half-planes its edges
 * define. When the clip polygon is concave that identity fails and so does the
 * algorithm - quietly, and in two different ways depending on the shape.
 *
 * Measured against a sampled reference: a deep notch and a shallow notch both
 * return the EMPTY polygon, which is a 100% error with no vertices to inspect;
 * an L-shape and a chevron return a plausible four- or five-vertex polygon
 * that is 66.7% too small; a five-pointed star returns eight vertices and
 * 60.0% too little. The second kind is the dangerous one - there is a polygon
 * at the end of it, it renders, and nothing about it says it is wrong.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'polygon-clipping';
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
      title: 'Diagram — why a concave clip breaks the half-plane argument',
      caption: 'Sutherland-Hodgman cuts the subject with each clip edge extended to an infinite ' +
        'line. For a convex clip that is exactly right, because the region IS the intersection of ' +
        'those half-planes. A concave clip is not: the half-planes of a notch cut away parts of the ' +
        'polygon that are genuinely inside it, and the intersection collapses to something smaller ' +
        'than the region — sometimes to nothing at all.',
      definition: [
        'flowchart TD',
        '    S["subject polygon"] --> E["cut with clip edge 1,<br/>extended to a line"]',
        '    E --> F["cut with clip edge 2"]',
        '    F --> G["... and so on"]',
        '    G --> C{"is the clip polygon<br/>convex?"}',
        '    C -- yes --> OK["the region equals the<br/>intersection of the half-planes"]',
        '    C -- no --> BAD["the half-planes cut away<br/>parts that are inside"]',
        '    BAD --> R1["empty result, or"]',
        '    BAD --> R2["a plausible polygon<br/>that is too small"]',
        '    C -- fix --> D["split the clip into convex<br/>pieces, clip against each"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Sutherland-Hodgman** clips one polygon against another by cutting the subject ' +
          'successively with each edge of the clip polygon, treated as an infinite line. It is ' +
          'short, it is fast, and it is what most people write first — and it is correct only when ' +
          'the clip polygon is **convex**, because a convex region is exactly the intersection of ' +
          'the half-planes its edges define.',
        '**A concave clip breaks that identity, and the algorithm does not say so.** The measured ' +
          'failure comes in two flavours. Against a deep or shallow notch it returns the *empty ' +
          'polygon* — obviously wrong, and at least loud. Against an L-shape or a chevron it ' +
          'returns a perfectly plausible four- or five-vertex polygon that is two-thirds too small, ' +
          'which renders, passes a "did we get a polygon" check, and is simply wrong.',
        '**The fix is a decomposition, not a tolerance.** Split the concave clip into convex pieces ' +
          '— ear clipping always gives you triangles — clip against each, and take the union. The ' +
          'result is a *list* of rings rather than one ring, because a concave clip can genuinely ' +
          'cut the subject into disconnected parts, which the single-ring version cannot even ' +
          'represent.',
        '**The Minkowski sum turns "does this fit" into "is this point inside".** Growing every ' +
          'obstacle by the shape of the robot reduces motion planning to a point in a region. For ' +
          'two convex polygons the sum is a merge of their edge vectors in angular order — linear, ' +
          'and every edge of the result is an edge of one of the inputs. Offsetting a polygon ' +
          'outward is its sum with a disc, and the disc is always approximated by a polygon whose ' +
          'corner count nobody sets.'
      ],
      demo: {
        title: 'Interactive demo — the concave failure, four booleans, and offsetting',
        markup: root.PolygonClippingTemplate.render()
      },
      diagram: diagram(),
      insight: 'Shared edges and coincident vertices are the whole difficulty in boolean geometry, ' +
        'which is why robust libraries snap every coordinate to a grid before they start. That is a ' +
        'correctness decision disguised as preprocessing: it makes "exactly on the boundary" a ' +
        'state you can test for rather than a state you fall into by accident. And whatever clipper ' +
        'you use, check its area against a sampled reference on a concave case before trusting it — ' +
        'a clipper that is 66% wrong returns a polygon that looks entirely reasonable.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PolygonClippingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const SUBJECT = [[20, 20], [80, 20], [80, 80], [20, 80]];

  const CLIPS = {
    notch: [[0, 0], [100, 0], [100, 100], [60, 100], [60, 40], [40, 40], [40, 100], [0, 100]],
    shallow: [[0, 0], [100, 0], [100, 100], [60, 100], [60, 80], [40, 80], [40, 100], [0, 100]],
    'l-shape': [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]],
    chevron: [[0, 0], [100, 0], [50, 50], [100, 100], [0, 100]],
    star: [[50, 100], [62, 62], [100, 50], [62, 38], [50, 0], [38, 38], [0, 50], [38, 62]],
    band: [[0, 30], [100, 30], [100, 70], [0, 70]],
    square: [[10, 10], [90, 10], [90, 90], [10, 90]]
  };

  function ringOf(pairs) {
    return pairs.map(function (p) { return root.GeometryCore.point(p[0], p[1]); });
  }

  const subject = root.Helpers.memoise(function () { return ringOf(SUBJECT); });

  const clippedFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const clip = ringOf(CLIPS[parts[0]] || CLIPS.square);
    const grid = Number(parts[1]);
    const subj = subject('');

    const sh = root.Clipping.sutherlandHodgman(subj, clip);
    const decomposed = root.Clipping.clipConvexDecomposed(subj, clip);
    const sampled = root.Clipping.booleanArea(subj, clip, root.Clipping.INTERSECTION, grid);

    return {
      clip: clip,
      sh: sh,
      shArea: sh.length >= 3 ? root.Polygon.area(sh) : 0,
      decomposed: decomposed,
      decomposedArea: decomposed.reduce(function (s, r) { return s + root.Polygon.area(r); }, 0),
      sampled: sampled,
      convex: root.Polygon.isConvex(clip)
    };
  });

  const shapesFor = root.Helpers.memoise(function (key) {
    const grid = Number(key);
    return Object.keys(CLIPS).map(function (name) {
      const state = clippedFor(name + '|' + grid);
      const truth = state.sampled.area;
      return { name: name, convex: state.convex, sh: state.shArea,
        vertices: state.sh.length, decomposed: state.decomposedArea, sampled: truth,
        error: truth > 0 ? Math.abs(state.shArea - truth) / truth : 0 };
    });
  });

  const opsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const clip = ringOf(CLIPS[parts[0]] || CLIPS.square);
    const grid = Number(parts[1]);

    return [root.Clipping.INTERSECTION, root.Clipping.UNION, root.Clipping.DIFFERENCE,
      root.Clipping.XOR].map(function (operation) {
      const measured = root.Clipping.booleanArea(subject(''), clip, operation, grid);
      return { operation: operation, area: measured.area, hits: measured.hits,
        cells: measured.cells, resolution: measured.cellArea };
    });
  });

  const offsetFor = root.Helpers.memoise(function (key) {
    const radius = 8;
    const square = ringOf([[30, 30], [70, 30], [70, 70], [30, 70]]);
    const trueArea = root.Polygon.area(square) +
      root.Polygon.perimeter(square) * radius + Math.PI * radius * radius;

    return [3, 6, 8, 12, Number(key), 32, 64].filter(function (n, i, list) {
      return list.indexOf(n) === i;
    }).sort(function (a, b) { return a - b; }).map(function (corners) {
      const offset = root.Clipping.offsetConvex(square, radius, corners);
      const area = root.Polygon.area(offset);
      return { corners: corners, area: area, trueArea: trueArea,
        shortfall: trueArea > 0 ? (trueArea - area) / trueArea : 0,
        vertices: offset.length };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const key = values['pk-clip'] + '|' + values['pk-grid'];
    const state = clippedFor(key);

    paintMetrics(state);
    paintScene(state);
    paintShapes(shapesFor(String(values['pk-grid'])));
    paintOps(opsFor(key), values['pk-operation']);
    paintOffset(offsetFor(String(values['pk-corners'])), Number(values['pk-corners']));
  }

  function paintMetrics(state) {
    const truth = state.sampled.area;

    root.MetricGrid.update({
      'pk-sh-area': { value: root.Format.fixed(state.shArea, 1),
        note: state.sh.length === 0 ? 'it returned no polygon at all'
          : root.Format.exact(state.sh.length) + ' vertices returned' },
      'pk-fixed-area': { value: root.Format.fixed(state.decomposedArea, 1),
        note: root.Format.exact(state.decomposed.length) + ' convex pieces clipped separately' },
      'pk-truth': { value: root.Format.fixed(truth, 1),
        note: root.Format.exact(state.sampled.cells) + ' sample cells, each ' +
          root.Format.fixed(state.sampled.cellArea, 4) + ' in area' },
      'pk-error': { value: truth > 0
        ? root.Format.fixed(100 * Math.abs(state.shArea - truth) / truth, 1) + '%' : '—',
      note: state.convex ? 'the clip is convex, so there is no error to have'
        : 'the clip is concave, which is where the algorithm stops applying' }
    });
  }

  function paintScene(state) {
    view = function () { drawScene(state); };
    view();
  }

  function drawScene(state) {
    const host = root.jQuery('#pk-scene')[0];
    if (!host) return;
    const subj = subject('');

    root.GeometryView.render(host, {
      height: 320,
      fills: state.decomposed.map(function (ring) {
        return { ring: ring, hue: 'teal', alpha: 0.28 };
      }),
      rings: [{ points: subj, hue: 'blue', width: 2 },
        { points: state.clip, hue: 'orange', width: 2 }]
        .concat(state.sh.length >= 3 ? [{ points: state.sh, hue: 'red', width: 2, dashed: true }] : []),
      ariaLabel: 'subject and clip polygons with both clipping results'
    });

    root.Helpers.setText('pk-scene-note',
      'Blue is the subject, orange the clip. Teal fills are what the convex decomposition returns ' +
      '— ' + root.Format.exact(state.decomposed.length) + ' pieces totalling ' +
      root.Format.fixed(state.decomposedArea, 1) + '. The dashed red outline is what ' +
      'Sutherland-Hodgman returns on its own' +
      (state.sh.length >= 3
        ? ': ' + root.Format.fixed(state.shArea, 1) + ' — a polygon that renders perfectly and is ' +
          'the wrong shape.'
        : ' — nothing at all, so there is no red outline to see.'));
  }

  function paintShapes(rows) {
    root.jQuery('#pk-shapes tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + (row.convex ? 'yes' : 'no') + '</td><td>' +
        root.Format.fixed(row.sh, 1) + '</td><td>' + root.Format.exact(row.vertices) +
        '</td><td>' + root.Format.fixed(row.decomposed, 1) + '</td><td>' +
        root.Format.fixed(row.sampled, 1) + '</td><td>' +
        root.Format.fixed(100 * row.error, 1) + '%</td></tr>';
    }).join(''));

    const empty = rows.filter(function (r) { return !r.convex && r.vertices === 0; }).length;
    const plausible = rows.filter(function (r) { return !r.convex && r.vertices > 0 && r.error > 0.05; }).length;
    const convexWorst = rows.filter(function (r) { return r.convex; })
      .reduce(function (worst, r) { return Math.max(worst, r.error); }, 0);

    root.Helpers.setText('pk-shapes-note',
      'Read the convex column against the error column. Every concave clip fails, in one of two ' +
      'ways: ' + root.Format.exact(empty) + ' return no polygon at all, which is at least obvious, ' +
      'and ' + root.Format.exact(plausible) + ' return a polygon with the wrong area, which is ' +
      'not. The convex rows sit at ' + root.Format.fixed(100 * convexWorst, 1) + '% or below, and ' +
      'that residue is the SAMPLER\'s error rather than the clipper\'s — a grid can only resolve a ' +
      'boundary to within one cell, so a fraction of a percent here means the two agree exactly ' +
      'as far as the reference can tell. The decomposition column matches the sampled column ' +
      'throughout, concave shapes included.');
  }

  function paintOps(rows, shown) {
    root.jQuery('#pk-ops tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.operation + (row.operation === shown ? ' (selected)' : '') +
        '</td><td>' + root.Format.fixed(row.area, 1) + '</td><td>' +
        root.Format.exact(row.hits) + '</td><td>' + root.Format.exact(row.cells) + '</td><td>' +
        root.Format.fixed(row.resolution, 4) + '</td></tr>';
    }).join(''));

    const intersection = rows[0].area;
    const union = rows[1].area;
    root.Helpers.setText('pk-ops-note',
      'Sampling answers all four operations with the same machinery and no case analysis, which is ' +
      'what makes it a usable oracle. Its error is one cell along the boundary, so the resolution ' +
      'column is the floor below which a difference means nothing. Note that union plus ' +
      'intersection equals the two areas added — ' + root.Format.fixed(union + intersection, 1) +
      ' here — which is a cheap consistency check on any clipper you write.');
  }

  function paintOffset(rows, chosen) {
    root.jQuery('#pk-minkowski tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Format.exact(row.corners) + (row.corners === chosen ? ' (selected)' : '') +
        '</td><td>' + root.Format.fixed(row.area, 1) + '</td><td>' +
        root.Format.fixed(row.trueArea, 1) + '</td><td>' +
        root.Format.fixed(100 * row.shortfall, 2) + '%</td><td>' +
        root.Format.exact(row.vertices) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pk-minkowski-note',
      'Offsetting a polygon outward by a radius is its Minkowski sum with a disc, and a disc is ' +
      'always a polygon in practice. The corner count is the approximation: at three corners the ' +
      'offset falls well short of the true area, and the shortfall shrinks with the square of the ' +
      'corner count. Every buffering library exposes this parameter and almost nobody sets it, ' +
      'which is why a buffered geometry is quietly smaller than the one that was asked for.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
