/**
 * Section: sweep-line algorithms.
 *
 * The sweep idea takes a paragraph and the implementation takes a week, and
 * the whole of the difference is DEGENERACY. A sweep is easy to describe -
 * move a line across the plane, keep what it currently crosses in order,
 * handle events as they arrive - and every interesting input is one where two
 * events land at the same place: shared endpoints, vertical segments, three
 * segments through one point, an intersection that coincides with an endpoint.
 *
 * So the section does not present a working sweep and admire it. It presents a
 * sweep beside a quadratic brute force that is obviously correct, runs both on
 * every degenerate fixture, and reports the disagreement count as a FIELD. A
 * sweep that finds fourteen of fifteen intersections is the normal failure in
 * this subject, and it looks exactly like a working one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sweep-line-algorithms';
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
      title: 'Diagram — the status structure at one sweep position',
      caption: 'The status holds exactly the segments the line currently crosses, ordered by where ' +
        'it crosses them. That order is what makes neighbours meaningful: two segments can only ' +
        'cross if they become adjacent in it first, so a sweep tests neighbours rather than pairs. ' +
        'A vertical segment has no single y at the sweep position, which is why it is carried as ' +
        'its own case rather than divided by zero.',
      definition: [
        'flowchart TD',
        '    Q["event queue: endpoints,<br/>sorted left to right"] --> E["take the next event"]',
        '    E --> R["remove segments ending here"]',
        '    R --> I["insert segments starting here,<br/>in y order at this x"]',
        '    I --> N["test what is now adjacent"]',
        '    N --> C{"do two of them cross?"}',
        '    C -- yes --> REC["record the crossing"]',
        '    C -- no --> E',
        '    REC --> E',
        '    I -.-> V["a vertical segment has no<br/>single y here: its own case"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A sweep replaces "check every pair" with "check every pair the moving line ever holds ' +
          'side by side". A vertical line travels left to right; an **event queue** holds the ' +
          'points where something changes, and a **status structure** holds the segments the line ' +
          'currently crosses, in the order it crosses them. Two segments can only cross if they ' +
          'first become neighbours in that order, so neighbours are the only pairs worth testing.',
        '**The paradigm is a paragraph and the implementation is the degeneracies.** Two segments ' +
          'sharing an endpoint, a vertical segment with no single y at the sweep position, three ' +
          'segments through one point, an intersection landing exactly on an endpoint — each is a ' +
          'case, each is easy to get subtly wrong, and none of them announces itself. The sweep ' +
          'below counts how many it met.',
        '**A collinear overlap is not a point.** Two segments lying along the same line and ' +
          'overlapping share a whole interval, so "the intersection" has to be *defined* rather ' +
          'than computed. Any consistent choice will do — this one reports the overlap\'s first ' +
          'point in sweep order — but it has to be the same choice everywhere, or two ' +
          'implementations that agree perfectly will appear to disagree.',
        '**The same sweep answers a different question.** Rectangle-union area sweeps x and keeps ' +
          'the covered y-length; the skyline problem sweeps and keeps the tallest live building. ' +
          'Compressing the coordinates first turns an unbounded axis into at most `2n` slabs, and ' +
          'the segment tree people reach for buys a log factor rather than correctness.'
      ],
      demo: {
        title: 'Interactive demo — the sweep, its status, seven fixtures and a rectangle union',
        markup: root.SweepLineAlgorithmsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Write the brute force first and keep it. It is ten lines, it is obviously correct, ' +
        'and it is the only thing that will ever tell you your sweep is wrong — because a sweep ' +
        'that mishandles a shared endpoint does not crash, it returns a slightly shorter list. ' +
        'Then run both on inputs built to be degenerate rather than on random ones: random ' +
        'segments almost never share an endpoint, and the fixtures that do are the fixtures that ' +
        'find the bug.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SweepLineAlgorithmsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const segmentsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GeometryLab.segments(parts[0], Number(parts[1]), 33);
  });

  const compareFor = root.Helpers.memoise(function (key) {
    return root.SweepLine.compare(segmentsFor(key));
  });

  const AWKWARD = {
    random: 'nothing — this is the easy case',
    'shared-endpoints': 'three segments meet at one point, so one event removes and adds at once',
    vertical: 'a vertical segment has no single y at the sweep position',
    'three-through-one': 'one intersection belongs to three segments, not two',
    'collinear-overlap': 'the meeting is an interval, so a single point has to be chosen',
    grid: 'every horizontal crosses every vertical: k is quadratic in n',
    sparse: 'almost no crossings, so the sweep is paying for a structure it never uses'
  };

  const casesFor = root.Helpers.memoise(function (key) {
    const count = Number(key);
    return root.GeometryLab.segmentScenes().map(function (scene) {
      const segs = root.GeometryLab.segments(scene, count, 33);
      const result = root.SweepLine.compare(segs);
      return { scene: scene, segments: segs.length, brute: result.brute.length,
        swept: result.swept.length, disagreements: result.disagreements,
        awkward: AWKWARD[scene] || '' };
    });
  });

  const unionFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    const rng = root.Random.seeded(77);
    const rects = [];

    for (let i = 0; i < n; i += 1) {
      const x0 = Math.round(rng.next() * 40);
      const y0 = Math.round(rng.next() * 40);
      rects.push({ x0: x0, y0: y0, x1: x0 + 4 + Math.round(rng.next() * 16),
        y1: y0 + 4 + Math.round(rng.next() * 16) });
    }

    const sweep = root.SweepLine.rectangleUnionArea(rects);
    const exact = root.SweepLine.rectangleUnionExact(rects);
    return { rects: rects, sweep: sweep, exact: exact,
      terms: Math.pow(2, rects.length) - 1,
      agree: exact !== null && Math.abs(sweep.area - exact) < 1e-9 };
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const key = values['sl-case'] + '|' + values['sl-count'];
    const segs = segmentsFor(key);
    const compared = compareFor(key);
    const position = sweepX(segs, Number(values['sl-position']));

    paintMetrics(compared);
    paintScene(segs, compared, position);
    paintStatus(segs, position);
    paintCases(casesFor(String(values['sl-count'])));
    paintUnion(unionFor(String(values['sl-rects'])));
  }

  function sweepX(segs, percent) {
    let minX = Infinity;
    let maxX = -Infinity;
    segs.forEach(function (s) {
      minX = Math.min(minX, s.a.x, s.b.x);
      maxX = Math.max(maxX, s.a.x, s.b.x);
    });
    return minX + (maxX - minX) * percent / 100;
  }

  function paintMetrics(compared) {
    const stats = compared.sweep;
    const degeneracies = stats.verticals + stats.sharedEndpoints + stats.multiplePoints;

    root.MetricGrid.update({
      'sl-found': { value: root.Format.exact(compared.swept.length),
        note: 'brute force found ' + root.Format.exact(compared.brute.length) },
      'sl-disagree': { value: root.Format.exact(compared.disagreements),
        note: compared.disagreements === 0 ? 'the two agree on every crossing'
          : 'the sweep and the oracle do NOT agree' },
      'sl-events': { value: root.Format.exact(stats.events),
        note: 'against ' + root.Format.exact(compared.bruteForce.pairsTested) +
          ' pairs tested by brute force' },
      'sl-degenerate': { value: root.Format.exact(degeneracies),
        note: root.Format.exact(stats.verticals) + ' vertical, ' +
          root.Format.exact(stats.sharedEndpoints) + ' shared, ' +
          root.Format.exact(stats.multiplePoints) + ' multi-point' }
    });
  }

  function paintScene(segs, compared, position) {
    view = function () { drawScene(segs, compared, position); };
    view();
  }

  function drawScene(segs, compared, position) {
    const host = root.jQuery('#sl-scene')[0];
    if (!host) return;

    const active = activeAt(segs, position);
    const activeSet = new Set(active.map(function (a) { return a.index; }));

    const drawn = segs.map(function (s, i) {
      return { a: s.a, b: s.b, hue: activeSet.has(i) ? 'teal' : 'gray',
        width: activeSet.has(i) ? 2 : 1 };
    });

    const bounds = root.GeometryView.boundsOf({ segments: segs });
    root.GeometryView.render(host, {
      height: 300,
      bounds: bounds,
      construction: [root.GeometryView.sweepLineAt(position, bounds)],
      segments: drawn,
      highlights: compared.swept.map(function (hit) {
        return { point: hit.point, hue: 'orange', radius: 4, outline: true };
      }),
      ariaLabel: 'segments with the sweep line and the intersections found'
    });

    root.Helpers.setText('sl-scene-note',
      'The dashed line is the sweep at x = ' + root.Format.fixed(position, 1) + '. Teal segments ' +
      'are the ones it currently crosses — ' + root.Format.exact(active.length) + ' of ' +
      root.Format.exact(segs.length) + ' — and orange dots are the crossings found. Only segments ' +
      'that are teal at the same moment can possibly cross.');
  }

  function activeAt(segs, position) {
    return segs.map(function (s, i) {
      const normalised = root.SweepLine.normalise(s, i);
      return { index: i, segment: normalised,
        y: root.SweepLine.yAt(normalised, position),
        live: normalised.from.x <= position && position <= normalised.to.x };
    }).filter(function (entry) { return entry.live; })
      .sort(function (a, b) { return a.y - b.y; });
  }

  function paintStatus(segs, position) {
    const active = activeAt(segs, position);

    root.jQuery('#sl-status tbody').html(active.map(function (entry, order) {
      const s = entry.segment;
      return '<tr><td>' + root.Format.exact(order + 1) + '</td><td>(' +
        root.Format.fixed(s.from.x, 0) + ', ' + root.Format.fixed(s.from.y, 0) + ') → (' +
        root.Format.fixed(s.to.x, 0) + ', ' + root.Format.fixed(s.to.y, 0) + ')</td><td>' +
        root.Format.fixed(entry.y, 2) + '</td><td>' + (s.vertical ? 'yes' : 'no') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">nothing crosses the line at this position</td></tr>');

    const verticals = active.filter(function (e) { return e.segment.vertical; }).length;
    root.Helpers.setText('sl-status-note',
      'This is the whole state a sweep carries. ' +
      (verticals > 0
        ? root.Format.exact(verticals) + ' of these are vertical, and their "y at the sweep" is a ' +
          'fiction — a vertical segment occupies a whole span at one x, which is why it needs its ' +
          'own case rather than a division.'
        : 'Nothing here is vertical, so every segment has exactly one y at this position and the ' +
          'ordering is unambiguous. Choose the vertical fixture to break that.'));
  }

  function paintCases(rows) {
    root.jQuery('#sl-cases tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.scene + '</td><td>' + root.Format.exact(row.segments) +
        '</td><td>' + root.Format.exact(row.brute) + '</td><td>' + root.Format.exact(row.swept) +
        '</td><td>' + root.Format.exact(row.disagreements) + '</td><td>' + row.awkward +
        '</td></tr>';
    }).join(''));

    const bad = rows.filter(function (r) { return r.disagreements > 0; }).length;
    root.Helpers.setText('sl-cases-note',
      bad === 0
        ? 'Every fixture agrees, including the four built to be degenerate. That is the claim ' +
          'worth making — and it is only worth making because the brute force is a separate ' +
          'implementation rather than the same code with a flag.'
        : root.Format.exact(bad) + ' fixtures disagree, and the count is reported rather than ' +
          'thrown: a sweep that finds most of the crossings is the normal failure here.');
  }

  function paintUnion(state) {
    root.jQuery('#sl-union tbody').html(
      '<tr><td>' + root.Format.exact(state.rects.length) + '</td><td>' +
      root.Format.fixed(state.sweep.area, 2) + '</td><td>' +
      (state.exact === null ? 'too many to enumerate' : root.Format.fixed(state.exact, 2)) +
      '</td><td>' + root.Format.exact(state.terms) + '</td><td>' +
      root.Format.exact(state.sweep.slabs) + '</td><td>' +
      (state.agree ? 'yes' : 'NO') + '</td></tr>');

    root.Helpers.setText('sl-union-note',
      'Inclusion-exclusion sums ' + root.Format.exact(state.terms) + ' terms — one per non-empty ' +
      'subset — and is exact, which is what makes it a usable oracle and useless as an algorithm: ' +
      'at 30 rectangles it would need over a billion. The sweep compresses the y-axis to ' +
      root.Format.exact(state.sweep.slabs) + ' slabs and walks the x-events once.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
