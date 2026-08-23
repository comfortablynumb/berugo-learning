/**
 * Section: triangulation.
 *
 * Two different jobs share a name. Ear clipping takes a polygon and cuts it
 * into triangles; ANY valid set will do, and the O(n²) is the price of
 * re-scanning for an ear after each cut. Delaunay takes a point set and
 * produces the one triangulation that MAXIMISES THE MINIMUM ANGLE - which is
 * not an aesthetic preference. Skinny triangles are what make an interpolated
 * surface look wrong, so the mesh with the fewest of them is the one that
 * makes terrain and interpolation behave.
 *
 * The comparison table is the argument, and getting it honest took a second
 * attempt. Comparing against a FAN from one vertex is the obvious thing and it
 * is not a fair comparison: a fan covers only the region star-shaped from that
 * vertex rather than the convex hull, so it has a different triangle count over
 * a different area and "the same points, triangulated two ways" is not true of
 * it. The comparison here is Delaunay's own mesh with some diagonals flipped.
 * A flip of a convex quadrilateral is always legal, so the vertices, the
 * covered region and the triangle count are all identical and the only thing
 * that differs is the quality being measured.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'polygon-triangulation';
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
      title: 'Diagram — the edge flip, and the test that triggers it',
      caption: 'Four points make a quadrilateral that can be split two ways. The Delaunay choice is ' +
        'the one where neither triangle\'s circumcircle contains the opposite vertex — and the ' +
        'in-circle predicate is exactly that question. When it fails, flipping the shared diagonal ' +
        'fixes it, and the flip can break the property for a neighbouring pair, which is why the ' +
        'repair propagates.',
      definition: [
        'flowchart TD',
        '    Q["four points, one shared edge"] --> T["draw the circumcircle of<br/>one of the two triangles"]',
        '    T --> C{"is the opposite vertex<br/>inside that circle?"}',
        '    C -- no --> K["keep the diagonal:<br/>this pair is Delaunay"]',
        '    C -- yes --> F["flip the shared diagonal<br/>to the other pair"]',
        '    F --> P["the flip may break a<br/>neighbouring pair"]',
        '    P --> N["re-test the neighbours"]',
        '    N --> C',
        '    K --> D["no triangle contains another<br/>vertex in its circumcircle"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Ear clipping** takes a simple polygon and cuts off one triangle at a time. An *ear* is a ' +
          'vertex whose triangle with its two neighbours lies inside the polygon and contains no ' +
          'other vertex; cut it off and repeat. Every simple polygon has at least two ears, so the ' +
          'process always terminates, and it always produces exactly `n − 2` triangles. The `O(n²)` ' +
          'is the cost of re-scanning for an ear after each cut.',
        '**Delaunay triangulation is not "a" triangulation, it is a specific one**, defined by the ' +
          '*empty-circle property*: no triangle\'s circumcircle contains any other vertex. Among ' +
          'every possible triangulation of a point set, that one maximises the smallest angle — and ' +
          'it is unique unless four points are exactly co-circular.',
        '**Skinny triangles are the reason anyone cares.** Interpolating a value across a long thin ' +
          'triangle stretches it along the thin direction, which is what makes an interpolated ' +
          'terrain surface look creased. Delaunay is the arrangement with as few skinny triangles ' +
          'as the points allow, which is why it is the default mesh for interpolation, terrain and ' +
          'finite elements.',
        '**The in-circle predicate is where robustness arrives.** Bowyer-Watson deletes every ' +
          'triangle whose circumcircle contains the new point and re-triangulates the hole — and if ' +
          'the predicate is not robust, that hole is not a simple polygon and the mesh comes out ' +
          'with overlapping triangles. Four co-circular points, which a grid has everywhere, put ' +
          'the predicate exactly on the boundary it must decide.'
      ],
      demo: {
        title: 'Interactive demo — Delaunay, the same mesh flipped away from it, and ear clipping',
        markup: root.PolygonTriangulationTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a triangulated surface looks creased or an interpolation goes wrong at one ' +
        'spot, look at the angles rather than the code. Any valid triangulation joins the same ' +
        'points with the same number of triangles, so "it triangulated" tells you nothing — the ' +
        'measurement that matters is the smallest angle, and a mesh whose worst triangle is a ' +
        'degree wide will interpolate badly no matter how carefully the interpolation is written. ' +
        'That is also why the empty-circle property is worth checking directly rather than trusting ' +
        'the flip loop that was supposed to establish it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PolygonTriangulationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const meshFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const pts = root.GeometryLab.points(parts[0], Number(parts[1]), 41);
    const stats = root.Triangulation.report();
    const mesh = root.Triangulation.delaunay(pts, { report: stats });
    const check = root.Triangulation.checkDelaunay(mesh.points, mesh.triangles);
    /* The comparison triangulation is Delaunay's own, flipped away from the
       empty-circle property. Same points, same region, same triangle count -
       so the only thing that differs is the quality being measured. */
    const flipped = root.Triangulation.degrade(mesh.points, mesh.triangles, Number(parts[2]), 7);
    const flippedCheck = root.Triangulation.checkDelaunay(flipped.points, flipped.triangles);

    return { mesh: mesh, check: check, stats: stats, fan: flipped, fanCheck: flippedCheck,
      flips: Number(parts[2]),
      angles: root.Triangulation.angleProfile(mesh.points, mesh.triangles),
      fanAngles: root.Triangulation.angleProfile(flipped.points, flipped.triangles) };
  });

  const earsFor = root.Helpers.memoise(function (name) {
    const ring = root.GeometryLab.polygon(name);
    const stats = root.Triangulation.report();
    const clipped = root.Triangulation.earClip(ring, { report: stats });
    const area = clipped.triangles.reduce(function (sum, t) {
      return sum + root.Polygon.area([clipped.ring[t[0]], clipped.ring[t[1]], clipped.ring[t[2]]]);
    }, 0);

    return { ring: ring, clipped: clipped, stats: stats, area: area,
      original: root.Polygon.area(ring) };
  });

  const allEarsFor = root.Helpers.memoise(function () {
    return ['square', 'l-shape', 'chevron', 'star', 'comb', 'spiky'].map(function (name) {
      const state = earsFor(name);
      return { name: name, vertices: state.ring.length,
        triangles: state.clipped.triangles.length, expected: state.clipped.expected,
        earTests: state.stats.earTests,
        preserved: state.original > 0 ? state.area / state.original : 0 };
    });
  });

  /* Angles bucketed into ten-degree bins, for both triangulations. */
  const histogramFor = root.Helpers.memoise(function (key) {
    const state = meshFor(key);
    const bins = [];
    for (let i = 0; i < 9; i += 1) bins.push({ from: i * 10, delaunay: 0, fan: 0 });

    function fill(points, triangles, field) {
      triangles.forEach(function (t) {
        const angle = root.Triangulation.minimumAngle(points[t[0]], points[t[1]], points[t[2]]);
        const at = Math.min(8, Math.floor(angle / 10));
        bins[at][field] += 1;
      });
    }

    fill(state.mesh.points, state.mesh.triangles, 'delaunay');
    fill(state.fan.points, state.fan.triangles, 'fan');
    return bins;
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['tr-scene'] + '|' + values['tr-points'] + '|' + values['tr-flips'];
    const state = meshFor(key);

    paintMetrics(state, values['tr-mode'], values['tr-polygon']);
    paintScene(state, values['tr-mode'], values['tr-polygon']);
    paintCompare(state);
    paintHistogram(histogramFor(key), app);
    paintEars(allEarsFor(''));
  }

  function paintMetrics(state, mode, polygonName) {
    if (mode === 'ear-clipping') {
      const ears = earsFor(polygonName);
      root.MetricGrid.update({
        'tr-triangles': { value: root.Format.exact(ears.clipped.triangles.length),
          note: 'expected ' + root.Format.exact(ears.clipped.expected) + ' for ' +
            root.Format.exact(ears.ring.length) + ' vertices' },
        'tr-empty': { value: 'not applicable',
          note: 'ear clipping makes no claim about circumcircles' },
        'tr-minangle': { value: root.Format.fixed(
          root.Triangulation.angleProfile(ears.clipped.ring, ears.clipped.triangles).minimum, 2) + '°',
        note: 'any valid triangulation is acceptable here' },
        'tr-work': { value: root.Format.exact(ears.stats.earTests),
          note: 'ear tests, each scanning the remaining vertices' }
      });
      return;
    }

    root.MetricGrid.update({
      'tr-triangles': { value: root.Format.exact(state.mesh.triangles.length),
        note: 'over ' + root.Format.exact(state.mesh.points.length) + ' distinct points' },
      'tr-empty': { value: root.Format.exact(state.check.violations.length),
        note: state.check.ok ? 'every triangle checked against every vertex'
          : 'the empty-circle property does NOT hold' },
      /* The MEAN smallest angle is the number that moves. The single worst
         triangle often survives the flips untouched, so quoting the minimum
         alone makes the two meshes look identical when they are not. */
      'tr-minangle': { value: root.Format.fixed(state.angles.minimum, 2) + '°',
        note: 'mean smallest angle ' + root.Format.fixed(state.angles.mean, 2) +
          '°, against ' + root.Format.fixed(state.fanAngles.mean, 2) + '° after the flips' },
      'tr-work': { value: root.Format.exact(state.stats.orient + state.stats.inCircle),
        note: root.Format.exact(state.stats.inCircleExact + state.stats.orientExact) +
          ' needed exact arithmetic' }
    });
  }

  function paintScene(state, mode, polygonName) {
    view = function () { drawScene(state, mode, polygonName); };
    view();
  }

  function drawScene(state, mode, polygonName) {
    const host = root.jQuery('#tr-scene')[0];
    if (!host) return;

    if (mode === 'ear-clipping') return drawEars(host, earsFor(polygonName));
    return drawDelaunay(host, state);
  }

  function drawEars(host, ears) {
    const ring = ears.clipped.ring;
    root.GeometryView.render(host, {
      height: 300,
      rings: root.GeometryView.trianglesToRings(ring, ears.clipped.triangles, { hue: 'teal' })
        .concat([{ points: ring, hue: 'blue', width: 2 }]),
      points: ring.map(function (p) { return { point: p, hue: 'gray', radius: 3 }; }),
      highlights: ears.clipped.ears.map(function (i) {
        return { point: ring[i], hue: 'orange', radius: 4, outline: true };
      }),
      ariaLabel: 'polygon cut into triangles by ear clipping'
    });

    root.Helpers.setText('tr-scene-note',
      'Orange vertices are the ears, in the order they were cut. ' +
      root.Format.exact(ears.clipped.triangles.length) + ' triangles from ' +
      root.Format.exact(ears.ring.length) + ' vertices — always two fewer than the vertex count — ' +
      'found with ' + root.Format.exact(ears.stats.earTests) + ' ear tests. The triangle areas sum ' +
      'to ' + root.Format.fixed(ears.area, 1) + ' against the polygon\'s ' +
      root.Format.fixed(ears.original, 1) + '.');
  }

  function drawDelaunay(host, state) {
    const points = state.mesh.points;
    const triangles = state.mesh.triangles;
    const shown = triangles.length ? triangles[Math.floor(triangles.length / 2)] : null;
    const circle = shown
      ? { centre: root.Triangulation.circumcentre(points[shown[0]], points[shown[1]], points[shown[2]]),
        radius: root.Triangulation.circumradius(points[shown[0]], points[shown[1]], points[shown[2]]) }
      : null;

    root.GeometryView.render(host, {
      height: 300,
      bounds: root.GeometryView.boundsOf({ points: points }),
      circles: circle && circle.centre ? [{ centre: circle.centre, radius: circle.radius, hue: 'orange' }] : [],
      rings: root.GeometryView.trianglesToRings(points, triangles, { hue: 'teal' }),
      points: points.map(function (p) { return { point: p, hue: 'blue', radius: 2.5 }; }),
      highlights: shown ? shown.map(function (i) {
        return { point: points[i], hue: 'orange', radius: 4, outline: true };
      }) : [],
      ariaLabel: 'Delaunay triangulation with one circumcircle drawn'
    });

    root.Helpers.setText('tr-scene-note',
      'One triangle\'s circumcircle is drawn. The empty-circle property says no other vertex may ' +
      'lie inside it, and the check runs that test for every triangle against every vertex: ' +
      root.Format.exact(state.check.violations.length) + ' violations over ' +
      root.Format.exact(triangles.length) + ' triangles and ' +
      root.Format.exact(points.length) + ' points.');
  }

  function paintCompare(state) {
    const rows = [
      { name: 'Delaunay', triangles: state.mesh.triangles.length, angles: state.angles,
        violations: state.check.violations.length },
      { name: 'the same mesh after ' + root.Format.exact(state.flips) + ' legal flips',
        triangles: state.fan.triangles.length,
        angles: state.fanAngles, violations: state.fanCheck.violations.length }
    ];

    root.jQuery('#tr-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.triangles) + '</td><td>' +
        root.Format.fixed(row.angles.minimum, 2) + '°</td><td>' +
        root.Format.fixed(row.angles.mean, 2) + '°</td><td>' +
        root.Format.exact(row.angles.skinny) + '</td><td>' +
        root.Format.exact(row.violations) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tr-compare-note',
      'The second row is the first one with some of its diagonals flipped. Flipping a convex ' +
      'quadrilateral is always legal, so both rows have the identical vertices, the identical ' +
      'covered region and the identical triangle count — the only thing that changed is which ' +
      'diagonals are drawn. Mean smallest angle falls from ' +
      root.Format.fixed(state.angles.mean, 2) + '° to ' +
      root.Format.fixed(state.fanAngles.mean, 2) + '°, and empty-circle violations rise from 0 to ' +
      root.Format.exact(state.fanCheck.violations.length) + '. That is what "Delaunay maximises ' +
      'the minimum angle" means: every other triangulation of these points is reachable by flips, ' +
      'and every flip away from it is a flip towards worse angles.');
  }

  function paintHistogram(bins, app) {
    const host = root.jQuery('#tr-chart')[0];
    if (!host) return;

    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 220,
      series: [
        { label: 'Delaunay', points: bins.map(function (b) { return { x: b.from + 5, y: b.delaunay }; }) },
        { label: 'after legal flips', points: bins.map(function (b) { return { x: b.from + 5, y: b.fan }; }) }
      ],
      xLabel: 'smallest angle in the triangle, degrees',
      yLabel: 'triangles',
      legendHost: root.jQuery('#tr-legend')[0],
      ariaLabel: 'distribution of smallest angles for both triangulations'
    });

    const worstBin = bins[0];
    root.Helpers.setText('tr-chart-note',
      'The first bucket is triangles whose smallest angle is under ten degrees — the ones that ' +
      'ruin an interpolation. Delaunay puts ' + root.Format.exact(worstBin.delaunay) + ' triangles ' +
      'there and the flipped mesh puts ' + root.Format.exact(worstBin.fan) + '. Delaunay does not ' +
      'eliminate skinny triangles; it produces as few as the point set permits, and two points ' +
      'very close together force some however the mesh is drawn.');
  }

  function paintEars(rows) {
    root.jQuery('#tr-ears tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.vertices) + '</td><td>' +
        root.Format.exact(row.triangles) + '</td><td>' + root.Format.exact(row.expected) +
        '</td><td>' + root.Format.exact(row.earTests) + '</td><td>' +
        root.Format.fixed(100 * row.preserved, 2) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('tr-ears-note',
      'The triangle count is always vertices minus two, whatever the shape — that is a theorem, ' +
      'not a coincidence, and a run that produces a different number has failed. What the shape ' +
      'changes is the ear tests: a convex polygon finds an ear at the first vertex every time, ' +
      'while a comb has to walk past every reflex vertex to find one.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
