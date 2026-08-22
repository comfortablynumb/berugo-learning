/**
 * Section: heuristic search - A* and friends.
 *
 * The section exists to separate three claims that are usually said in one
 * breath. "A* is faster than Dijkstra" is false unless the heuristic is
 * *informed*: on a grid whose steps cost 1 to 9, a unit-step Manhattan
 * distance is admissible, consistent, and expands every one of the 1 600
 * cells - exactly what Dijkstra does. "An admissible heuristic is safe" is
 * false if the reopen check is skipped: admissible-but-inconsistent plus
 * `reopen: false` returns a path 21% too long and raises nothing. And
 * "geometry gives you the heuristic" is false on any graph whose edge costs
 * are not distances, which is why ALT - two landmarks and the triangle
 * inequality - beats Manhattan by 16x on the same grid.
 *
 * Every admissibility and consistency claim on the page is *checked* against
 * exact distances rather than asserted, which is only affordable at these
 * sizes and is the only honest way to make it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'heuristic-search';
  const LANDMARK_COUNTS = [1, 2, 4, 8];
  const IDA_SIDES = [6, 8, 10];
  const IDA_BUDGET = 120000;
  const REOPEN_SIDE = 20;
  const BIDIRECTIONAL_SIDE = 80;
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
      title: 'Diagram — f = g + h, and what each term buys',
      caption: 'g is what the path has already cost and is a fact; h is a guess about the rest. ' +
        'Dijkstra is the case h = 0. Raising h orders the queue by where the goal is, and the two ' +
        'properties that matter are whether h ever overestimates (admissible) and whether it falls ' +
        'by at most the edge weight along every edge (consistent).',
      definition: [
        'flowchart LR',
        '    S["start"] -->|"g = 12"| V["current node v"]',
        '    V -->|"h = 30 (a guess)"| T["goal"]',
        '    V --> F["f(v) = 42<br/>the queue key"]',
        '    F --> A["admissible: h(v) &le; true cost to goal<br/>&rArr; the answer is optimal"]',
        '    F --> C["consistent: h(u) &le; w(u,v) + h(v)<br/>&rArr; no node is ever reopened"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A* is Dijkstra with the queue key changed from `g(v)` to `g(v) + h(v)`, where `h` estimates ' +
          'what remains. Everything else - the relaxation, the settled set, the parent pointers - is ' +
          'unchanged, which is why A* inherits Dijkstra\'s correctness argument and only has to defend ' +
          'the new term. Two properties defend it. **Admissible** means `h` never overestimates, and it ' +
          'buys optimality. **Consistent** means `h(u) <= w(u, v) + h(v)` on every edge, and it buys ' +
          'the right to close a node forever.',
        'The two are not the same and their consequences differ. An admissible but inconsistent ' +
          'heuristic still returns the optimal path **provided closed nodes can be reopened**; drop the ' +
          'reopen check for speed and it returns a plausible, wrong, longer path with nothing raised. ' +
          'On this page that is measured rather than argued: the same admissible heuristic returns 128 ' +
          'with reopening on and 155 with it off, a gap of 21.09%.',
        '**A heuristic that is merely admissible is not automatically useful.** The terrain here costs ' +
          '1 to 9 per step, so a unit-step Manhattan distance is a true lower bound and a very weak one: ' +
          'A* expands all 1 600 cells, the same as Dijkstra, and the pruning is exactly zero. What ' +
          'closes the gap is a heuristic in the same units as the edges - **ALT**, which precomputes ' +
          'exact distances to a few landmarks and uses the triangle inequality, needs no geometry at all ' +
          'and expands 98 cells for the same answer.',
        'Weighted A* multiplies `h` by w > 1, giving up admissibility on purpose. The trade is real and ' +
          'bounded: the returned cost is at most w times optimal. Here x5 costs 18.47% more for 11x ' +
          'fewer expansions and x9 costs 44.98% more for 19x fewer - **and on a uniform grid the same ' +
          'inflation costs nothing at all**, because every monotone path ties, so an experiment that ' +
          'only ever ran on unit costs would report that inadmissibility is free.'
      ],
      demo: {
        title: 'Interactive demo — the same query, six heuristics, and every claim checked',
        markup: root.HeuristicSearchTemplate.render()
      },
      diagram: diagram(),
      insight: 'The question to ask about a heuristic is never "is it admissible?" on its own. It is ' +
        'two questions: does it ever overestimate, and is it in the same units as the edge weights? ' +
        'The first decides correctness and the second decides whether the search is any faster than ' +
        'the one you already had. Grid tutorials hide the second question because there the edges are ' +
        'distances, so geometry answers it for free; on a road network with turn penalties, a build ' +
        'graph with task durations, or a state space with no coordinates at all, geometry answers ' +
        'nothing and the useful heuristic is the one built from measured distances — which is what ALT ' +
        'is, and why it is 16× better here than the heuristic everybody reaches for first.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HeuristicSearchTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  /* -------------------------------------------------------------- the graph */

  function gridFor(terrain, side, seed) {
    if (terrain === 'uniform') return root.GraphCore.grid(side, side, {});
    return root.GraphCore.grid(side, side,
      { random: root.Random.seeded(seed), weightRange: 9 });
  }

  function altFor(adjacency, target, count) {
    const chosen = root.AStar.chooseLandmarks(adjacency, count, function (v) {
      return root.ShortestPaths.dijkstra(adjacency, v, {}).distance;
    });
    return { heuristic: root.AStar.landmarkHeuristic(chosen.distances, target),
      landmarks: chosen.landmarks };
  }

  /** The heuristic the map draws, chosen by the select. */
  function pickedHeuristic(name, graph, adjacency, target) {
    if (name === 'none') return function () { return 0; };

    if (name === 'euclidean') return root.AStar.euclidean(graph.positionOf, target, 1);

    if (name === 'inflated') return root.AStar.manhattan(graph.positionOf, target, 5);

    if (name === 'alt') return altFor(adjacency, target, 2).heuristic;
    return root.AStar.manhattan(graph.positionOf, target, 1);
  }

  const baseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const graph = gridFor(parts[0], Number(parts[1]), Number(parts[2]));
    const adjacency = root.GraphCore.adjacencyList(graph);
    const target = graph.n - 1;
    const baseline = root.ShortestPaths.dijkstra(adjacency, 0, {});
    return { graph: graph, adjacency: adjacency, target: target, baseline: baseline,
      optimal: baseline.distance[target],
      exact: root.ShortestPaths.dijkstra(adjacency, target, {}).distance };
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const base = baseFor(parts.slice(0, 3).join('|'));
    const heuristic = pickedHeuristic(parts[3], base.graph, base.adjacency, base.target);
    const run = root.AStar.search(base.adjacency, 0, base.target,
      { heuristic: heuristic, weight: Number(parts[4]) / 10, reopen: parts[5] === 'true' });
    return { base: base, run: run,
      admissible: root.AStar.checkAdmissible(heuristic, base.exact).admissible,
      consistent: root.AStar.checkConsistent(base.adjacency, heuristic).consistent };
  });

  const compareFor = root.Helpers.memoise(function (key) {
    const base = baseFor(key);
    const graph = base.graph;
    const target = base.target;
    const entries = [
      { name: 'Manhattan ×1', heuristic: root.AStar.manhattan(graph.positionOf, target, 1) },
      { name: 'Euclidean', heuristic: root.AStar.euclidean(graph.positionOf, target, 1) },
      { name: 'ALT — 2 landmarks', heuristic: altFor(base.adjacency, target, 2).heuristic },
      { name: 'Manhattan ×5', heuristic: root.AStar.manhattan(graph.positionOf, target, 5) },
      { name: 'Manhattan ×9', heuristic: root.AStar.manhattan(graph.positionOf, target, 9) }
    ];
    return { base: base, rows: root.GraphLab.compareHeuristics(graph, 0, target,
      { heuristics: entries }).rows };
  });

  const landmarksFor = root.Helpers.memoise(function (key) {
    const base = baseFor(key);
    return LANDMARK_COUNTS.map(function (count) {
      const alt = altFor(base.adjacency, base.target, count);
      const run = root.AStar.search(base.adjacency, 0, base.target, { heuristic: alt.heuristic });
      return { count: count, run: run, landmarks: alt.landmarks,
        admissible: root.AStar.checkAdmissible(alt.heuristic, base.exact).admissible };
    });
  });

  /* ------------------------------------------------------------ fixed panels */

  /**
   * A heuristic that is admissible and demonstrably inconsistent, built by
   * scaling each exact distance down by a random factor. Nothing about it
   * overestimates, and it violates h(u) <= w(u, v) + h(v) all over the graph -
   * which is the only combination that makes the reopen check visible.
   */
  const reopeningFor = root.Helpers.memoise(function () {
    const base = baseFor('weighted|' + REOPEN_SIDE + '|7');
    const random = root.Random.seeded(13);
    const noisy = base.exact.map(function (d) {
      return d === Infinity ? 0 : Math.floor(d * random.next());
    });
    const heuristic = function (v) { return noisy[v]; };
    const consistent = root.AStar.manhattan(base.graph.positionOf, base.target, 1);
    return { base: base,
      admissible: root.AStar.checkAdmissible(heuristic, base.exact).admissible,
      consistent: root.AStar.checkConsistent(base.adjacency, heuristic).consistent,
      rows: [true, false].map(function (reopen) {
        return { reopen: reopen,
          loose: root.AStar.search(base.adjacency, 0, base.target,
            { heuristic: heuristic, reopen: reopen }),
          tight: root.AStar.search(base.adjacency, 0, base.target,
            { heuristic: consistent, reopen: reopen }) };
      }) };
  });

  const memoryFor = root.Helpers.memoise(function () {
    return IDA_SIDES.map(function (side) {
      const base = baseFor('weighted|' + side + '|7');
      const heuristic = root.AStar.manhattan(base.graph.positionOf, base.target, 1);
      return { side: side,
        ida: root.AStar.idaStar(base.adjacency, 0, base.target,
          { heuristic: heuristic, nodeBudget: IDA_BUDGET }),
        star: root.AStar.search(base.adjacency, 0, base.target, { heuristic: heuristic }) };
    });
  });

  function bidirectionalProbes(side) {
    const centre = Math.floor(side / 2) * side + Math.floor(side / 2);
    return [
      { name: 'corner to corner', from: 0, to: side * side - 1 },
      { name: 'centre to a nearby cell', from: centre, to: centre + 4 * side + 4 },
      { name: 'centre to the far corner', from: centre, to: side * side - 1 },
      { name: 'one row apart', from: centre, to: centre + side }
    ];
  }

  const bidirectionalFor = root.Helpers.memoise(function () {
    const graph = root.GraphCore.grid(BIDIRECTIONAL_SIDE, BIDIRECTIONAL_SIDE, {});
    const adjacency = root.GraphCore.adjacencyList(graph);
    return bidirectionalProbes(BIDIRECTIONAL_SIDE).map(function (probe) {
      const plain = root.ShortestPaths.dijkstra(adjacency, probe.from, { target: probe.to });
      const both = root.AStar.bidirectional(adjacency, adjacency, probe.from, probe.to, {});
      return { name: probe.name, settled: plain.report.settled, expanded: both.report.expanded,
        agree: plain.distance[probe.to] === both.distance, distance: both.distance };
    });
  });

  /* ----------------------------------------------------------------- painting */

  function keyFor(values) {
    return values['heu-terrain'] + '|' + values['heu-side'] + '|' + values['heu-seed'];
  }

  function update() {
    const values = panel.values();
    const base = keyFor(values);
    const state = runFor(base + '|' + values['heu-pick'] + '|' + values['heu-scale'] + '|' +
      String(values['heu-reopen']));

    paintMetrics(state);
    paintMap(state, values['heu-pick']);
    paintCompare(compareFor(base));
    paintReopening(reopeningFor('fixed'));
    paintLandmarks(landmarksFor(base), base);
    paintBidirectional(bidirectionalFor('fixed'));
    paintMemory(memoryFor('fixed'));
  }

  function gapOf(cost, optimal) {
    if (!isFinite(cost) || optimal === 0) return 0;
    return 100 * (cost - optimal) / optimal;
  }

  function paintMetrics(state) {
    const gap = gapOf(state.run.distance, state.base.optimal);
    const verdict = state.admissible
      ? (state.consistent ? 'admissible and consistent' : 'admissible, NOT consistent')
      : 'NOT admissible';

    root.MetricGrid.update({
      'heu-cost': { value: root.Format.exact(state.run.distance),
        note: 'the true shortest path costs ' + root.Format.exact(state.base.optimal) },
      'heu-expanded': { value: root.Format.exact(state.run.report.expanded),
        note: root.Format.fixed(state.base.baseline.report.settled /
          Math.max(1, state.run.report.expanded), 2) + '× Dijkstra’s own ' +
          root.Format.exact(state.base.baseline.report.settled) },
      'heu-gap': { value: root.Format.fixed(gap, 2) + '%',
        note: gap === 0 ? 'optimal — nothing was given up' : 'the price of the inadmissible estimate' },
      'heu-safe': { value: verdict,
        note: state.run.report.reopened + ' node(s) reopened, ' +
          state.run.report.reopensSuppressed + ' suppressed' }
    });
  }

  function paintMap(state, pick) {
    view = function () { drawMap(state, pick); };
    view();
  }

  function drawMap(state, pick) {
    const host = root.jQuery('#heu-map')[0];

    if (!host) return;
    const graph = state.base.graph;
    const positions = root.GraphView.fixedLayout(graph, host.clientWidth || 620, 360);

    root.GraphView.draw({
      host: host, graph: graph, positions: positions, height: 360, radius: 2.2,
      path: state.run.path,
      nodeClass: function (v) { return state.run.closed[v] ? 'settled' : null; }
    });
    root.jQuery('#heu-map-note').text('Highlighted cells were expanded and the thick line is the path ' +
      'returned. ' + root.Format.exact(state.run.report.expanded) + ' of ' +
      root.Format.exact(graph.n) + ' cells were expanded' +
      (pick === 'none' ? ' — with no heuristic this is Dijkstra, and the expanded set is a disc.'
        : ' — a good heuristic stretches that disc into a corridor towards the goal.'));
  }

  function yesNo(value) { return value ? 'yes' : 'no'; }

  function compareRow(row, base) {
    const gap = gapOf(row.distance, base.optimal);
    return '<tr><td>' + row.name + '</td>' +
      '<td class="mono">' + root.Format.exact(row.distance) + '</td>' +
      '<td class="mono">' + root.Format.exact(row.expanded) + '</td>' +
      '<td class="mono">' + root.Format.exact(row.reopened === undefined ? 0 : row.reopened) + '</td>' +
      '<td class="mono">' + root.Format.fixed(gap, 2) + '%</td>' +
      '<td>' + yesNo(row.admissible) + '</td>' +
      '<td>' + yesNo(row.consistent) + '</td></tr>';
  }

  function paintCompare(state) {
    root.jQuery('#heu-compare tbody').html(state.rows.map(function (row) {
      return compareRow(row, state.base);
    }).join(''));
    root.jQuery('#heu-compare-note').text('Every admissibility and consistency column is checked ' +
      'against exact distances rather than claimed. Two rows are worth staring at: the admissible, ' +
      'consistent Manhattan estimate that expands as many nodes as Dijkstra because on this terrain a ' +
      'unit step is a hopeless lower bound for a step costing up to nine, and the ALT row that expands ' +
      'a fraction of them using no geometry whatsoever.');
  }

  function reopeningRows(state) {
    return state.rows.map(function (row) {
      return { cells: [row.reopen ? 'reopen closed nodes (correct)' : 'never reopen (fast)',
        root.Format.exact(row.loose.distance) + ' (' +
          root.Format.fixed(gapOf(row.loose.distance, state.base.optimal), 2) + '% gap)',
        root.Format.exact(row.loose.report.expanded),
        root.Format.exact(row.loose.report.reopened) + ' / ' +
          root.Format.exact(row.loose.report.reopensSuppressed),
        root.Format.exact(row.tight.distance) + ' from ' +
          root.Format.exact(row.tight.report.expanded) + ' expansions'] };
    });
  }

  function paintReopening(state) {
    root.MatrixView.render(root.jQuery('#heu-reopening')[0], {
      columns: ['Policy', 'Cost with an inconsistent h', 'Expanded', 'Reopened / suppressed',
        'The same run with a consistent h'],
      rows: reopeningRows(state)
    });
    root.jQuery('#heu-reopening-note').text('A ' + REOPEN_SIDE + '×' + REOPEN_SIDE +
      ' weighted grid whose heuristic is admissible (' + yesNo(state.admissible) +
      ') and consistent (' + yesNo(state.consistent) + '). The optimal cost is ' +
      root.Format.exact(state.base.optimal) + '. Turning the reopen check off makes the search ' +
      'faster and wrong, and nothing about the run says so — which is why the last column matters: ' +
      'with a consistent heuristic the policy makes no difference at all, because a consistent ' +
      'heuristic never produces a node worth reopening.');
  }

  function paintLandmarks(rows, key) {
    const base = baseFor(key);
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.count + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.distance) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.expanded) + '</td>' +
        '<td class="mono">' + root.Format.fixed(base.baseline.report.settled /
          Math.max(1, row.run.report.expanded), 2) + '×</td>' +
        '<td>' + yesNo(row.admissible) + '</td></tr>';
    }).join('');

    root.jQuery('#heu-landmarks tbody').html(html);
    root.jQuery('#heu-landmarks-note').text('Landmarks are chosen farthest-first, and each one costs ' +
      'one full single-source search to precompute. The interesting part of this table is where it ' +
      'stops improving: the bound is a maximum over landmarks, so a landmark that is never the best ' +
      'one for this query adds memory and nothing else. Pick landmarks for the queries you expect, ' +
      'and measure rather than adding more.');
  }

  function paintBidirectional(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.settled) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.expanded) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.settled / Math.max(1, row.expanded), 2) + '×</td>' +
        '<td>' + yesNo(row.agree) + '</td></tr>';
    }).join('');

    root.jQuery('#heu-bidirectional tbody').html(html);
    root.jQuery('#heu-bidirectional-note').text('Two balls of radius d/2 hold about half the area of ' +
      'one ball of radius d, so bidirectional search is a constant-factor win whose size depends ' +
      'entirely on the query. Corner to corner on a square grid is its worst case, because both balls ' +
      'run into the walls and cover the whole board anyway — quoting the flattering row and omitting ' +
      'that one is how this technique gets oversold.');
  }

  function memoryRows(rows) {
    return rows.map(function (row) {
      const done = !row.ida.budgetExhausted;
      return { cells: [row.side + '×' + row.side + ' (' + (row.side * row.side) + ' cells)',
        done ? root.Format.exact(row.ida.distance) : 'gave up',
        done ? root.Format.exact(row.ida.report.expanded) + ' expansions'
          : 'over ' + root.Format.exact(IDA_BUDGET) + ' expansions',
        root.Format.exact(row.ida.report.iterations),
        root.Format.exact(row.star.distance) + ' from ' +
          root.Format.exact(row.star.report.expanded) + ' expansions'] };
    });
  }

  function paintMemory(rows) {
    root.MatrixView.render(root.jQuery('#heu-memory')[0], {
      columns: ['Instance', 'IDA* cost', 'IDA* work', 'Threshold rounds', 'A* for comparison'],
      rows: memoryRows(rows)
    });
    root.jQuery('#heu-memory-note').text('IDA* keeps only the current path, so its memory is the ' +
      'depth rather than the frontier — and it pays for that by re-expanding every shallow node on ' +
      'every threshold round. On integer-weighted terrain the threshold creeps up by ones, so the ' +
      'round count grows with the path cost and the work explodes: at 10×10 it exhausts a budget of ' +
      root.Format.exact(IDA_BUDGET) + ' expansions on a graph A* finishes in a hundred. IDA* is for ' +
      'state spaces too large to store a frontier at all, not for graphs that fit in memory.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
