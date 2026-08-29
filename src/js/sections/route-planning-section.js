/**
 * Section: route planning at scale.
 *
 * A contraction hierarchy is preprocessing that trades a bigger graph for a
 * smaller search, and the whole of its correctness sits in one subroutine:
 * before contracting v, decide whether u -> v -> w is still the only way
 * round. Answer "yes, there is another way" when there is not, and a
 * necessary shortcut is skipped; the query then returns a plausible too-long
 * distance - or Infinity on a connected graph - for a few pairs in a
 * thousand, with every invariant intact.
 *
 * So the witness search is a *control* here, with its two failure modes
 * selectable. Skipping it entirely is safe and slow: 492 shortcuts instead of
 * 18 and not one wrong answer. Letting it route through already-contracted
 * nodes is fast and wrong: 42 of 1 260 pairs, 20 of them reported unreachable.
 * Both are measured against every pair rather than a spot check, because a
 * spot check is exactly what misses this.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'route-planning';
  const WITNESS_MODES = [
    { id: 'bounded', label: 'bounded (correct)' },
    { id: 'none', label: 'none — shortcut every pair' },
    { id: 'ignore-contracted', label: 'through contracted nodes' }
  ];
  const HOP_LIMITS = [2, 3, 5, 8];
  const SCALE_SIDES = [4, 6, 8, 10, 12];
  const VERIFY_LIMIT = 64;
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
      title: 'Diagram — contracting a node, and the shortcut that replaces it',
      caption: 'Contracting v removes it from the working graph. For each pair of surviving ' +
        'neighbours the witness search asks whether u still reaches w within the cost of going ' +
        'through v. Here u–x–w costs 7 against u–v–w at 9, so the witness exists and no shortcut is ' +
        'needed; without u–x–w the shortcut u→w of weight 9 must be added or the distance is lost.',
      definition: [
        'flowchart LR',
        '    U["u"] -->|"4"| V["v (being contracted)"]',
        '    V -->|"5"| W["w"]',
        '    U -->|"3"| X["x"]',
        '    X -->|"4"| W',
        '    U -.->|"shortcut 9, only if no<br/>witness"| W'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Plain Dijkstra settles every node closer than the target, which on a continental road network ' +
          'is most of a continent for a cross-country query. Three ideas cut that down. **Searching ' +
          'from both ends** replaces one ball of radius d with two of radius d/2. **Contraction ' +
          'hierarchies** rank the nodes, remove them one at a time, and add a shortcut edge wherever ' +
          'removing a node would have lost a shortest path - after which a query never has to walk ' +
          '*down* the ranking. **Hub labelling and arc flags** go further still, at more memory.',
        'The contraction is where all the subtlety is. Removing v means asking, for every pair of its ' +
          'surviving neighbours u and w, whether the graph without v still gets from u to w within the ' +
          'cost of u→v→w. If it does, that path is the **witness** and no shortcut is needed. If it does ' +
          'not, the shortcut must be added, because after v is gone that distance exists nowhere else.',
        '**The two mistakes are not symmetric, and that asymmetry is the whole engineering lesson.** ' +
          'Failing to find a witness that exists adds an unnecessary shortcut: the graph grows and the ' +
          'query slows, and the answer stays correct. Claiming a witness that does not exist skips a ' +
          'necessary shortcut, and the answer is silently wrong on a handful of pairs. The witness ' +
          'search is therefore allowed to be *conservative* - truncated by hops, bounded by distance - ' +
          'and is never allowed to be optimistic.',
        '**Preprocessing is not free and the query win is not automatic.** On this page the witness ' +
          'search costs 2 927 steps on a 16-node network and 864 467 on a 144-node one - 295× the work ' +
          'for 9× the nodes - while the query settles 87 nodes instead of 144. That ratio is what makes ' +
          'CH a continental-scale technique and a poor choice for a graph small enough to search ' +
          'directly, and the table below is the honest version of a claim usually made without one.'
      ],
      demo: {
        title: 'Interactive demo — preprocess a network, then break the witness search on purpose',
        markup: root.RoutePlanningTemplate.render()
      },
      diagram: diagram(),
      insight: 'A preprocessing bug is the worst kind of bug to own, because the artefact outlives the ' +
        'run that produced it and every query afterwards inherits the error. That is why the check here ' +
        'is all-pairs rather than a sample: with the witness search routing through contracted nodes, ' +
        '1 218 of 1 260 pairs are perfectly correct, and the 42 that are not include 20 that claim two ' +
        'connected towns cannot be reached from each other. No integration test built from plausible ' +
        'journeys would have found that. If you build an index, verify it exhaustively at a size where ' +
        'exhaustive is affordable, and keep that fixture forever.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RoutePlanningTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* ------------------------------------------------------------- fixtures */

  function networkFor(shape, side, seed) {
    const random = root.Random.seeded(seed);
    const n = side * side;

    if (shape === 'road-like') return root.GraphCore.roadLike(side, side, random, {});

    if (shape === 'weighted-grid') {
      return root.GraphCore.grid(side, side, { random: random, weightRange: 9 });
    }

    if (shape === 'grid') return root.GraphCore.grid(side, side, {});

    if (shape === 'random') return root.GraphCore.randomGraph(n, n * 3, random, {});

    if (shape === 'path') return root.GraphCore.path(n, {});
    return root.GraphCore.barbell(Math.max(3, Math.floor(n / 2)));
  }

  function buildFor(graph, mode, hops) {
    const report = root.ContractionHierarchies.emptyReport();
    const hierarchy = root.ContractionHierarchies.build(graph,
      { witness: mode, hopLimit: hops, report: report });
    return { hierarchy: hierarchy, report: report,
      size: root.ContractionHierarchies.sizeOf(graph, hierarchy),
      check: graph.n <= VERIFY_LIMIT ? root.GraphLab.routingAllPairs(graph, hierarchy) : null };
  }

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = networkFor(parts[0], Number(parts[1]), Number(parts[2]));
    const built = buildFor(graph, parts[3], Number(parts[4]));
    return { graph: graph, built: built,
      routing: root.GraphLab.compareRouting(graph, 0, graph.n - 1,
        { hierarchy: built.hierarchy }) };
  });

  const modesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = networkFor(parts[0], Number(parts[1]), Number(parts[2]));
    return WITNESS_MODES.map(function (mode) {
      return { mode: mode, built: buildFor(graph, mode.id, Number(parts[3])) };
    });
  });

  function fixtureList() {
    return [
      { name: 'uniform grid 5×5', graph: root.GraphCore.grid(5, 5, {}) },
      { name: 'weighted grid 6×6',
        graph: root.GraphCore.grid(6, 6, { random: root.Random.seeded(3), weightRange: 9 }) },
      { name: 'random, 30 nodes and 80 edges',
        graph: root.GraphCore.randomGraph(30, 80, root.Random.seeded(5), {}) },
      { name: 'road-like 6×6',
        graph: root.GraphCore.roadLike(6, 6, root.Random.seeded(11), {}) },
      { name: 'path of 20', graph: root.GraphCore.path(20, {}) },
      { name: 'barbell of 5', graph: root.GraphCore.barbell(5) }
    ];
  }

  const fixturesFor = root.Helpers.memoise(function () {
    return fixtureList().map(function (entry) {
      return { name: entry.name, graph: entry.graph, built: buildFor(entry.graph, 'bounded', 5) };
    });
  });

  const scaleFor = root.Helpers.memoise(function () {
    return SCALE_SIDES.map(function (side) {
      const graph = root.GraphCore.roadLike(side, side, root.Random.seeded(11), {});
      const built = buildFor(graph, 'bounded', 5);
      return { side: side, graph: graph, built: built,
        routing: root.GraphLab.compareRouting(graph, 0, graph.n - 1,
          { hierarchy: built.hierarchy }) };
    });
  });

  const truncationFor = root.Helpers.memoise(function () {
    const graph = root.GraphCore.roadLike(8, 8, root.Random.seeded(11), {});
    return HOP_LIMITS.map(function (limit) {
      const built = buildFor(graph, 'bounded', limit);
      const query = root.ContractionHierarchies.query(built.hierarchy, 0, graph.n - 1, {});
      return { limit: limit, built: built,
        settled: query.report.settledForward + query.report.settledBackward };
    });
  });

  /* ------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['rte-shape'] + '|' + values['rte-side'] + '|' + values['rte-seed'];
  }

  function update() {
    const values = panel.values();
    const base = keyFor(values);
    const state = stateFor(base + '|' + values['rte-witness'] + '|' + values['rte-hops']);

    paintMetrics(state);
    paintMap(state);
    paintQuery(state);
    paintModes(modesFor(base + '|' + values['rte-hops']));
    paintFixtures(fixturesFor('fixed'));
    paintScale(scaleFor('fixed'));
    paintTruncation(truncationFor('fixed'));
  }

  function wrongText(check) {
    if (!check) return 'not run above ' + VERIFY_LIMIT + ' nodes';
    return root.Format.exact(check.wrong) + ' of ' + root.Format.exact(check.pairs);
  }

  function paintMetrics(state) {
    const rows = state.routing.rows;
    const size = state.built.size;

    root.MetricGrid.update({
      'rte-shortcuts': { value: root.Format.exact(size.shortcuts),
        note: root.Format.exact(state.built.report.witnessesFound) + ' witnesses found, ' +
          root.Format.exact(state.built.report.witnessSteps) + ' search steps' },
      'rte-growth': { value: root.Format.fixed(size.growth, 2) + '×',
        note: root.Format.exact(size.original) + ' edges became ' + root.Format.exact(size.total) },
      'rte-settled': { value: root.Format.exact(rows[0].settled) + ' → ' +
        root.Format.exact(rows[2].settled),
      note: root.Format.fixed(rows[0].settled / Math.max(1, rows[2].settled), 2) +
          '× — below 1.00 the hierarchy is costing more than it saves' },
      'rte-wrong': { value: wrongText(state.built.check),
        note: state.built.check && state.built.check.wrong > 0
          ? root.Format.exact(state.built.check.unreachable) + ' of them claim no route exists at all'
          : 'every pair compared against Dijkstra' }
    });
  }

  function paintMap(state) {
    view = function () { drawMap(state); };
    view();
  }

  function topRanked(state) {
    const rank = state.built.hierarchy.rank;
    const cut = Math.floor(state.graph.n * 0.85);
    return function (v) { return rank[v] >= cut ? 'cut' : null; };
  }

  function drawMap(state) {
    const host = root.jQuery('#rte-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const positions = state.graph.positionOf
      ? root.GraphView.fixedLayout(state.graph, width, 340)
      : root.GraphView.circularLayout(state.graph.n, width, 340);

    root.GraphView.draw({ host: host, graph: state.graph, positions: positions, height: 340,
      nodeClass: topRanked(state) });
    root.jQuery('#rte-map-note').text('Highlighted nodes are the last 15% to be contracted — the top ' +
      'of the hierarchy, which every long query passes through. On a road-like network these are the ' +
      'junctions the fast roads meet at, which is exactly the set a human would call "the motorway ' +
      'network", discovered by nothing but an edge-difference count.');
  }

  function paintQuery(state) {
    const rows = state.routing.rows;
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.distance) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.settled) + '</td>' +
        '<td class="mono">' + root.Format.fixed(rows[0].settled / Math.max(1, row.settled), 2) +
        '×</td></tr>';
    }).join('');

    root.jQuery('#rte-query tbody').html(html);
    root.jQuery('#rte-query-note').text('All three must return the same distance, and they do here (' +
      (state.routing.agree ? 'checked' : 'THEY DO NOT — the hierarchy is broken') + '). ' +
      'The upward search has no target pruning at all: it settles everything reachable going up the ' +
      'ranking, which is why on a small network the hierarchy can settle MORE nodes than Dijkstra and ' +
      'still be the right technique at a scale this demo cannot run.');
  }

  function modeRow(entry) {
    const check = entry.built.check;
    return '<tr><td>' + entry.mode.label + '</td>' +
      '<td class="mono">' + root.Format.exact(entry.built.size.shortcuts) + '</td>' +
      '<td class="mono">' + root.Format.fixed(entry.built.size.growth, 2) + '×</td>' +
      '<td class="mono">' + root.Format.exact(entry.built.report.witnessSteps) + '</td>' +
      '<td class="mono">' + (check ? root.Format.exact(check.wrong) : '—') + '</td>' +
      '<td class="mono">' + (check ? root.Format.exact(check.unreachable) : '—') + '</td></tr>';
  }

  function paintModes(rows) {
    root.jQuery('#rte-modes tbody').html(rows.map(modeRow).join(''));
    root.jQuery('#rte-modes-note').text('Three versions of one subroutine. Skipping the search ' +
      'entirely shortcuts every neighbour pair: the graph balloons, the preprocessing is instant, and ' +
      'not one answer is wrong. Letting it route through nodes that have already been contracted finds ' +
      'witnesses that no longer exist, so necessary shortcuts are skipped — and the result is a ' +
      'hierarchy that is almost exactly the right size, builds in the usual time, passes every ' +
      'structural check, and answers a few pairs in a thousand incorrectly.');
  }

  function paintFixtures(rows) {
    const html = rows.map(function (entry) {
      return '<tr><td>' + entry.name + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.graph.n) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.graph.edges.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.built.size.shortcuts) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.built.check.pairs) + '</td>' +
        '<td class="mono">' + root.Format.exact(entry.built.check.wrong) + '</td></tr>';
    }).join('');
    const totals = rows.reduce(function (acc, entry) {
      return { pairs: acc.pairs + entry.built.check.pairs, wrong: acc.wrong + entry.built.check.wrong };
    }, { pairs: 0, wrong: 0 });

    root.jQuery('#rte-fixtures tbody').html(html);
    root.jQuery('#rte-fixtures-note').text(root.Format.exact(totals.pairs) + ' pairs across six ' +
      'fixtures, ' + root.Format.exact(totals.wrong) + ' wrong. The two fixtures with zero shortcuts ' +
      'are there on purpose: a path and a barbell have nothing to contract around, so a hierarchy is ' +
      'pure overhead — and a technique that quietly does nothing on some inputs is worth being able to ' +
      'recognise before you deploy it.');
  }

  function scaleRow(entry) {
    const rows = entry.routing.rows;
    return '<tr><td class="mono">road-like ' + entry.side + '×' + entry.side + '</td>' +
      '<td class="mono">' + root.Format.exact(entry.graph.n) + '</td>' +
      '<td class="mono">' + root.Format.exact(entry.built.size.shortcuts) + '</td>' +
      '<td class="mono">' + root.Format.exact(entry.built.report.witnessSteps) + '</td>' +
      '<td class="mono">' + root.Format.exact(rows[0].settled) + '</td>' +
      '<td class="mono">' + root.Format.exact(rows[1].settled) + '</td>' +
      '<td class="mono">' + root.Format.exact(rows[2].settled) + '</td></tr>';
  }

  function paintScale(rows) {
    const first = rows[0];
    const last = rows[rows.length - 1];

    root.jQuery('#rte-scale tbody').html(rows.map(scaleRow).join(''));
    root.jQuery('#rte-scale-note').text('Preprocessing goes from ' +
      root.Format.exact(first.built.report.witnessSteps) + ' witness steps to ' +
      root.Format.exact(last.built.report.witnessSteps) + ' — ' +
      root.Format.fixed(last.built.report.witnessSteps / first.built.report.witnessSteps, 0) +
      '× the work for ' + root.Format.fixed(last.graph.n / first.graph.n, 0) + '× the nodes — while ' +
      'the query goes from settling everything to settling a fraction of it. That is the trade, and it ' +
      'is only worth making when the preprocessing is amortised over an enormous number of queries. ' +
      'One route lookup on a small graph should use bidirectional Dijkstra and nothing else.');
  }

  function truncationRows(rows) {
    return rows.map(function (entry) {
      return { cells: ['at most ' + entry.limit + ' hops',
        root.Format.exact(entry.built.size.shortcuts),
        root.Format.exact(entry.built.report.witnessSteps),
        root.Format.exact(entry.settled),
        root.Format.exact(entry.built.check.wrong) + ' of ' +
          root.Format.exact(entry.built.check.pairs)] };
    });
  }

  function paintTruncation(rows) {
    root.MatrixView.render(root.jQuery('#rte-truncation')[0], {
      columns: ['Witness search depth', 'Shortcuts', 'Witness steps', 'Query settles', 'Wrong pairs'],
      rows: truncationRows(rows)
    });
    root.jQuery('#rte-truncation-note').text('A truncated witness search gives up early and therefore ' +
      'misses witnesses that exist. That direction of error is safe: it adds shortcuts nobody needed, ' +
      'so the graph is bigger and the query slower, and the wrong column stays at zero at every depth. ' +
      'This is the precise sense in which the search may be approximate — approximate towards "add the ' +
      'shortcut", never towards "skip it".');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
