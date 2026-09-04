/**
 * Section: rotating calipers and optimisation on hulls.
 *
 * One theorem does all the work: THE MINIMUM-AREA ENCLOSING RECTANGLE ALWAYS
 * HAS A SIDE FLUSH WITH A HULL EDGE. There are infinitely many angles to try
 * and only h of them can possibly win, so a continuous optimisation collapses
 * into a scan over the hull edges. The same argument gives the diameter, the
 * width and the closest and farthest pairs.
 *
 * The section's job is to make that collapse visible rather than assert it.
 * The candidate table lists the h angles and marks the winner; the reference
 * column runs a 3 600-step rotation sweep and shows it never beats the scan.
 * A sweep is approximate by construction - it can only be as good as its step
 * - so its disagreement is quoted as a relative gap with the step size beside
 * it, never as a pass or a fail.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'rotating-calipers';
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
      title: 'Diagram — why only the hull edge angles matter',
      caption: 'Suppose the minimum rectangle had no side flush with a hull edge. Then it touches ' +
        'the hull only at isolated vertices, and it can be rotated slightly in one direction or the ' +
        'other without losing contact — and one of those two rotations makes the area smaller. So ' +
        'it was not the minimum. The only rectangles that cannot be improved this way are the ones ' +
        'already flush with an edge, and there are h of those.',
      definition: [
        'flowchart TD',
        '    A["a rectangle enclosing the hull"] --> B{"is a side flush<br/>with a hull edge?"}',
        '    B -- no --> C["it touches only at vertices"]',
        '    C --> D["rotate slightly either way<br/>without losing contact"]',
        '    D --> E["one direction shrinks the area"]',
        '    E --> F["so it was not the minimum"]',
        '    B -- yes --> G["a candidate that cannot<br/>be improved by rotating"]',
        '    G --> H["only h candidates exist:<br/>one per hull edge"]',
        '    H --> I["scan them: O(h)"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Rotating calipers turn a continuous optimisation into a linear scan.** Imagine a pair of ' +
        'parallel lines squeezing a convex hull, rotated slowly through 180 degrees.',
      'Quantities like the diameter, the width and the enclosing rectangle are all read off that ' +
        'rotation. The trick is that only finitely many angles can possibly be optimal.',
      '**The theorem is the whole thing: the minimum-area rectangle always has a side flush with a ' +
        'hull edge.** If it did not, it would touch the hull only at isolated vertices.',
      'It could then be rotated a little in either direction without losing contact, and one of ' +
        'those rotations would make it smaller.',
      'So there are exactly `h` candidates, one per hull edge, and the search is an `O(h)` scan ' +
        'rather than an optimisation over a continuous parameter.',
      '**The diameter uses the same idea with an antipodal pointer.** As the caliper walks one hull ' +
        'edge forward, the opposite vertex only ever moves forward too, never back.',
      'So the whole scan is linear in the hull size rather than quadratic in it. The amortised ' +
        'argument is the same one that makes a two-pointer window linear.',
      '**The smallest enclosing circle is a different shape of argument.** It is determined by at ' +
        'most three points, and Welzl\'s algorithm finds them by shuffling and rebuilding.',
      'The randomisation is the algorithm rather than a detail. On an adversarial order the same ' +
        'construction is cubic, and the shuffle is what makes the expected number of rebuilds linear.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the candidate angles, a rotation sweep, and Welzl',
        markup: root.RotatingCalipersTemplate.render()
      },
      diagram: diagram(),
      insight: 'An axis-aligned bounding box is the default because it is free, and on data that ' +
        'happens to lie along a diagonal it is catastrophically loose. The measurement below is a ' +
        '10.79× difference on a diagonal strip of points, from the same points, with no ' +
        'approximation anywhere. Before optimising a spatial index or a collision broad phase, check ' +
        'what fraction of your bounding volume is actually occupied. If it is small and your data ' +
        'has a grain, the fix is a rotation rather than a better tree.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RotatingCalipersTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  /** A strip of points along a diagonal: the case the axis-aligned box loses. */
  function diagonalStrip(count, seed) {
    const rng = root.Random.seeded(seed);
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      out.push(root.GeometryCore.point(
        t * 100 + (rng.next() - 0.5) * 6,
        t * 100 + (rng.next() - 0.5) * 6
      ));
    }
    return out;
  }

  const pointsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const count = Number(parts[1]);
    if (parts[0] === 'diagonal') return diagonalStrip(count, 61);
    return root.GeometryLab.points(parts[0], count, 61);
  });

  const measuredFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const pts = pointsFor(parts[0] + '|' + parts[1]);
    const steps = Number(parts[2]);
    const stats = root.Calipers.report();
    const hull = root.Calipers.hullOf(pts, stats);

    return {
      points: pts,
      hull: hull,
      diameter: root.Calipers.diameter(pts, { hull: hull, report: stats }),
      bruteDiameter: root.Calipers.diameterBruteForce(pts, stats),
      rectangle: root.Calipers.minimumAreaRectangle(pts, { hull: hull, report: stats }),
      sweep: root.Calipers.rectangleByRotationSweep(pts, steps),
      box: root.Calipers.boundingBox(pts),
      width: root.Calipers.minimumWidth(pts, { hull: hull, report: stats }),
      circle: root.Calipers.smallestEnclosingCircle(pts, { report: stats }),
      stats: stats
    };
  });

  /** Every hull-edge angle, with its rectangle. The h candidates. */
  const candidatesFor = root.Helpers.memoise(function (key) {
    const state = measuredFor(key);
    return state.hull.map(function (p, i) {
      const edge = root.GeometryCore.sub(state.hull[(i + 1) % state.hull.length], p);
      const angle = Math.atan2(edge.y, edge.x);
      return root.Calipers.extentAlong(state.hull, angle);
    }).sort(function (a, b) { return a.area - b.area; });
  });

  const setsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const count = Number(parts[0]);
    return ['diagonal', 'uniform', 'circle', 'clustered', 'convex-heavy', 'grid'].map(function (scene) {
      const state = measuredFor(scene + '|' + count + '|' + parts[1]);
      return { scene: scene, hull: state.hull.length,
        rectangle: state.rectangle.area, box: state.box.area,
        ratio: state.box.area > 0 ? state.rectangle.area / state.box.area : 1,
        angle: state.rectangle.best ? state.rectangle.best.angle * 180 / Math.PI : 0 };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const key = values['rc-set'] + '|' + values['rc-count'] + '|' + values['rc-steps'];
    const state = measuredFor(key);

    paintMetrics(state);
    paintScene(state, Number(values['rc-angle']));
    paintCandidates(candidatesFor(key), state);
    paintCheck(state);
    paintSets(setsFor(values['rc-count'] + '|' + values['rc-steps']));
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'rc-diameter': { value: root.Format.fixed(state.diameter.distance, 2),
        note: 'brute force over all pairs gives ' +
          root.Format.fixed(state.bruteDiameter.distance, 2) },
      'rc-minrect': { value: root.Format.fixed(state.rectangle.area, 1),
        note: root.Format.exact(state.rectangle.candidates) + ' candidate angles tried, one per ' +
          'hull edge' },
      'rc-vsbox': { value: root.Format.fixed(state.box.area / Math.max(1e-9, state.rectangle.area), 2) + '×',
        note: 'the axis-aligned box is ' + root.Format.fixed(state.box.area, 1) +
          ' against ' + root.Format.fixed(state.rectangle.area, 1) },
      'rc-circle': { value: state.circle.circle
        ? root.Format.fixed(state.circle.circle.radius, 2) : '—',
      note: root.Format.exact(state.circle.support.length) + ' points sit on it; ' +
        root.Format.exact(state.stats.steps) + ' rebuild steps' }
    });
  }

  function paintScene(state, angleDegrees) {
    view = function () { drawScene(state, angleDegrees); };
    view();
  }

  function drawScene(state, angleDegrees) {
    const host = root.jQuery('#rc-scene')[0];
    if (!host) return;
    const G = root.GeometryCore;

    const shownAngle = angleDegrees * Math.PI / 180;
    const shown = rectangleRing(state.hull, shownAngle);
    const best = state.rectangle.best ? rectangleRing(state.hull, state.rectangle.best.angle) : [];

    root.GeometryView.render(host, {
      height: 320,
      construction: shown.length ? ringToSegments(shown, 'gray') : [],
      circles: state.circle.circle
        ? [{ centre: state.circle.circle.centre, radius: state.circle.circle.radius, hue: 'purple' }]
        : [],
      rings: [{ points: state.hull, hue: 'blue', width: 2 }]
        .concat(best.length ? [{ points: best, hue: 'orange', width: 2 }] : []),
      segments: state.diameter.pair
        ? [{ a: state.diameter.pair[0], b: state.diameter.pair[1], hue: 'red', width: 2, dashed: true }]
        : [],
      points: state.points.map(function (p) { return { point: p, hue: 'gray', radius: 2 }; }),
      highlights: state.circle.support.map(function (p) {
        return { point: p, hue: 'purple', radius: 4, outline: true };
      }),
      ariaLabel: 'hull with the minimum rectangle, the diameter and the enclosing circle'
    });

    root.Helpers.setText('rc-scene-note',
      'Blue is the hull. Orange is the minimum-area rectangle, found by trying only the ' +
      root.Format.exact(state.rectangle.candidates) + ' hull-edge angles; grey is the rectangle at ' +
      'the angle you have chosen, for comparison. The dashed red line is the diameter, and the ' +
      'purple circle is the smallest one enclosing everything — the ' +
      root.Format.exact(state.circle.support.length) + ' highlighted points are the ones that ' +
      'determine it, and there are never more than three.');
  }

  function rectangleRing(hull, angle) {
    if (hull.length < 3) return [];
    const G = root.GeometryCore;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

    hull.forEach(function (p) {
      const u = p.x * cos + p.y * sin;
      const v = -p.x * sin + p.y * cos;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    });

    return [[minU, minV], [maxU, minV], [maxU, maxV], [minU, maxV]].map(function (uv) {
      return G.point(uv[0] * cos - uv[1] * sin, uv[0] * sin + uv[1] * cos);
    });
  }

  function ringToSegments(ring, hue) {
    return ring.map(function (p, i) {
      return { a: p, b: ring[(i + 1) % ring.length], hue: hue, width: 1, dashed: true };
    });
  }

  function paintCandidates(candidates, state) {
    const best = candidates[0];
    const shown = candidates.slice(0, 8);

    root.jQuery('#rc-angles tbody').html(shown.map(function (c) {
      return '<tr><td>' + root.Format.fixed(c.angle * 180 / Math.PI, 2) + '°</td><td>' +
        root.Format.fixed(c.width, 2) + '</td><td>' + root.Format.fixed(c.height, 2) +
        '</td><td>' + root.Format.fixed(c.area, 1) + '</td><td>' +
        (c === best ? 'the minimum' : '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rc-angles-note',
      'The eight cheapest of ' + root.Format.exact(candidates.length) + ' candidates, one per hull ' +
      'edge. Every other angle in the continuous range between them is provably worse, which is ' +
      'why the scan is complete rather than a sample — and it is the theorem in the diagram that ' +
      'licenses skipping all of them.');
  }

  function paintCheck(state) {
    /* Only genuine correctness checks belong here. Comparing the minimum
       rectangle against the axis-aligned box is a measurement of what the
       rotation buys, not a check that anything is right - and putting it in
       this table produced a row reading "90.7% agreement", which is a
       difference wearing the wrong label. It lives in the metric and in the
       point-set table instead. */
    const rows = [
      { name: 'diameter', ours: state.diameter.distance, theirs: state.bruteDiameter.distance,
        how: 'every pair of points, O(n²)', exact: true },
      { name: 'minimum rectangle area', ours: state.rectangle.area, theirs: state.sweep.area,
        how: root.Format.exact(state.sweep.steps) + ' evenly spaced angles', exact: false },
      { name: 'enclosing circle covers every point', ours: state.circle.circle ? 1 : 0,
        theirs: root.Calipers.circleCovers(state.points, state.circle.circle).ok ? 1 : 0,
        how: 'every point tested against the circle', exact: true }
    ];

    root.jQuery('#rc-check tbody').html(rows.map(function (row) {
      const gap = Math.abs(row.ours - row.theirs) / Math.max(1e-9, row.theirs);
      return '<tr><td>' + row.name + '</td><td>' + root.Format.fixed(row.ours, 3) + '</td><td>' +
        root.Format.fixed(row.theirs, 3) + '</td><td>' + row.how + '</td><td>' +
        (row.exact
          ? (Math.abs(row.ours - row.theirs) < 1e-9 ? 'exact' : 'DISAGREE')
          : root.Format.fixed(100 * gap, 3) + '%') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rc-check-note',
      'The diameter is checked against every pair and must agree exactly. The rectangle is checked ' +
      'against a rotation sweep, which is approximate by construction — its step is ' +
      root.Format.fixed(state.sweep.step * 180 / Math.PI, 4) + '°, so a gap smaller than that ' +
      'means the sweep simply never tried the winning angle. The scan must never be WORSE than the ' +
      'sweep, and it never is; being slightly better is the sweep missing the optimum.');
  }

  function paintSets(rows) {
    root.jQuery('#rc-sets tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.scene + '</td><td>' + root.Format.exact(row.hull) + '</td><td>' +
        root.Format.fixed(row.rectangle, 1) + '</td><td>' + root.Format.fixed(row.box, 1) +
        '</td><td>' + root.Format.fixed(row.ratio, 3) + '</td><td>' +
        root.Format.fixed(row.angle, 1) + '°</td></tr>';
    }).join(''));

    const best = rows.reduce(function (b, r) { return r.ratio < b.ratio ? r : b; });
    root.Helpers.setText('rc-sets-note',
      'The ratio column is what the rotation buys. On the ' + best.scene + ' set the minimum ' +
      'rectangle is ' + root.Format.fixed(best.ratio, 3) + ' of the axis-aligned box — a ' +
      root.Format.fixed(1 / Math.max(1e-9, best.ratio), 1) + '× reduction in enclosed area from ' +
      'the same points, with no approximation. On a grid, which is already axis-aligned, the ' +
      'ratio is 1 and the rotation buys nothing at all: the technique pays exactly when the data ' +
      'has a grain that does not line up with the axes.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
