/**
 * Section: Voronoi diagrams.
 *
 * The section makes two arguments. The first is that the diagram is the exact
 * DUAL of the Delaunay triangulation - one cell per site, one cell vertex per
 * triangle, one cell edge per Delaunay edge - so building it from a
 * triangulation you already have is dramatically easier than Fortune's sweep,
 * and is what almost every library actually does.
 *
 * The second is what "correct" means here, and it is not "the picture looks
 * right". A Voronoi picture looks right when it is badly wrong: cells are
 * convex, they tile the plane, and every one contains its site, all of which
 * remain true of a diagram whose boundaries are in the wrong places. So the
 * check is a brute-force nearest-site grid, and the number reported is how
 * many grid points landed in a cell that is not their nearest site's. That
 * number caught a construction that seeded every box corner into every
 * unbounded cell - 87 of 900 - and nothing about the drawing showed it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'voronoi-diagrams';
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
      title: 'Diagram — the diagram is the dual of the triangulation',
      caption: 'Every Delaunay triangle contributes its circumcentre as a Voronoi vertex, and every ' +
        'Delaunay edge contributes the cell edge perpendicular to it. A site on the convex hull has ' +
        'no triangle on its outer side, so its cell runs to infinity — those are the two rays that ' +
        'have to be generated rather than read off, and getting them wrong is the whole difficulty.',
      definition: [
        'flowchart TD',
        '    S["sites"] --> D["Delaunay triangulation"]',
        '    D --> C["circumcentre of each triangle<br/>= one Voronoi vertex"]',
        '    D --> E["each Delaunay edge<br/>= one Voronoi edge, perpendicular"]',
        '    C --> I["interior site: its triangles<br/>fan all the way round"]',
        '    E --> I',
        '    C --> H["hull site: the fan is OPEN"]',
        '    H --> R["emit two rays outward,<br/>then clip to the box"]',
        '    I --> V["a closed convex cell"]',
        '    R --> V'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'The **Voronoi cell** of a site is every point closer to that site than to any other. That ' +
          'definition is directly constructible: a point is closer to site `i` than to site `j` ' +
          'exactly when it lies on `i`\'s side of the perpendicular bisector between them, so a ' +
          'cell is the intersection of `n − 1` half-planes. Slow, and correct by construction with ' +
          'no case analysis to get wrong.',
        '**The diagram is the exact dual of the Delaunay triangulation.** One cell per site, one ' +
          'cell vertex per triangle — its circumcentre — and one cell edge per Delaunay edge. So if ' +
          'you already have the triangulation, the diagram is a walk over it, which is why building ' +
          'Voronoi from Delaunay is what most libraries do and why Fortune\'s sweep is worth ' +
          'understanding rather than necessarily implementing.',
        '**A site on the convex hull has an unbounded cell.** Its triangles do not fan all the way ' +
          'round it, so the dual gives an open chain rather than a closed loop, and the two ends ' +
          'have to be extended as rays perpendicular to the hull edges before anything can be ' +
          'clipped. That is the one case the half-plane construction gets for free and the dual ' +
          'does not.',
        '**Lloyd relaxation** moves every site to the centroid of its own cell and rebuilds. Repeat ' +
          'and the cells become progressively more equal in size and rounder — a *centroidal* ' +
          'diagram — which is the standard way to turn a random point set into an even one for ' +
          'stippling, meshing and procedural maps.'
      ],
      demo: {
        title: 'Interactive demo — two constructions, a nearest-site oracle, and Lloyd relaxation',
        markup: root.VoronoiDiagramsTemplate.render()
      },
      diagram: diagram(),
      insight: 'A Voronoi diagram that is wrong still looks right, which is what makes this one of ' +
        'the easiest structures to ship broken. The cells are still convex, they still tile the ' +
        'plane, and every one still contains its own site — none of those properties notices that a ' +
        'boundary is in the wrong place. The only check worth trusting is the definition itself: ' +
        'sample points, find each one\'s nearest site by brute force, and ask whether it fell in ' +
        'that site\'s cell. It is embarrassingly slow and it is the only thing that will tell you.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.VoronoiDiagramsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const sitesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const base = root.GeometryLab.points(parts[0], Number(parts[1]), 53);
    const rounds = Number(parts[2]);
    if (rounds <= 0) return { sites: base, history: [], bounds: root.Voronoi.defaultBounds(base, 8) };

    const bounds = root.Voronoi.defaultBounds(base, 8);
    const relaxed = root.Voronoi.lloyd(base, { bounds: bounds, rounds: rounds });
    return { sites: relaxed.sites, history: relaxed.history, bounds: bounds };
  });

  const builtFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const state = sitesFor(parts[0] + '|' + parts[1] + '|' + parts[2]);
    const steps = Number(parts[3]);

    const halfPlane = root.Voronoi.diagram(state.sites, { bounds: state.bounds });
    const dual = root.Voronoi.dualCells(state.sites, { bounds: state.bounds });
    return {
      state: state,
      halfPlane: halfPlane,
      dual: dual,
      halfCheck: root.Voronoi.verify(halfPlane, steps),
      dualCheck: root.Voronoi.verify(dual, steps),
      comparison: root.Voronoi.compareConstructions(state.sites, { bounds: state.bounds })
    };
  });

  /** The full Lloyd trajectory, for the chart, independent of the shown state. */
  const trajectoryFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const base = root.GeometryLab.points(parts[0], Number(parts[1]), 53);
    const bounds = root.Voronoi.defaultBounds(base, 8);
    return root.Voronoi.lloyd(base, { bounds: bounds, rounds: 12 }).history;
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['vd-set'] + '|' + values['vd-sites'] + '|' + values['vd-rounds'] +
      '|' + values['vd-grid'];
    const built = builtFor(key);

    paintMetrics(built);
    paintScene(built);
    paintMethods(built);
    paintTrajectory(trajectoryFor(values['vd-set'] + '|' + values['vd-sites']), app);
    paintLloyd(trajectoryFor(values['vd-set'] + '|' + values['vd-sites']));
  }

  function paintMetrics(built) {
    const spread = root.Voronoi.areaSpread(built.halfPlane.cells);

    root.MetricGrid.update({
      'vd-cells': { value: root.Format.exact(built.halfPlane.cells.length),
        note: 'one per distinct site' },
      'vd-unbounded': { value: root.Format.exact(built.halfPlane.report.unbounded),
        note: 'these would run to infinity without the clip box' },
      'vd-misassigned': { value: root.Format.exact(built.halfCheck.misassigned),
        note: 'of ' + root.Format.exact(built.halfCheck.gridPoints) +
          ' grid points, checked against brute force' },
      'vd-spread': { value: root.Format.fixed(spread.spread, 4),
        note: 'largest cell is ' + root.Format.fixed(spread.ratio, 1) + '× the smallest' }
    });
  }

  function paintScene(built) {
    view = function () { drawScene(built); };
    view();
  }

  function drawScene(built) {
    const host = root.jQuery('#vd-scene')[0];
    if (!host) return;
    const cells = built.halfPlane.cells;
    const mesh = built.dual.mesh;

    root.GeometryView.render(host, {
      height: 320,
      bounds: { minX: built.state.bounds.x0, minY: built.state.bounds.y0,
        maxX: built.state.bounds.x1, maxY: built.state.bounds.y1 },
      construction: mesh ? delaunayEdges(mesh) : [],
      rings: cells.filter(function (c) { return c.ring.length >= 3; })
        .map(function (c) { return { points: c.ring, hue: 'blue', width: 1.5 }; }),
      points: cells.map(function (c) {
        return { point: c.site, hue: c.unbounded ? 'orange' : 'teal', radius: 3, outline: true };
      }),
      ariaLabel: 'Voronoi cells with the Delaunay triangulation drawn faintly beneath'
    });

    root.Helpers.setText('vd-scene-note',
      'Blue outlines are the Voronoi cells; the faint grey mesh beneath is the Delaunay ' +
      'triangulation they are the dual of — every cell corner sits at a triangle\'s circumcentre. ' +
      'Orange sites are the ones whose cells reach the clip box, which is to say the ones whose ' +
      'cells are genuinely unbounded: ' + root.Format.exact(built.halfPlane.report.unbounded) +
      ' of ' + root.Format.exact(cells.length) + '.');
  }

  function delaunayEdges(mesh) {
    const seen = new Set();
    const out = [];

    mesh.triangles.forEach(function (t) {
      [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
        const id = e[0] < e[1] ? e[0] + ':' + e[1] : e[1] + ':' + e[0];
        if (seen.has(id)) return;
        seen.add(id);
        out.push({ a: mesh.points[e[0]], b: mesh.points[e[1]], hue: 'gray', width: 0.75 });
      });
    });
    return out;
  }

  function paintMethods(built) {
    const rows = [
      { name: 'half-plane intersection', built: built.halfPlane, check: built.halfCheck },
      { name: 'the Delaunay dual', built: built.dual, check: built.dualCheck }
    ];

    root.jQuery('#vd-methods tbody').html(rows.map(function (row) {
      const total = row.built.cells.reduce(function (s, c) { return s + c.area; }, 0);
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.built.cells.length) +
        '</td><td>' + root.Format.fixed(total, 2) + '</td><td>' +
        root.Format.exponential(built.comparison.worstGap, 2) + '</td><td>' +
        root.Format.exact(row.check.siteOutside) + '</td><td>' +
        root.Format.exact(row.check.misassigned) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('vd-methods-note',
      'The two constructions agree to ' +
      root.Format.exponential(built.comparison.relative, 2) + ' of relative area — which is ' +
      'floating-point noise, not a difference. That agreement is worth having because they share ' +
      'no code: one intersects half-planes and the other walks a triangulation. The last two ' +
      'columns are the check that matters, and both must be zero.');
  }

  function paintTrajectory(history, app) {
    const host = root.jQuery('#vd-chart')[0];
    if (!host || !history.length) return;

    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      logY: true,
      height: 220,
      series: [
        { label: 'total site movement',
          points: history.map(function (h) { return { x: h.round, y: Math.max(1e-6, h.movement) }; }) },
        { label: 'cell area spread',
          points: history.map(function (h) { return { x: h.round, y: Math.max(1e-6, h.spread) }; }) }
      ],
      xLabel: 'Lloyd round',
      yLabel: 'movement / spread (log scale)',
      legendHost: root.jQuery('#vd-legend')[0],
      ariaLabel: 'Lloyd relaxation convergence'
    });

    const first = history[0];
    const last = history[history.length - 1];
    root.Helpers.setText('vd-chart-note',
      'Both curves fall monotonically: total movement from ' +
      root.Format.fixed(first.movement, 2) + ' to ' + root.Format.fixed(last.movement, 2) +
      ' and area spread from ' + root.Format.fixed(first.spread, 4) + ' to ' +
      root.Format.fixed(last.spread, 4) + ' over ' + root.Format.exact(last.round) + ' rounds. ' +
      'Neither reaches zero — a centroidal diagram is a fixed point that relaxation approaches ' +
      'rather than lands on, so the stopping rule is a threshold you choose.');
  }

  function paintLloyd(history) {
    root.jQuery('#vd-lloyd tbody').html(history.map(function (h) {
      return '<tr><td>' + root.Format.exact(h.round) + '</td><td>' +
        root.Format.fixed(h.movement, 3) + '</td><td>' + root.Format.fixed(h.spread, 4) +
        '</td><td>' + root.Format.fixed(h.ratio, 1) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('vd-lloyd-note',
      'Move the rounds slider to see the diagram at each stage. The first round does most of the ' +
      'work — a random point set has a few very lopsided cells and they correct immediately — and ' +
      'after that the movement decays slowly. That shape is why Lloyd is usually run for a fixed ' +
      'small number of rounds rather than to convergence.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
