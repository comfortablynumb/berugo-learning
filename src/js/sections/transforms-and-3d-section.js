/**
 * Section: transforms and 3-D geometry.
 *
 * Nearly every "the rotation is wrong" bug is a CONVENTION mismatch rather
 * than a maths error, so the section states its conventions and then
 * demonstrates what happens when two pieces of code disagree about them. The
 * composition-order demo is the cheapest possible illustration: the same two
 * operations in the opposite order send one point to two different places, and
 * neither matrix is wrong.
 *
 * Gimbal lock is presented as a measurement rather than an anecdote, and the
 * measurement is NOT the one people reach for. Comparing the LENGTH of a Euler
 * interpolation against slerp's shows a few percent of excess at any pitch - a
 * Euler path is merely non-geodesic - and says nothing about the pole. The
 * honest measurement is that nudging yaw and nudging roll produce the same
 * rotation as the pitch approaches 90 degrees: the two axes have merged and a
 * degree of freedom is gone.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'transforms-and-3d';
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
      title: 'Diagram — the pipeline, and where a convention can be misread',
      caption: 'Four spaces and three transforms between them. Every arrow is a matrix, and every ' +
        'matrix carries an implicit answer to the same four questions: row or column vectors, ' +
        'pre- or post-multiply, radians or degrees, and which order the Euler axes are applied in. ' +
        'Two libraries that disagree about any one of them compose correctly and produce garbage.',
      definition: [
        'flowchart LR',
        '    M["model space"] -->|model matrix| W["world space"]',
        '    W -->|view matrix| V["view space"]',
        '    V -->|projection matrix| C["clip space"]',
        '    C -->|divide by w| N["normalised device"]',
        '    N -->|viewport| S["screen"]',
        '    M -.-> Q["row or column vectors?"]',
        '    W -.-> Q2["pre- or post-multiply?"]',
        '    V -.-> Q3["radians or degrees?"]',
        '    C -.-> Q4["which Euler order?"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Homogeneous coordinates make translation a matrix.** A 3-D point gets a fourth coordinate ' +
        '`w`, and a 4×4 matrix can then express rotation, scaling, shear, translation and ' +
        'perspective in one uniform thing that composes by multiplication.',
      'A point carries `w = 1` and a direction carries `w = 0`, which is exactly why a direction ' +
        'ignores translation without anyone writing a special case.',
      '**Composition does not commute, and the bug it causes looks like a maths error.** Rotating ' +
        'then translating is not translating then rotating, and the demo below sends one point to ' +
        'two different places using the identical operations.',
      'Neither matrix is wrong. They answer different questions, and the only defence is writing the ' +
        'convention down.',
      '**Gimbal lock is a lost degree of freedom, not a longer path.** At a pitch of 90 degrees the ' +
        'yaw axis and the roll axis have become the same axis, so nudging one produces the same ' +
        'rotation as nudging the other.',
      'One dimension of control has vanished. The measurement below shows it draining away ' +
        'gradually — about 46% gone by 45 degrees — which is why a camera starts feeling wrong long ' +
        'before it locks.',
      '**Möller-Trumbore returns barycentric coordinates, not just a yes or no.** Those two numbers ' +
        'interpolate anything stored at the vertices — colour, normal, a texture coordinate — ' +
        'without a second computation, which is why it is the ray-triangle test everyone uses.',
      'Whether a back-facing triangle counts is a rendering decision that reaches into the ' +
        'intersection routine, and leaving it implicit is how a mesh comes out with holes.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — composition order, gimbal lock measured, and ray-triangle',
        markup: root.TransformsAnd3dTemplate.render()
      },
      diagram: diagram(),
      insight: 'Write the convention in a comment at the top of the file: row-major or ' +
        'column-major, points as rows or columns, pre-multiply or post-multiply, radians or ' +
        'degrees, and the Euler order. It takes five lines and it is the cheapest bug fix in ' +
        'graphics. The failure mode of getting it wrong is not an exception — it is a scene that ' +
        'renders, looks almost right, and drifts. And when a rotation misbehaves near straight up ' +
        'or straight down, stop debugging the maths. That is the pole: the representation has lost ' +
        'a degree of freedom there, and the fix is quaternions rather than a special case.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TransformsAnd3dTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const SHAPE = [[0, 0], [30, 0], [30, 12], [12, 12], [12, 24], [0, 24]];

  function shapePoints() {
    return SHAPE.map(function (p) { return root.Transforms3D.vec3(p[0], p[1], 0); });
  }

  const pairFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const M = root.Transforms3D;
    const angle = Number(parts[1]) * Math.PI / 180;
    const shift = Number(parts[2]);

    const rotate = M.rotationZ(angle);
    const translate = M.translation(shift, 0, 0);
    const scale = M.scaling(1.6, 0.6, 1);

    const pairs = {
      'rotate-then-translate': [M.compose(rotate, translate), M.compose(translate, rotate)],
      'translate-then-rotate': [M.compose(translate, rotate), M.compose(rotate, translate)],
      'scale-then-rotate': [M.compose(rotate, scale), M.compose(scale, rotate)],
      'rotate-then-scale': [M.compose(scale, rotate), M.compose(rotate, scale)]
    };
    const chosen = pairs[parts[0]] || pairs['rotate-then-translate'];

    return { first: chosen[0], second: chosen[1],
      firstPoints: shapePoints().map(function (p) { return M.apply(chosen[0], p); }),
      secondPoints: shapePoints().map(function (p) { return M.apply(chosen[1], p); }) };
  });

  const gimbalFor = root.Helpers.memoise(function () {
    return [0, 15, 30, 45, 60, 75, 85, 89, 89.9, 90].map(function (degrees) {
      return root.Transforms3D.gimbalCoupling(degrees * Math.PI / 180, 0.01);
    });
  });

  /** A fixed bundle of rays against a fixed bundle of triangles. */
  const raysFor = root.Helpers.memoise(function (key) {
    const M = root.Transforms3D;
    const rng = root.Random.seeded(97);
    const count = Number(key);
    const stats = M.report();
    let disagreements = 0;
    let roundTrips = 0;

    for (let i = 0; i < count; i += 1) {
      const a = M.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
      const b = M.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
      const c = M.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
      const origin = M.vec3(rng.next() * 6 - 3, rng.next() * 6 - 3, -5);
      const direction = M.normalise3(M.vec3(rng.next() * 0.6 - 0.3, rng.next() * 0.6 - 0.3, 1));

      const fast = M.rayTriangle(origin, direction, a, b, c, { report: stats });
      const reference = M.rayTrianglePlane(origin, direction, a, b, c);

      if (Boolean(fast) !== Boolean(reference)) { disagreements += 1; continue; }
      if (!fast) continue;
      if (Math.abs(fast.t - reference.t) > 1e-6) disagreements += 1;

      const rebuilt = M.fromBarycentric(a, b, c, fast.u, fast.v);
      if (Math.abs(rebuilt.x - fast.point.x) > 1e-6 ||
        Math.abs(rebuilt.y - fast.point.y) > 1e-6 ||
        Math.abs(rebuilt.z - fast.point.z) > 1e-6) roundTrips += 1;
    }
    return { stats: stats, disagreements: disagreements, roundTrips: roundTrips, count: count };
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['t3-order'] + '|' + values['t3-angle'] + '|' + values['t3-shift'];
    const pair = pairFor(key);
    const gimbal = gimbalFor('');
    const rays = raysFor('20000');
    const pitch = Number(values['t3-pitch']);

    paintMetrics(pair, pitch, rays);
    paintScene(pair);
    paintMatrix(pair);
    paintGimbalChart(gimbal, app);
    paintGimbalTable(gimbal);
    paintRays(rays);
  }

  function paintMetrics(pair, pitch, rays) {
    const M = root.Transforms3D;
    const a = M.apply(pair.first, M.vec3(1, 0, 0));
    const b = M.apply(pair.second, M.vec3(1, 0, 0));
    const gap = M.length3(M.sub3(a, b));
    const coupling = M.gimbalCoupling(pitch * Math.PI / 180, 0.01);

    root.MetricGrid.update({
      't3-moved': { value: root.Format.fixed(gap, 2),
        note: 'the point (1, 0, 0) lands ' + root.Format.fixed(gap, 2) +
          ' apart under the two orders' },
      't3-freedom': { value: root.Format.fixed(100 * coupling.freedomLost, 2) + '%',
        note: 'at pitch ' + root.Format.fixed(pitch, 1) + '°, against the gap at pitch zero' },
      't3-rayhits': { value: root.Format.exact(rays.stats.hits),
        note: 'of ' + root.Format.exact(rays.count) + ' rays cast at random triangles' },
      't3-raycheck': { value: root.Format.exact(rays.disagreements + rays.roundTrips),
        note: rays.disagreements + rays.roundTrips === 0
          ? 'including the barycentric round-trip on every hit'
          : 'the two routines do NOT agree' }
    });
  }

  function paintScene(pair) {
    view = function () { drawScene(pair); };
    view();
  }

  function drawScene(pair) {
    const host = root.jQuery('#t3-scene')[0];
    if (!host) return;
    const flat = function (list) {
      return list.map(function (v) { return root.GeometryCore.point(v.x, v.y); });
    };
    const original = flat(shapePoints());

    root.GeometryView.render(host, {
      height: 300,
      rings: [
        { points: original, hue: 'gray', width: 1, dashed: true },
        { points: flat(pair.firstPoints), hue: 'blue', width: 2 },
        { points: flat(pair.secondPoints), hue: 'orange', width: 2 }
      ],
      ariaLabel: 'one shape under two composition orders'
    });

    root.Helpers.setText('t3-scene-note',
      'The dashed grey outline is the shape before any transform. Blue and orange are the same two ' +
      'operations applied in opposite orders — not two different transforms, the SAME two. Neither ' +
      'is wrong, and code that assumes the other convention produces the other outline.');
  }

  function rowText(m, row) {
    return [0, 1, 2, 3].map(function (col) {
      return root.Format.fixed(m[row * 4 + col], 2);
    }).join('  ');
  }

  function pointText(v) {
    return '(' + root.Format.fixed(v.x, 1) + ', ' + root.Format.fixed(v.y, 1) + ', ' +
      root.Format.fixed(v.z, 1) + ')';
  }

  function paintMatrix(pair) {
    const M = root.Transforms3D;
    const rows = [
      { name: 'as shown in blue', m: pair.first },
      { name: 'as shown in orange', m: pair.second }
    ];

    root.jQuery('#t3-matrix tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td><code>' + rowText(row.m, 0) +
        '</code></td><td><code>' + rowText(row.m, 1) + '</code></td><td>' +
        pointText(M.apply(row.m, M.vec3(1, 0, 0))) + '</td><td>' +
        pointText(M.apply(row.m, M.vec3(0, 0, 0))) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('t3-matrix-note',
      'The two matrices differ, and so does where they send the origin — which is the tell. A pure ' +
      'rotation fixes the origin; a composition that translates first does not. If a scene is ' +
      'rotating about the wrong point, that is this bug, and no amount of adjusting the angle will ' +
      'fix it.');
  }

  function paintGimbalChart(gimbal, app) {
    const host = root.jQuery('#t3-chart')[0];
    if (!host) return;

    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 220,
      series: [
        { label: 'rotational freedom lost, %',
          points: gimbal.map(function (g) {
            return { x: g.pitchDegrees, y: 100 * g.freedomLost };
          }) }
      ],
      xLabel: 'pitch, degrees',
      yLabel: 'freedom lost, percent',
      legendHost: root.jQuery('#t3-legend')[0],
      ariaLabel: 'rotational freedom lost against pitch'
    });

    root.Helpers.setText('t3-chart-note',
      'The curve does not sit at zero and then jump at ninety degrees. Freedom drains away for the ' +
      'whole approach to the pole — roughly half of it is gone by 45 degrees — which is why a ' +
      'camera controller starts feeling sluggish and imprecise long before anything actually ' +
      'locks, and why "it only breaks at exactly 90" is the wrong mental model.');
  }

  function meaning(entry) {
    if (entry.freedomLost < 0.05) return 'the two axes are essentially independent';
    if (entry.freedomLost < 0.5) return 'noticeably coupled';
    if (entry.freedomLost < 0.95) return 'most control over one axis is gone';
    return 'the axes have merged: one degree of freedom no longer exists';
  }

  function paintGimbalTable(gimbal) {
    root.jQuery('#t3-gimbal tbody').html(gimbal.map(function (entry) {
      return '<tr><td>' + root.Format.fixed(entry.pitchDegrees, 1) + '°</td><td>' +
        root.Format.fixed(entry.gapDegrees, 4) + '°</td><td>' +
        root.Format.fixed(entry.baselineDegrees, 4) + '°</td><td>' +
        root.Format.fixed(100 * entry.freedomLost, 2) + '%</td><td>' + meaning(entry) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('t3-gimbal-note',
      'Nudge yaw by a hundredth of a radian, and separately nudge roll by the same amount the ' +
      'other way. Away from the pole those are two different rotations about two different axes, ' +
      'so the results sit apart. At ninety degrees they are the SAME rotation and the gap is zero ' +
      '— which is what "a degree of freedom is gone" means, stated as a number. Note the baseline ' +
      'is the gap at pitch zero rather than twice the nudge: two nudges about perpendicular axes ' +
      'differ by the nudge times root two, not by twice it.');
  }

  function paintRays(rays) {
    const s = rays.stats;
    root.jQuery('#t3-ray tbody').html(
      '<tr><td>' + root.Format.exact(s.rayTests) + '</td><td>' + root.Format.exact(s.hits) +
      '</td><td>' + root.Format.exact(s.misses) + '</td><td>' + root.Format.exact(s.parallel) +
      '</td><td>' + root.Format.exact(s.edgeCases) + '</td><td>' +
      root.Format.exact(rays.roundTrips) + '</td><td>' +
      root.Format.exact(rays.disagreements) + '</td></tr>');

    root.Helpers.setText('t3-ray-note',
      'The reference is not the same routine with a flag — it intersects the ray with the ' +
      'triangle\'s PLANE and then tests the point against three edge cross products, which is a ' +
      'completely different structure. Agreement between two implementations that share no ' +
      'algebra is worth something; agreement between one routine and itself is not. The ' +
      'barycentric column re-derives the hit point from u and v and checks it lands back where the ' +
      'routine said it did.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
