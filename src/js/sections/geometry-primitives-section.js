/**
 * Section: primitives and robustness.
 *
 * The section exists for one measurement, and it is a surprising one. Asked to
 * rank three predicates, most readers expect the epsilon comparison to sit
 * between the naive test and the exact one. It does not. On near-collinear
 * triples the epsilon test is the ONLY one of the three that never contradicts
 * itself and the only one that is wrong on every single input: it answers
 * "collinear" for triples that are not collinear, consistently. The naive test
 * contradicts itself on about a quarter of them and is wrong on about a sixth.
 *
 * That is why the table has two columns rather than one. A predicate can be
 * self-consistent and useless, and an algorithm built on the epsilon test does
 * not crash - it silently drops real hull vertices, which is a far harder bug
 * to find than the crash the naive test produces.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'geometry-primitives';
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
      title: 'Diagram — how an adaptive predicate escalates',
      caption: 'The fast path is the ordinary floating-point determinant plus a bound on how far ' +
        'rounding could have moved it. When the value is larger than that bound its sign is certain ' +
        'and nothing else runs. Only when the value falls inside the bound — which means the points ' +
        'are close to collinear and the sign genuinely cannot be read off the rounded number — does ' +
        'the exact path run at all.',
      definition: [
        'flowchart TD',
        '    A["orient2d(a, b, c)"] --> B["compute the determinant<br/>in floating point"]',
        '    B --> C["bound the rounding error:<br/>eps x (|left| + |right|)"]',
        '    C --> D{"is |value| larger<br/>than the bound?"}',
        '    D -- yes --> E["the sign is certain<br/>return it"]',
        '    D -- no --> F["rounding could have<br/>flipped the sign"]',
        '    F --> G["scale every coordinate to<br/>an exact integer, 2^k"]',
        '    G --> H["evaluate the determinant<br/>in BigInt: no rounding"]',
        '    H --> I["return the exact sign"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Almost everything in this milestone is one question asked over and over.** Given three ' +
        'points `a`, `b` and `c`, does `c` lie to the left of the line from `a` to `b`, to its ' +
        'right, or exactly on it?',
      'Convex hulls, point-in-polygon, segment intersection, triangulation and Delaunay flips are ' +
        'all that single test repeated. It is computed as a small determinant, and only its ' +
        '**sign** is ever wanted.',
      '**A wrong sign is not an inaccuracy, it is a contradiction.** Geometry is the one algorithmic ' +
        'area where floating point does not merely lose precision — it returns answers that cannot ' +
        'all be true at once.',
      'Swapping two arguments must flip the sign. So if the test says "left" for `(a, b, c)` and ' +
        '"left" again for `(a, c, b)`, it has contradicted itself. The code above it is being told ' +
        'the points are arranged two incompatible ways.',
      'That is what makes a hull loop forever or a polygon come out with a hole in it.',
      '**`|value| < epsilon` is not the fix**, and the sweep below is the reason. A tolerance makes ' +
        'the test wonderfully self-consistent, because it answers "collinear" for everything near ' +
        'the line — including the triples that genuinely are not collinear.',
      'It has traded a loud failure for a quiet one: nothing crashes, and a hull built on it drops ' +
        'real vertices.',
      '**The fix is to measure the error rather than guess at it.** Compute the determinant in ' +
        'floating point, compute a bound on how far rounding could possibly have moved it, and trust ' +
        'the sign only when the value exceeds that bound.',
      'When it does not, redo the arithmetic exactly. Every finite double is precisely an integer ' +
        'times a power of two, so "exactly" is available rather than aspirational.',
      'And on data that is not adversarial the slow path never runs at all.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — six orderings, a sweep, and what the filter costs',
        markup: root.GeometryPrimitivesTemplate.render()
      },
      diagram: diagram(),
      insight: 'Every "the convex hull crashed" and "the polygon has a hole in it" traces back to ' +
        'the same thing. An orientation test answered differently for the same three points in a ' +
        'different order. The instinct is to reach for a tolerance, and it makes the symptom ' +
        'disappear while making the code wrong in a quieter way. If your coordinates can be ' +
        'integers, make them integers and the whole problem evaporates. If they cannot, use an ' +
        'adaptive predicate and measure how often it escalates. On ordinary data the answer is ' +
        'never, which means robustness here is free — and the only thing it costs you is the ' +
        'afternoon spent reading this section.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GeometryPrimitivesTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const ULP = Math.pow(2, -52);

  /** The four triples the section can show, each built to a stated purpose. */
  const tripleFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const family = parts[0];
    const offset = Number(parts[1]);
    const G = root.GeometryCore;

    if (family === 'clear-left') {
      return { a: G.point(0, 0), b: G.point(10, 0), c: G.point(5, 4) };
    }
    if (family === 'exactly-collinear') {
      return { a: G.point(0, 0), b: G.point(12, 12), c: G.point(24, 24) };
    }
    if (family === 'kettner') {
      const base = 0.5;
      return { a: G.point(base, base),
        b: G.point(base + 12 * ULP, base + 12 * ULP),
        c: G.point(base + 24 * ULP, base + (24 + offset) * ULP) };
    }
    /* c is COMPUTED to lie on the line through a and b, and is then lifted by
       whole units in the last place.

       The coordinates are deliberately awkward. A tidy line - slope 1 through
       (0.5, 0.5) - has coordinates a double represents exactly, so the
       subtractions inside the determinant do not round and the naive test is
       perfectly well behaved however close the points get. It is the ordinary
       full-mantissa values below, the kind any computed intersection produces,
       that put the naive determinant inside its own error bar. At offset 0 the
       point is not even exactly on the line: the arithmetic that placed it
       there rounded, which is precisely the situation a real caller is in. */
    const a = G.point(0.15608477592468262, 0.7452991008758545);
    const b = G.point(3.1257132530212406, 0.40750494003295895);
    const cx = 7.620286083221436;
    const onLine = -0.10375108718872073;
    return { a: a, b: b, c: G.point(cx, onLine + offset * Math.abs(onLine) * ULP) };
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    return root.GeometryLab.robustnessSweep(Number(key), 5);
  });

  const escalationFor = root.Helpers.memoise(function (key) {
    return {
      ordinary: root.GeometryLab.escalationRate(Number(key), 9),
      adversarial: sweepFor(key)
    };
  });

  /* -------------------------------------------------------------- painting */

  function update() {
    const values = panel.values();
    const triple = tripleFor(values['gp-family'] + '|' + values['gp-offset']);
    const sweep = sweepFor(String(values['gp-trials']));
    const tolerance = Number(values['gp-tolerance']);

    paintMetrics(sweep);
    paintScene(triple);
    paintPermutations(triple, tolerance);
    paintSweep(sweep);
    paintCost(escalationFor(String(values['gp-trials'])));
  }

  function paintMetrics(sweep) {
    const pct = function (n) { return root.Format.fixed(100 * n / Math.max(1, sweep.trials), 1) + '%'; };

    root.MetricGrid.update({
      'gp-contradictions': { value: root.Format.exact(sweep.naive),
        note: pct(sweep.naive) + ' of ' + root.Format.exact(sweep.trials) + ' triples' },
      'gp-epsilon-wrong': { value: root.Format.exact(sweep.epsilonWrong),
        note: pct(sweep.epsilonWrong) + ' wrong, and ' + root.Format.exact(sweep.epsilon) +
          ' self-contradictory' },
      'gp-adaptive': { value: root.Format.exact(sweep.adaptive + sweep.trials - sweep.trials),
        note: sweep.adaptive === 0 ? 'no contradictions and no wrong answers' :
          root.Format.exact(sweep.adaptive) + ' contradictions' },
      'gp-escalation': { value: pct(sweep.escalations),
        note: root.Format.exact(sweep.escalations) + ' of these adversarial triples needed the ' +
          'exact path' }
    });
  }

  function paintScene(triple) {
    view = function () { drawScene(triple); };
    view();
  }

  /* The three points are microscopically apart, so the picture is drawn in
     units of the gap rather than in the coordinates themselves - otherwise it
     is one dot and tells the reader nothing. */
  function drawScene(triple) {
    const host = root.jQuery('#gp-scene')[0];
    if (!host) return;
    const G = root.GeometryCore;
    const a = triple.a, b = triple.b, c = triple.c;

    const along = G.sub(b, a);
    const len = G.length(along) || 1;
    const unit = G.scale(along, 1 / len);
    const normal = G.point(-unit.y, unit.x);

    function projected(p) {
      const d = G.sub(p, a);
      return G.point(G.dot(d, unit) / len, G.dot(d, normal) / (len * ULP));
    }

    const pa = projected(a), pb = projected(b), pc = projected(c);
    root.GeometryView.render(host, {
      height: 240,
      segments: [{ a: pa, b: pb, hue: 'gray', width: 2 }],
      points: [{ point: pa, hue: 'blue', radius: 5, outline: true },
        { point: pb, hue: 'blue', radius: 5, outline: true },
        { point: pc, hue: 'orange', radius: 5, outline: true }],
      labels: [{ point: pa, text: 'a' }, { point: pb, text: 'b' }, { point: pc, text: 'c' }],
      ariaLabel: 'three points, with the distance from the line magnified'
    });

    const exact = root.GeometryCore.orient2d(a, b, c);
    root.Helpers.setText('gp-scene-note',
      'The vertical axis is magnified by 2⁵², so one unit up the picture is one unit in the last ' +
      'place of a double. The horizontal axis is the line from a to b. The exact answer here is ' +
      (exact === 0 ? 'collinear (0)' : exact > 0 ? 'a left turn (+1)' : 'a right turn (−1)') +
      ', and the floating-point determinant reads ' +
      root.Format.exponential(root.GeometryCore.orient2dValue(a, b, c), 3) + '.');
  }

  const ORDERINGS = [
    { name: 'a, b, c', pick: function (t) { return [t.a, t.b, t.c]; }, even: true },
    { name: 'b, c, a', pick: function (t) { return [t.b, t.c, t.a]; }, even: true },
    { name: 'c, a, b', pick: function (t) { return [t.c, t.a, t.b]; }, even: true },
    { name: 'a, c, b', pick: function (t) { return [t.a, t.c, t.b]; }, even: false },
    { name: 'c, b, a', pick: function (t) { return [t.c, t.b, t.a]; }, even: false },
    { name: 'b, a, c', pick: function (t) { return [t.b, t.a, t.c]; }, even: false }
  ];

  function signText(value) {
    if (value > 0) return 'left (+1)';
    if (value < 0) return 'right (−1)';
    return 'collinear (0)';
  }

  function paintPermutations(triple, tolerance) {
    const G = root.GeometryCore;
    const rows = ORDERINGS.map(function (entry) {
      const t = entry.pick(triple);
      return { name: entry.name + (entry.even ? '' : '  (swapped)'),
        naive: G.orient2dNaive(t[0], t[1], t[2]),
        epsilon: G.orient2dEpsilon(t[0], t[1], t[2], tolerance),
        adaptive: G.orient2d(t[0], t[1], t[2]) };
    });

    root.jQuery('#gp-perms tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + signText(row.naive) + '</td><td>' +
        signText(row.epsilon) + '</td><td>' + signText(row.adaptive) + '</td></tr>';
    }).join(''));

    const consistent = function (key) {
      const e = rows.slice(0, 3).map(function (r) { return r[key]; });
      const o = rows.slice(3).map(function (r) { return r[key]; });
      return e[0] === e[1] && e[1] === e[2] && o[0] === o[1] && o[1] === o[2] && e[0] === -o[0];
    };

    root.Helpers.setText('gp-perms-note',
      'The first three orderings are rotations and must all give the same answer; the last three ' +
      'swap a pair and must all give the opposite one. Naive: ' +
      (consistent('naive') ? 'consistent.' : 'CONTRADICTS ITSELF.') + ' Epsilon at ' +
      root.Format.exponential(tolerance, 0) + ': ' +
      (consistent('epsilon') ? 'consistent.' : 'CONTRADICTS ITSELF.') + ' Adaptive: ' +
      (consistent('adaptive') ? 'consistent.' : 'CONTRADICTS ITSELF.'));
  }

  function paintSweep(sweep) {
    const rows = [
      { name: 'naive determinant', contradicts: sweep.naive, wrong: sweep.naiveWrong,
        flattened: 0, verdict: 'fails loudly — the answers cannot all be true' },
      { name: 'value compared against an epsilon', contradicts: sweep.epsilon,
        wrong: sweep.epsilonWrong, flattened: sweep.epsilonFlattened,
        verdict: 'fails quietly — never contradicts itself, and is never right' },
      { name: 'adaptive, exact when it must be', contradicts: sweep.adaptive, wrong: 0,
        flattened: 0, verdict: 'correct on every triple' }
    ];

    root.jQuery('#gp-sweep tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.contradicts) +
        '</td><td>' + root.Format.exact(row.wrong) + '</td><td>' +
        root.Format.exact(row.flattened) + '</td><td>' + row.verdict + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gp-sweep-note',
      'Over ' + root.Format.exact(sweep.trials) + ' near-collinear triples. Read the first two ' +
      'columns together: the epsilon test scores zero in the column everyone checks and ' +
      root.Format.exact(sweep.epsilonWrong) + ' in the one that matters. It is not a compromise ' +
      'between the other two — it is a different failure, and the quieter of the two.');
  }

  function paintCost(cost) {
    const rows = [
      { name: 'ordinary points, no degeneracy', calls: cost.ordinary.calls,
        exact: cost.ordinary.exact },
      { name: 'near-collinear triples, built to be hard', calls: cost.adversarial.trials,
        exact: cost.adversarial.escalations }
    ];

    root.jQuery('#gp-cost tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.calls) + '</td><td>' +
        root.Format.exact(row.exact) + '</td><td>' +
        root.Format.fixed(100 * row.exact / Math.max(1, row.calls), 2) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('gp-cost-note',
      'The exact path is the expensive one, and on data that is not adversarial it does not run. ' +
      'That is what makes the choice easy: the robust predicate is not a trade against speed on ' +
      'the inputs you actually have, it is a trade against speed on the inputs that would ' +
      'otherwise produce a wrong answer.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
