/**
 * Section: polygons, areas and containment.
 *
 * The pentagram is the whole section. At its centre, ray casting counts two
 * crossings and says OUTSIDE; the winding number counts two full turns and
 * says INSIDE. Neither is a bug. They are two different fill rules, and the
 * polygon carries no information about which one its author meant - so the
 * question "is this point inside" does not have an answer until somebody
 * chooses. SVG's default is the non-zero rule and its `evenodd` is the other;
 * most GIS libraries chose the opposite default. Code that assumes there is a
 * single answer breaks the first time it meets the other convention.
 *
 * The third state matters as much. Containment here returns 'in', 'out' or
 * 'boundary', because collapsing 'boundary' into either of the others is a
 * decision - and making it silently is how two adjacent polygons come to
 * disagree about who owns the edge between them.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'polygon-containment';
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
      title: 'Diagram — the two fill rules on one self-overlapping region',
      caption: 'Both tests shoot the same ray. Ray casting counts crossings and asks whether the ' +
        'count is odd; the winding number counts them with a sign and asks whether the total is ' +
        'non-zero. On a region the ring encircles twice, the crossings are even and the winding is ' +
        'two — so the two rules give opposite answers about the same point.',
      definition: [
        'flowchart TD',
        '    P["a point, and a ray going right"] --> C["count the edges the ray crosses"]',
        '    C --> E["even-odd rule:<br/>odd means inside"]',
        '    C --> W["non-zero rule: count<br/>+1 upward, -1 downward"]',
        '    E --> E1["2 crossings -> OUTSIDE"]',
        '    W --> W1["+1 and +1 = 2 -> INSIDE"]',
        '    E1 --> D{"the same point,<br/>two answers"}',
        '    W1 --> D',
        '    D --> R["the polygon does not say<br/>which rule it meant"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The shoelace formula gives a polygon\'s area from its vertices alone.** Sum ' +
        '`x_i·y_(i+1) − x_(i+1)·y_i` around the ring and halve it.',
      'The result is *signed*: positive when the ring runs counter-clockwise, negative when it runs ' +
        'clockwise. That sign is the cheapest way to ask which way round a polygon is wound, which ' +
        'matters to every routine downstream.',
      '**Containment has three answers, not two.** A point is inside, outside, or exactly on the ' +
        'boundary.',
      'Collapsing the third into one of the others is a decision. Making it without noticing is how ' +
        'two adjacent polygons end up both claiming a point on their shared edge, or neither ' +
        'claiming it.',
      '**Ray casting and the winding number disagree, and neither is wrong.** Ray casting shoots a ' +
        'ray and asks whether the crossing count is odd. The winding number counts the same ' +
        'crossings with a sign, and asks whether the ring goes round the point at all.',
      'On a simple polygon they always agree. On a self-intersecting one they do not, and which ' +
        'answer is "right" depends on a fill rule that lives in your renderer rather than in your ' +
        'data.',
      '**Simplification trades vertices for fidelity, and the two standard methods give up ' +
        'different things.** Douglas-Peucker keeps whatever is furthest from the current chord, so ' +
        'it preserves spikes and can move the line anywhere inside the tolerance.',
      'Visvalingam removes the vertex whose triangle with its neighbours is smallest, so it gives up ' +
        'spikes before it gives up overall shape.',
      'Cartographers prefer the second. It is the wrong choice when the spikes are the data.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — two fill rules, eight polygons, and two simplifiers',
        markup: root.PolygonContainmentTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a containment test disagrees with a user\'s eyes, the bug is almost never in ' +
        'the arithmetic. It is that the polygon is not simple and nobody decided which fill rule ' +
        'applies. Before reaching for a tolerance, check `isSimple`. A self-intersecting ring makes ' +
        '"inside" ambiguous rather than difficult, and no amount of numerical care will settle a ' +
        'question that has two defensible answers. Decide the rule, write it down next to the data, ' +
        'and the disagreement stops being mysterious.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PolygonContainmentTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const ringFor = root.Helpers.memoise(function (name) {
    return root.GeometryLab.polygon(name);
  });

  /** A grid of probes over the polygon's bounding box, with both verdicts. */
  const probesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const ring = ringFor(parts[0]);
    const steps = Number(parts[1]);
    const xs = ring.map(function (p) { return p.x; });
    const ys = ring.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    const out = [];

    for (let iy = 0; iy < steps; iy += 1) {
      for (let ix = 0; ix < steps; ix += 1) {
        const p = root.GeometryCore.point(
          minX + (ix + 0.5) * (maxX - minX) / steps,
          minY + (iy + 0.5) * (maxY - minY) / steps
        );
        const verdict = root.Polygon.contains(ring, p);
        out.push({ point: p, ray: verdict.ray, winding: verdict.winding,
          crossings: verdict.crossings, windingCount: verdict.windingCount,
          agree: verdict.agree });
      }
    }
    return out;
  });

  const shapeSummaryFor = root.Helpers.memoise(function (key) {
    const steps = Number(key);
    return root.GeometryLab.polygonNames().map(function (name) {
      const ring = ringFor(name);
      const probes = probesFor(name + '|' + steps);
      return {
        name: name,
        vertices: ring.length,
        area: root.Polygon.area(ring),
        convex: root.Polygon.isConvex(ring),
        simple: root.Polygon.isSimple(ring),
        disagreements: probes.filter(function (p) { return !p.agree; }).length,
        probes: probes.length
      };
    });
  });

  const simplifiedFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const ring = ringFor(parts[0]);
    const tolerance = Number(parts[1]);
    if (tolerance <= 0) return { ring: ring, moved: 0 };

    const dp = root.Polygon.douglasPeucker(ring.concat([ring[0]]), tolerance).slice(0, -1);
    const target = Math.max(3, ring.length - Math.round(tolerance / 2));
    const vw = root.Polygon.visvalingam(ring, target);

    return { 'douglas-peucker': dp, visvalingam: vw };
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const shape = values['pc-shape'];
    const ring = ringFor(shape);
    const probes = probesFor(shape + '|' + values['pc-probes']);

    paintMetrics(ring, probes);
    paintScene(ring, probes);
    paintProbeTable(ring, probes);
    paintShapes(shapeSummaryFor(String(values['pc-probes'])));
    paintSimplify(shape, ring, Number(values['pc-simplify']), values['pc-method']);
  }

  function paintMetrics(ring, probes) {
    const centre = root.Polygon.centroid(ring) || root.GeometryCore.point(0, 0);
    const atCentre = root.Polygon.windingNumber(ring, centre);
    const disagreeing = probes.filter(function (p) { return !p.agree; }).length;

    root.MetricGrid.update({
      'pc-area': { value: root.Format.fixed(root.Polygon.area(ring), 2),
        note: root.Polygon.isCounterClockwise(ring) ? 'wound counter-clockwise' : 'wound clockwise' },
      'pc-winding': { value: root.Format.exact(atCentre.winding),
        note: Math.abs(atCentre.winding) > 1 ? 'the ring encircles its own centroid more than once'
          : 'a single turn, or none' },
      'pc-disagree': { value: root.Format.exact(disagreeing),
        note: root.Format.fixed(100 * disagreeing / Math.max(1, probes.length), 1) + '% of ' +
          root.Format.exact(probes.length) + ' probes' },
      'pc-selfint': { value: root.Format.exact(root.Polygon.selfIntersections(ring).length),
        note: root.Polygon.isSimple(ring) ? 'the ring is simple' : 'the ring crosses itself' }
    });
  }

  function paintScene(ring, probes) {
    view = function () { drawScene(ring, probes); };
    view();
  }

  function drawScene(ring, probes) {
    const host = root.jQuery('#pc-scene')[0];
    if (!host) return;

    const dots = probes.map(function (p) {
      if (!p.agree) return { point: p.point, hue: 'red', radius: 3.5, outline: true };
      if (p.ray === root.Polygon.BOUNDARY) return { point: p.point, hue: 'amber', radius: 2.5 };
      if (p.ray === root.Polygon.IN) return { point: p.point, hue: 'teal', radius: 2 };
      return { point: p.point, hue: 'gray', radius: 1.5 };
    });

    root.GeometryView.render(host, {
      height: 300,
      rings: [{ points: ring, hue: 'blue', width: 2 }],
      points: dots,
      ariaLabel: 'polygon with probe points coloured by containment verdict'
    });

    const disagreeing = probes.filter(function (p) { return !p.agree; }).length;
    root.Helpers.setText('pc-scene-note',
      'Teal is inside by both rules, grey outside by both, amber exactly on the boundary. Red is a ' +
      'point the two rules answer differently — ' + root.Format.exact(disagreeing) + ' of them ' +
      'here. A simple polygon never produces a red dot however fine the grid.');
  }

  function paintProbeTable(ring, probes) {
    const interesting = probes.filter(function (p) { return !p.agree; })
      .concat(probes.filter(function (p) { return p.ray === root.Polygon.BOUNDARY; }))
      .concat(probes.filter(function (p) { return p.agree && p.ray === root.Polygon.IN; }))
      .concat(probes.filter(function (p) { return p.agree && p.ray === root.Polygon.OUT; }))
      .slice(0, 10);

    root.jQuery('#pc-probe tbody').html(interesting.map(function (p) {
      return '<tr><td>(' + root.Format.fixed(p.point.x, 1) + ', ' +
        root.Format.fixed(p.point.y, 1) + ')</td><td>' + root.Format.exact(p.crossings) +
        '</td><td>' + p.ray + '</td><td>' + root.Format.exact(p.windingCount) + '</td><td>' +
        p.winding + '</td></tr>';
    }).join(''));

    const disagreeing = probes.filter(function (p) { return !p.agree; }).length;
    root.Helpers.setText('pc-probe-note',
      disagreeing > 0
        ? 'The disagreements are listed first. Look at the crossing count against the winding ' +
          'number: an even number of crossings makes the even-odd rule say outside, while a ' +
          'non-zero winding makes the other rule say inside. Both counted correctly.'
        : 'This polygon is simple, so every probe agrees. Switch to the pentagram or the bowtie to ' +
          'make the two rules part company.');
  }

  function paintShapes(rows) {
    root.jQuery('#pc-shapes tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.vertices) + '</td><td>' +
        root.Format.fixed(row.area, 1) + '</td><td>' + (row.convex ? 'yes' : 'no') + '</td><td>' +
        (row.simple ? 'yes' : 'no') + '</td><td>' + root.Format.exact(row.disagreements) +
        '</td></tr>';
    }).join(''));

    const broken = rows.filter(function (r) { return !r.simple; });
    const quiet = broken.filter(function (r) { return r.disagreements === 0; });

    root.Helpers.setText('pc-shapes-note',
      'Crossing itself is necessary for a disagreement and not sufficient. Every simple polygon ' +
      'here has zero, and ' + root.Format.exact(quiet.length) + ' of the ' +
      root.Format.exact(broken.length) + ' that are not simple also have zero — the bowtie crosses ' +
      'itself, but each of its two lobes is encircled exactly once, so an odd crossing count and a ' +
      'non-zero winding still say the same thing. A disagreement needs a region the ring goes ' +
      'round TWICE, which is what the pentagram has and the bowtie does not. Note also that the ' +
      'pentagram\'s five turns all go the same way: turn direction alone does not make a polygon ' +
      'convex, and the turning number is what settles it.');
  }

  function paintSimplify(name, ring, tolerance, method) {
    if (tolerance <= 0) {
      root.jQuery('#pc-simplify-table tbody').html(
        '<tr><td>none — tolerance is zero</td><td>' + root.Format.exact(ring.length) +
        '</td><td>100.0%</td><td>0.00</td><td>' + (root.Polygon.isSimple(ring) ? 'yes' : 'no') +
        '</td></tr>');
      root.Helpers.setText('pc-simplify-note',
        'Raise the tolerance to compare the two methods on this shape.');
      return;
    }

    const simplified = simplifiedFor(name + '|' + tolerance);
    const rows = ['douglas-peucker', 'visvalingam'].map(function (key) {
      const out = simplified[key] || ring;
      return { name: key, ring: out, vertices: out.length,
        area: root.Polygon.area(out), moved: worstShift(ring, out),
        simple: out.length >= 3 && root.Polygon.isSimple(out) };
    });

    const base = root.Polygon.area(ring);
    root.jQuery('#pc-simplify-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + (row.name === method ? ' (shown)' : '') + '</td><td>' +
        root.Format.exact(row.vertices) + '</td><td>' +
        root.Format.fixed(100 * row.area / Math.max(1e-9, base), 1) + '%</td><td>' +
        root.Format.fixed(row.moved, 2) + '</td><td>' + (row.simple ? 'yes' : 'no') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('pc-simplify-note',
      'Both methods drop vertices; what differs is which ones. Douglas-Peucker keeps the point ' +
      'furthest from the chord, so a spike survives and the area can shift. Visvalingam removes ' +
      'the smallest triangle, so spikes go first and the outline stays closer to the original — ' +
      'which is why it is the cartographer\'s choice, and the wrong one when the spikes are the ' +
      'data you came for.');
  }

  /** The furthest any original vertex now sits from the simplified outline. */
  function worstShift(original, simplified) {
    if (simplified.length < 2) return 0;
    let worst = 0;

    original.forEach(function (p) {
      let nearest = Infinity;
      for (let i = 0; i < simplified.length; i += 1) {
        const a = simplified[i];
        const b = simplified[(i + 1) % simplified.length];
        nearest = Math.min(nearest, root.Polygon.pointLineDistance(p, a, b));
      }
      worst = Math.max(worst, nearest);
    });
    return worst;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
