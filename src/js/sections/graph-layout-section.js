/**
 * Section: planarity, layout and drawing.
 *
 * A drawing is usually argued about on taste. The crossing count turns it into
 * a measurement, and once it is a measurement the comparisons stop being
 * opinions: on the grid the force model finds a genuinely planar embedding -
 * zero crossings from 40 edges - while the same graph on a ring crosses 70
 * times. That is not "nicer", it is 70 fewer places a reader has to work out
 * which line is which.
 *
 * Two claims that turn out to be false are worth the panels they take. Energy
 * does NOT fall monotonically under Fruchterman-Reingold's cooling schedule -
 * it rises on about 40% of the steps - and Euler's bound does NOT test
 * planarity: it proves K5 non-planar and misses K3,3 completely.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'graph-layout';
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
      title: 'Diagram — a layer assignment, and the dummy vertices a long edge needs',
      caption: 'Sugiyama layering puts every vertex one level below its deepest predecessor. An edge ' +
        'spanning more than one level is then split into a chain through invented vertices, so the ' +
        'ordering pass has something to place at each level in between. Without them a long edge is ' +
        'drawn straight through whatever happens to be in the way, which is what makes a generated ' +
        'diagram unreadable.',
      definition: [
        'flowchart TB',
        '    A["a — layer 0"] --> B["b — layer 1"]',
        '    B --> C["c — layer 2"]',
        '    A -.->|"spans two layers"| D1(["dummy — layer 1"])',
        '    D1 -.-> C',
        '    C --> E["the ordering pass now has<br/>two things to order on layer 1"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A **planar** graph is one that can be drawn with no edge crossings. **Euler\'s formula** ' +
          '`V − E + F = 2` gives a counting consequence for any simple planar graph with at least ' +
          'three vertices: `E ≤ 3V − 6`. That is a genuinely useful test in one direction only — a ' +
          'graph that fails it is certainly not planar, and a graph that passes it may or may not ' +
          'be. **Kuratowski\'s theorem** is the real characterisation: a graph is planar exactly ' +
          'when it contains no subdivision of `K5` or `K3,3`.',
        '**Force-directed layout** treats vertices as particles that repel and edges as springs that ' +
          'pull, then integrates. Fruchterman-Reingold caps each step by a temperature that cools ' +
          'linearly, which is what stops the system oscillating. It has no notion of crossings at ' +
          'all — it minimises an energy — and yet on a planar graph it routinely lands on a planar ' +
          'drawing, because crossings and high energy tend to coincide. "Tend to" is doing real work ' +
          'in that sentence, and the panel measures it.',
        '**Layered (Sugiyama) layout** is what you want for anything with a direction: a build ' +
          'graph, a state machine, a dependency tree. Assign each vertex to a layer one below its ' +
          'deepest predecessor, split every long edge into a chain of **dummy vertices** so each ' +
          'intermediate layer has something to place, then reorder within layers by the mean ' +
          'position of each vertex\'s neighbours — sweeping down and up a few times. Crossing ' +
          'minimisation is NP-hard even between two adjacent layers, so the barycentre sweep is a ' +
          'heuristic and every layered engine you have used runs one.',
        '**The crossing count is the only objective measure of a drawing anybody agrees on.** It is ' +
          'not the whole story — edge length uniformity, angular resolution and symmetry all matter ' +
          'to a reader — but it is the one that can be computed, and it turns "this diagram is ' +
          'unreadable" into a number that a different layout can be measured against.'
      ],
      demo: {
        title: 'Interactive demo — three layouts, the energy curve, and two counting bounds',
        markup: root.GraphLayoutTemplate.render()
      },
      diagram: diagram(),
      insight: 'Every diagram on this platform is laid out by one of these algorithms — mermaid runs ' +
        'a layered layout with a barycentre ordering pass, which is why a mermaid diagram gets worse ' +
        'exactly when you add an edge that spans several levels. Knowing that is what lets you fix ' +
        'an unreadable generated diagram by changing the *graph* — introducing an intermediate node, ' +
        'or reversing an edge to remove a cycle — instead of dragging boxes around. The layout ' +
        'engine is not being obtuse; it is minimising something, and you can find out what.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GraphLayoutTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GraphAnalysisLab.build({ shape: parts[0], n: Number(parts[1]),
      seed: Number(parts[2]), rows: 5, columns: 5 });
  });

  const layoutFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GraphAnalysisLab.layoutRun(instanceFor(parts.slice(0, 3).join('|')),
      { steps: Number(parts[3]), seed: Number(parts[2]) });
  });

  const energyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.GraphAnalysisLab.energyCurve(instanceFor(parts.slice(0, 3).join('|')),
      { steps: Number(parts[3]), seed: Number(parts[2]) });
  });

  const planarFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    const rows = root.GraphAnalysisLab.kuratowskiFixtures().map(function (fixture) {
      return { name: fixture.name, check: root.GraphAnalysisLab.planarityChecks(fixture) };
    });

    rows.push({ name: 'the graph selected above',
      check: root.GraphAnalysisLab.planarityChecks(instance) });
    return rows;
  });

  /* -------------------------------------------------------------- painting */

  const NAMES = { force: 'force-directed', circular: 'circular', layered: 'layered' };

  function update(app) {
    const values = panel.values();
    const base = values['lay-shape'] + '|' + values['lay-nodes'] + '|' + values['lay-seed'];
    const key = base + '|' + values['lay-steps'];
    const run = layoutFor(key);
    const energy = energyFor(key);
    const pick = values['lay-pick'];

    paintMetrics(run, energy, pick);
    paintMap(run, pick);
    paintCompare(run);
    paintEnergy(energy, app);
    paintPlanar(planarFor(base));
    paintSugiyama(run);
  }

  function bestOf(run) {
    const entries = Object.keys(NAMES).filter(function (name) {
      return run.crossings[name] !== null;
    });

    return entries.sort(function (a, b) { return run.crossings[a] - run.crossings[b]; })[0];
  }

  function paintMetrics(run, energy, pick) {
    const best = bestOf(run);
    const worst = Object.keys(NAMES).filter(function (name) {
      return run.crossings[name] !== null;
    }).sort(function (a, b) { return run.crossings[b] - run.crossings[a]; })[0];
    const check = root.GraphAnalysisLab.planarityChecks({ adjacency: adjacencyOf(run) });

    root.MetricGrid.update({
      'lay-crossings': { value: run.crossings[pick] === null ? 'refused'
        : root.Format.exact(run.crossings[pick]),
      note: NAMES[pick] + ', over ' + root.Format.exact(run.pairs) + ' candidate pairs' },
      'lay-best': { value: NAMES[best],
        note: root.Format.exact(run.crossings[best]) + ' against ' +
          root.Format.exact(run.crossings[worst]) + ' for ' + NAMES[worst] },
      'lay-planar': { value: check.failsGeneral ? 'not planar' : 'not ruled out',
        note: root.Format.exact(check.edges) + ' edges against a bound of ' +
          root.Format.exact(check.general) },
      'lay-energy': { value: root.Format.fixed(energy.last, 2),
        note: energy.rises === 0 ? 'the descent was monotone'
          : 'it rose on ' + root.Format.exact(energy.rises) + ' of ' +
            root.Format.exact(energy.curve.length - 1) + ' steps' }
    });
  }

  function adjacencyOf(run) {
    const adjacency = [];

    for (let v = 0; v < run.graph.n; v += 1) adjacency.push([]);
    run.edges.forEach(function (edge) {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    return adjacency;
  }

  function paintMap(run, pick) {
    view = function () { drawMap(run, pick); };
    view();
  }

  function drawMap(run, pick) {
    const host = root.jQuery('#lay-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const height = 360;
    const raw = pick === 'layered' ? run.layered.positions : run[pick].positions || run[pick];

    if (!raw) return;
    root.GraphView.draw({ host: host, graph: run.graph,
      positions: root.GraphAnalysisLab.fit(raw, width, height),
      width: width, height: height, nodeClass: function () { return 'settled'; } });
    root.jQuery('#lay-map-note').text('The ' + NAMES[pick] + ' drawing of the same ' +
      root.Format.exact(run.graph.n) + ' vertices and ' +
      root.Format.plural(run.edges.length, 'edge') + ', crossing ' +
      root.Format.exact(run.crossings[pick]) + ' times. All three layouts see identical input and ' +
      'differ only in where they put things — which is the argument for measuring a drawing rather ' +
      'than discussing it. Switch the layout above and watch the number move without the graph ' +
      'changing at all.');
  }

  function paintCompare(run) {
    const costs = { force: root.Format.exact(run.force.report.iterations) + ' iterations, ' +
        root.Format.exact(run.force.report.pairForces) + ' pair forces',
    circular: 'nothing — the positions are arithmetic',
    layered: root.Format.plural(run.layered.report.layers, 'layer') + ', ' +
        root.Format.exact(run.layered.report.dummyNodes) + ' dummy vertices, ' +
        root.Format.plural(run.layered.report.sweeps, 'sweep') };
    const html = Object.keys(NAMES).map(function (name) {
      const value = run.crossings[name];

      return '<tr><td>' + NAMES[name] + '</td>' +
        '<td class="mono">' + (value === null ? 'refused' : root.Format.exact(value)) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.pairs) + '</td>' +
        '<td class="mono">' + (value === null ? '—'
          : root.Format.fixed(100 * value / Math.max(1, run.pairs), 2) + '%') + '</td>' +
        '<td>' + costs[name] + '</td></tr>';
    }).join('');
    const best = bestOf(run);

    root.jQuery('#lay-compare tbody').html(html);
    root.jQuery('#lay-compare-note').text('The candidate-pair column is the denominator that makes ' +
      'the crossing count comparable across graphs: two edges can only cross if they share no ' +
      'endpoint, and there are ' + root.Format.exact(run.pairs) + ' such pairs here. ' +
      NAMES[best] + ' wins on this graph. The circular layout is worth keeping in the table ' +
      'precisely because it is usually the worst — it costs nothing, it is perfectly deterministic, ' +
      'and it shows what a layout that ignores the edges entirely produces.');
  }

  function paintEnergy(energy, app) {
    const host = root.jQuery('#lay-chart')[0];

    if (host) {
      root.GrowthPlot.render(host, {
        lazyLib: app.lazyLib,
        height: 240,
        yMin: Math.min.apply(null, energy.curve),
        series: [{ label: 'energy', points: energy.curve.map(function (value, index) {
          return { x: index, y: value }; }) }],
        xLabel: 'iteration',
        yLabel: 'energy',
        legendHost: root.jQuery('#lay-legend')[0],
        summary: function () {
          return 'The Fruchterman-Reingold energy over ' + energy.curve.length + ' iterations.';
        }
      });
    }
    root.jQuery('#lay-curve-note').text('Energy falls from ' + root.Format.fixed(energy.first, 2) +
      ' to ' + root.Format.fixed(energy.last, 2) + ' over ' +
      root.Format.exact(energy.curve.length - 1) + ' iterations — and it rises on ' +
      root.Format.exact(energy.rises) + ' of them, which is ' +
      root.Format.fixed(100 * energy.rises / Math.max(1, energy.curve.length - 1), 1) +
      '%. "Gradient descent converges monotonically" is a statement about infinitesimal steps; this ' +
      'takes finite ones capped by a temperature, so a step can overshoot the minimum it was aiming ' +
      'at. The cooling schedule is what makes the overshoots shrink, and it is the reason the ' +
      'algorithm terminates somewhere sensible rather than the reason each step improves.');
  }

  function paintPlanar(rows) {
    const html = rows.map(function (row) {
      const check = row.check;

      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(check.n) + '</td>' +
        '<td class="mono">' + root.Format.exact(check.edges) + '</td>' +
        '<td class="mono">' + root.Format.exact(check.general) +
          (check.failsGeneral ? ' — exceeded' : '') + '</td>' +
        '<td class="mono">' + root.Format.exact(check.bipartite) +
          (check.failsBipartite ? ' — exceeded' : '') + '</td>' +
        '<td>' + check.verdict + '</td></tr>';
    }).join('');

    root.jQuery('#lay-kuratowski tbody').html(html);
    root.jQuery('#lay-kuratowski-note').text('K5 has 10 edges against a bound of 9, so Euler settles it. ' +
      'K3,3 has 9 edges against a bound of 12 and sails through — the general bound cannot see it at ' +
      'all, and only the tighter bipartite bound of 2V − 4, which holds because a bipartite planar ' +
      'graph has no triangular face, catches it at 9 against 8. Two non-planar graphs, two different ' +
      'arguments, and neither bound ever proves a graph *is* planar. That is what Kuratowski\'s ' +
      'theorem and the linear-time planarity tests built on it are for; a counting check is a fast ' +
      'rejection filter in front of them, not a substitute.');
  }

  function paintSugiyama(run) {
    const report = run.layered.report;
    const rows = [
      { cells: ['layers assigned', root.Format.exact(report.layers),
        'each vertex one level below its deepest predecessor',
        run.layered.positions ? 'the orientation is acyclic' : 'refused: ' + run.layered.refused] },
      { cells: ['dummy vertices inserted', root.Format.exact(report.dummyNodes),
        'one per intermediate layer of every long edge',
        root.Format.fixed(report.dummyNodes / Math.max(1, run.graph.n), 2) + ' per real vertex'] },
      { cells: ['barycentre sweeps', root.Format.exact(report.sweeps),
        'reorder each layer by the mean position of its neighbours',
        'a heuristic — two-layer crossing minimisation is already NP-hard'] },
      { cells: ['crossings after ordering',
        run.crossings.layered === null ? 'refused' : root.Format.exact(run.crossings.layered),
        'counted on the real vertices only',
        'the dummies are drawn as bends, not as nodes'] }
    ];

    root.MatrixView.render(root.jQuery('#lay-sugiyama')[0], {
      columns: ['Stage', 'Count', 'What it does', 'Note'], rows: rows
    });
    root.jQuery('#lay-sugiyama-note').text('The dummy count is the number that explains most bad ' +
      'generated diagrams: each one is a place the ordering pass has to make a decision it has ' +
      'almost no information for. There ' + (report.dummyNodes === 0
      ? 'are none here, because every edge of this graph happens to join adjacent layers — which is ' +
        'exactly why this graph draws cleanly. Pick a shape with long-range edges and watch the ' +
        'count and the crossings rise together.'
      : 'are ' + root.Format.exact(report.dummyNodes) + ' of them against ' +
        root.Format.exact(run.graph.n) + ' real vertices.') +
      ' An edge that skips six layers contributes five dummies and five chances to cross something; ' +
      'adding an explicit intermediate node to your source graph removes all five at once, which is ' +
      'why that trick works and why it looks like superstition until you have seen this table.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
